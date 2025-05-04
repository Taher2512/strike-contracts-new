import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrikeContractsNew } from "../target/types/strike_contracts_new";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { expect } from "chai";

describe("fantasy_cricket", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .StrikeContractsNew as Program<StrikeContractsNew>;

  // Test accounts
  const admin = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const user3 = Keypair.generate();

  let usdcMint: PublicKey;
  let adminTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user3TokenAccount: PublicKey;
  let matchPool: PublicKey;
  let poolTokenAccount: PublicKey;

  const matchId = "MATCH123";
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const registrationEndTime = currentTimestamp + 3600;

  before(async () => {
    // Airdrop SOL to the all accounts

    await provider.connection.requestAirdrop(
      admin.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.requestAirdrop(
      user1.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.requestAirdrop(
      user2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.requestAirdrop(
      user3.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );

    adminTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      admin.publicKey
    );

    user1TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user1,
      usdcMint,
      user1.publicKey
    );

    user2TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user2,
      usdcMint,
      user2.publicKey
    );

    user3TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user3,
      usdcMint,
      user3.publicKey
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminTokenAccount,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      user1TokenAccount,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      user2TokenAccount,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      user3TokenAccount,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    [matchPool] = PublicKey.findProgramAddressSync(
      [Buffer.from("match_pool"), Buffer.from(matchId)],
      program.programId
    );

    [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_token"), Buffer.from(matchId)],
      program.programId
    );
  });

  it("Initializes the match pool", async () => {
    console.log("Initializing match pool...");

    await program.methods
      .initialize(matchId, new BN(registrationEndTime))
      .accounts({
        matchPool,
        poolTokenAccount,
        tokenMint: usdcMint,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();

    console.log("Match pool initialized:", matchPool.toBase58());

    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.admin.toString()).to.equal(
      admin.publicKey.toString()
    );
    expect(matchPoolAccount.matchId).to.equal(matchId);
    expect(matchPoolAccount.registrationEndTime.toNumber()).to.equal(
      registrationEndTime
    );
    expect(matchPoolAccount.totalDeposited.toNumber()).to.equal(0);
    expect(matchPoolAccount.isActive).to.be.true;
    expect(matchPoolAccount.isFinalized).to.be.false;
  });

  it("Allows users to deposit USDC", async () => {
    const user1Balance = await provider.connection.getTokenAccountBalance(
      user1TokenAccount
    );
    console.log("User 1 balance:", user1Balance.value.uiAmount);

    const depositAmount = 10_000_000; // 10 USDC

    // User1 deposits
    await program.methods
      .deposit(new BN(depositAmount))
      .accounts({
        matchPool,
        poolTokenAccount,
        userTokenAccount: user1TokenAccount,
        user: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    // User2 deposits
    await program.methods
      .deposit(new BN(depositAmount))
      .accounts({
        matchPool,
        poolTokenAccount,
        userTokenAccount: user2TokenAccount,
        user: user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    // User3 deposits
    await program.methods
      .deposit(new BN(depositAmount))
      .accounts({
        matchPool,
        poolTokenAccount,
        userTokenAccount: user3TokenAccount,
        user: user3.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user3])
      .rpc();

    // Verify deposits were recorded
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.totalDeposited.toNumber()).to.equal(
      depositAmount * 3
    );

    // Check pool token account balance
    const poolTokenAccountInfo =
      await provider.connection.getTokenAccountBalance(poolTokenAccount);
    expect(poolTokenAccountInfo.value.uiAmount).to.equal(30); // 30 USDC (10 from each user)
  });

  it("Allows user to deposit multiple times", async () => {
    const user1Balance = await provider.connection.getTokenAccountBalance(
      user1TokenAccount
    );
    console.log("User 1 new balance:", user1Balance.value.uiAmount);

    const depositAmount = 10_000_000; // 10 USDC
    const additionalDeposit = 5_000_000; // 5 USDC

    // User1 deposits
    await program.methods
      .deposit(new BN(additionalDeposit))
      .accounts({
        matchPool,
        poolTokenAccount,
        userTokenAccount: user1TokenAccount,
        user: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    // Verify deposits were recorded
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.totalDeposited.toNumber()).to.equal(
      depositAmount * 3 + additionalDeposit
    );

    // Check pool token account balance
    const poolTokenAccountInfo =
      await provider.connection.getTokenAccountBalance(poolTokenAccount);
    expect(poolTokenAccountInfo.value.uiAmount).to.equal(35); // 30 USDC (10 from each user)
  });

  it("Prevents deposits after registration end time", async () => {
    // Create a new match with ended registration
    const pastMatchId = "PASTMATCH";
    const pastEndTime = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

    const [pastMatchPool] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("match_pool"), Buffer.from(pastMatchId)],
      program.programId
    );

    const [pastPoolTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool_token"), Buffer.from(pastMatchId)],
      program.programId
    );

    // Initialize past match
    await program.methods
      .initialize(pastMatchId, new BN(pastEndTime))
      .accounts({
        matchPool: pastMatchPool,
        poolTokenAccount: pastPoolTokenAccount,
        tokenMint: usdcMint,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();

    // Try to deposit after registration end time
    try {
      await program.methods
        .deposit(new BN(1_000_000))
        .accounts({
          matchPool: pastMatchPool,
          poolTokenAccount: pastPoolTokenAccount,
          userTokenAccount: user1TokenAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();
      expect.fail("Expected deposit to fail due to closed registration");
    } catch (error) {
      expect(error.toString()).to.include("RegistrationClosed");
    }
  });

  it("Allows admin to end the match", async () => {
    await program.methods
      .endMatch()
      .accounts({
        matchPool,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Verify match is ended
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.isActive).to.be.false;
  });

  it("Prevents non-admin from ending the match", async () => {
    try {
      await program.methods
        .endMatch()
        .accounts({
          matchPool,
          admin: user1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc();
      expect.fail("Expected endMatch to fail due to unauthorized user");
    } catch (error) {
      expect(error.toString()).to.include("Unauthorized");
    }
  });

  it("Allows admin to distribute prizes", async () => {
    // Calculate prize distributions based on points
    // For testing, we'll give user1 more than they deposited (winner)
    // User2 gets back less (loser), and user3 gets exactly what they put in
    const prizeDistributions = [
      {
        user: user1.publicKey,
        amount: new BN(18_000_000), // 18 USDC (profit of 3 USDC)
      },
      {
        user: user2.publicKey,
        amount: new BN(7_000_000), // 7 USDC (loss of 3 USDC)
      },
      {
        user: user3.publicKey,
        amount: new BN(10_000_000), // 10 USDC (break even)
      },
    ];

    // Get user token accounts before distribution
    const user1BalanceBefore = (
      await provider.connection.getTokenAccountBalance(user1TokenAccount)
    ).value.amount;
    const user2BalanceBefore = (
      await provider.connection.getTokenAccountBalance(user2TokenAccount)
    ).value.amount;
    const user3BalanceBefore = (
      await provider.connection.getTokenAccountBalance(user3TokenAccount)
    ).value.amount;

    // Prepare remaining accounts for prize distribution
    const remainingAccounts = [
      // Include token accounts only - the program now maps users to token accounts
      {
        pubkey: user1TokenAccount,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: user2TokenAccount,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: user3TokenAccount,
        isWritable: true,
        isSigner: false,
      },
    ];

    // Distribute prizes
    await program.methods
      .distributePrizes(prizeDistributions)
      .accounts({
        matchPool,
        poolTokenAccount,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([admin])
      .rpc();

    // Verify match is finalized
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.isFinalized).to.be.true;

    // Verify token balances are updated
    const user1BalanceAfter = (
      await provider.connection.getTokenAccountBalance(user1TokenAccount)
    ).value.amount;
    const user2BalanceAfter = (
      await provider.connection.getTokenAccountBalance(user2TokenAccount)
    ).value.amount;
    const user3BalanceAfter = (
      await provider.connection.getTokenAccountBalance(user3TokenAccount)
    ).value.amount;

    expect(
      new BN(user1BalanceAfter).sub(new BN(user1BalanceBefore)).toNumber()
    ).to.equal(18_000_000);
    expect(
      new BN(user2BalanceAfter).sub(new BN(user2BalanceBefore)).toNumber()
    ).to.equal(7_000_000);
    expect(
      new BN(user3BalanceAfter).sub(new BN(user3BalanceBefore)).toNumber()
    ).to.equal(10_000_000);

    // Verify pool account is empty
    const poolBalance = await provider.connection.getTokenAccountBalance(
      poolTokenAccount
    );
    expect(poolBalance.value.uiAmount).to.equal(0);
  });

  it("Prevents distributing prizes twice", async () => {
    const prizeDistributions = [
      {
        user: user1.publicKey,
        amount: new BN(1_000_000),
      },
    ];

    const remainingAccounts = [
      {
        pubkey: user1TokenAccount,
        isWritable: true,
        isSigner: false,
      },
    ];

    try {
      await program.methods
        .distributePrizes(prizeDistributions)
        .accounts({
          matchPool,
          poolTokenAccount,
          admin: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .signers([admin])
        .rpc();
      expect.fail(
        "Expected distribute prizes to fail because match is already finalized"
      );
    } catch (error) {
      expect(error.toString()).to.include("MatchAlreadyFinalized");
    }
  });
});

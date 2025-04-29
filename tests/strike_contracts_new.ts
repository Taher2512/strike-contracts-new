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
  // Configure the client to use the local cluster.
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
});

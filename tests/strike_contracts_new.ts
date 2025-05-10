import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrikeContractsNew } from "../target/types/strike_contracts_new";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { expect } from "chai";

describe("fantasy_cricket_magicblock", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log(
    "Ephemeral Rollup Connection: ",
    provider.connection._rpcEndpoint
  );

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
      {
        wsEndpoint: process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );
  console.log("Base Layer Connection: ", provider.connection._rpcEndpoint);
  console.log(
    "Ephemeral Rollup Connection: ",
    providerEphemeralRollup.connection._rpcEndpoint
  );
  console.log(`Current SOL Public Key: ${anchor.Wallet.local().publicKey}`);

  const MAGIC_DELEGATION_PROGRAM_ID = new PublicKey(
    "DELEZBvEGJwWYrGQVuFD5RgHhtSQ5E6NMkH47QKbQT3B"
  );
  const MAGIC_CONTEXT_PROGRAM_ID = new PublicKey(
    "ERConuBQSK9PHD3Z4D3B8oz4vxhANJigRBTp9TJRBDce"
  );

  console.log("Connection: ", provider.connection._rpcEndpoint);
  console.log(`Current SOL Public Key: ${provider.wallet.publicKey}`);

  const admin = provider.wallet.payer;

  let usdcMint: PublicKey;
  let adminTokenAccount: PublicKey;
  let matchPool: PublicKey;
  let poolTokenAccount: PublicKey;

  const uniqueId = new Date().getTime().toString().slice(-6);
  const matchId = `MATCH123_${uniqueId}`;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const registrationEndTime = currentTimestamp + 3600;

  const program = anchor.workspace
    .StrikeContractsNew as Program<StrikeContractsNew>;

  before(async () => {
    console.log("Admin public key:", provider.wallet.publicKey.toString());

    usdcMint = await createMint(
      provider.connection,
      admin,
      provider.wallet.publicKey,
      null,
      6
    );

    console.log("USDC mint address:", usdcMint.toString());

    // Create admin token account
    adminTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      provider.wallet.publicKey
    );

    console.log("Admin token account:", adminTokenAccount.toString());

    // Mint some tokens to admin
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminTokenAccount,
      provider.wallet.publicKey,
      100_000_000 // 100 USDC
    );

    // Find PDAs
    [matchPool] = PublicKey.findProgramAddressSync(
      [Buffer.from("match_pool"), Buffer.from(matchId)],
      program.programId
    );

    [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_token"), Buffer.from(matchId)],
      program.programId
    );

    console.log("Match pool address:", matchPool.toString());
    console.log("Pool token account address:", poolTokenAccount.toString());
  });

  it("Initializes the match pool", async () => {
    const start = Date.now();
    console.log("Starting match pool initialization...");

    try {
      let tx = await program.methods
        .initialize(matchId, new BN(registrationEndTime))
        .accounts({
          matchPool,
          poolTokenAccount,
          tokenMint: usdcMint,
          admin: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction();

      tx.feePayer = provider.wallet.publicKey;
      tx.recentBlockhash = (
        await provider.connection.getLatestBlockhash()
      ).blockhash;

      tx = await provider.wallet.signTransaction(tx);

      const txHash = await provider.connection.sendRawTransaction(
        tx.serialize()
      );
      await provider.connection.confirmTransaction(txHash);

      console.log(`Match pool initialization txHash: ${txHash}`);

      const duration = Date.now() - start;
      console.log(`${duration}ms Initialize match pool`);

      const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
      expect(matchPoolAccount.admin.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(matchPoolAccount.matchId).to.equal(matchId);
      expect(matchPoolAccount.totalDeposited.toNumber()).to.equal(0);
      expect(matchPoolAccount.isActive).to.be.true;
    } catch (error) {
      console.error("Error initializing match pool:", error);
      throw error;
    }
  });

  it("Allows admin to deposit USDC", async () => {
    console.log(
      "Admin token balance:",
      await provider.connection
        .getTokenAccountBalance(adminTokenAccount)
        .then((res) => res.value.uiAmount)
    );

    const depositAmount = 10_000_000; // 10 USDC

    console.log("Admin depositing...");
    const start = Date.now();

    try {
      let tx = await program.methods
        .deposit(new BN(depositAmount))
        .accounts({
          matchPool,
          poolTokenAccount,
          userTokenAccount: adminTokenAccount,
          user: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = provider.wallet.publicKey;
      tx.recentBlockhash = (
        await provider.connection.getLatestBlockhash()
      ).blockhash;

      tx = await provider.wallet.signTransaction(tx);

      const txHash = await provider.connection.sendRawTransaction(
        tx.serialize()
      );
      await provider.connection.confirmTransaction(txHash);

      const duration = Date.now() - start;
      console.log(`${duration}ms Admin deposit txHash: ${txHash}`);
    } catch (error) {
      console.error("Deposit error:", error);
      throw error;
    }

    // Verify deposit was recorded
    try {
      const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
      expect(matchPoolAccount.totalDeposited.toNumber()).to.equal(
        depositAmount
      );
    } catch (error) {
      console.error("Error verifying deposit:", error);
    }
  });

  it("Simulates multiple deposits to get enough tokens for distribution", async () => {
    console.log("Making additional deposits...");

    const depositAmount = 10_000_000; // 10 USDC

    try {
      console.log("Making second deposit...");
      const txHash = await program.methods
        .deposit(new BN(depositAmount))
        .accounts({
          matchPool,
          poolTokenAccount,
          userTokenAccount: adminTokenAccount,
          user: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`Second deposit txHash: ${txHash}`);
    } catch (error) {
      console.error("Error in second deposit:", error);
      throw error;
    }

    try {
      console.log("Making third deposit...");
      const txHash = await program.methods
        .deposit(new BN(depositAmount))
        .accounts({
          matchPool,
          poolTokenAccount,
          userTokenAccount: adminTokenAccount,
          user: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`Third deposit txHash: ${txHash}`);
    } catch (error) {
      console.error("Error in third deposit:", error);
      throw error;
    }

    // Verify deposits were recorded
    try {
      const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
      console.log(
        `Total deposited: ${matchPoolAccount.totalDeposited.toNumber()}`
      );
      expect(matchPoolAccount.totalDeposited.toNumber()).to.be.at.least(
        depositAmount
      );

      // Check pool token account balance
      const poolBalance = await provider.connection.getTokenAccountBalance(
        poolTokenAccount
      );
      console.log(`Pool balance: ${poolBalance.value.uiAmount} USDC`);
    } catch (error) {
      console.error("Error verifying deposits:", error);
    }
  });

  it("Allows admin to end the match", async () => {
    console.log("Ending match...");

    try {
      const txHash = await program.methods
        .endMatch()
        .accounts({
          matchPool,
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`End match txHash: ${txHash}`);
    } catch (error) {
      console.error("End match error:", error);
      throw error;
    }

    // Verify match is ended
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.isActive).to.be.false;
  });

  it("Distributes prizes", async () => {
    console.log("Distributing prizes to participants...");

    const prizeDistributions = [
      {
        user: provider.wallet.publicKey,
        amount: new BN(30_000_000), // 30 USDC (All deposits)
      },
    ];

    const remainingAccounts = [
      {
        pubkey: adminTokenAccount,
        isWritable: true,
        isSigner: false,
      },
    ];

    try {
      const txHash = await program.methods
        .distributePrizes(prizeDistributions)
        .accounts({
          matchPool,
          poolTokenAccount,
          admin: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      console.log(`Base layer distribute prizes txHash: ${txHash}`);
    } catch (error) {
      console.error("Distribute prizes error:", error);
      throw error;
    }

    // Verify match is finalized
    const matchPoolAccount = await program.account.matchPool.fetch(matchPool);
    expect(matchPoolAccount.isFinalized).to.be.true;

    // Verify admin received the prizes
    const adminBalance = (
      await provider.connection.getTokenAccountBalance(adminTokenAccount)
    ).value.uiAmount;
    console.log(`Final admin token balance: ${adminBalance} USDC`);

    // Check pool account is empty
    const poolBalance = await provider.connection.getTokenAccountBalance(
      poolTokenAccount
    );
    expect(poolBalance.value.uiAmount).to.equal(0);
  });
});

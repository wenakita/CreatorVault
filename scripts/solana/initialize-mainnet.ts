#!/usr/bin/env tsx

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// MAINNET CONFIGURATION
const MAINNET_RPC = process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";
const LZ_ENDPOINT_MAINNET = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");

// Program ID will be set after deployment
const PROGRAM_ID_ENV = process.env.SOLANA_PROGRAM_ID;
if (!PROGRAM_ID_ENV) {
  console.error("❌ Error: SOLANA_PROGRAM_ID environment variable not set");
  console.log("   Set it with: export SOLANA_PROGRAM_ID=<your_program_id>");
  process.exit(1);
}
const PROGRAM_ID = new PublicKey(PROGRAM_ID_ENV);

// Calculate Anchor discriminator
function getInstructionDiscriminator(name: string): Buffer {
  const preimage = `global:${name}`;
  const hash = sha256(Buffer.from(preimage));
  return Buffer.from(hash.slice(0, 8));
}

async function initialize() {
  console.log("🚀 Eagle Registry Solana - MAINNET Initialization");
  console.log("⚠️  WARNING: DEPLOYING TO MAINNET - REAL SOL REQUIRED");
  console.log("");

  // Load wallet
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("❌ Wallet not found at:", walletPath);
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("👛 Wallet:", walletKeypair.publicKey.toBase58());

  // Create connection
  const connection = new Connection(MAINNET_RPC, "confirmed");

  try {
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("💰 Balance:", balance / 1e9, "SOL");

    if (balance < 0.01e9) {
      console.error("\n❌ Insufficient balance for mainnet deployment");
      console.log("   Minimum recommended: 0.05 SOL");
      process.exit(1);
    }
  } catch (err) {
    console.log("💰 Balance: (unable to fetch)");
  }

  console.log("");

  // Find Registry PDA
  const [registryPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    PROGRAM_ID
  );

  console.log("📍 Accounts:");
  console.log("   Network: MAINNET-BETA");
  console.log("   RPC:", MAINNET_RPC);
  console.log("   Program ID:", PROGRAM_ID.toBase58());
  console.log("   Registry PDA:", registryPda.toBase58());
  console.log("   Bump:", bump);
  console.log("   LZ Endpoint:", LZ_ENDPOINT_MAINNET.toBase58());
  console.log("");

  // Check if already initialized
  try {
    const accountInfo = await connection.getAccountInfo(registryPda);
    if (accountInfo && accountInfo.data.length > 0) {
      console.log("✅ Registry already initialized on mainnet!");
      console.log("   Account size:", accountInfo.data.length, "bytes");
      console.log("   Owner:", accountInfo.owner.toBase58());
      console.log("");
      console.log("View on Explorer:");
      console.log(`https://explorer.solana.com/address/${registryPda.toBase58()}`);
      return;
    }
  } catch (err) {
    console.log("⚠️  Registry not yet initialized");
  }

  console.log("");
  console.log("🔧 Building initialize instruction...");

  // Build instruction data
  const discriminator = getInstructionDiscriminator("initialize");
  const lzEndpointBuffer = Buffer.from(LZ_ENDPOINT_MAINNET.toBytes());
  const data = Buffer.concat([discriminator, lzEndpointBuffer]);

  console.log("📦 Instruction discriminator:", discriminator.toString("hex"));
  console.log("📦 Full instruction data:", data.toString("hex"));
  console.log("");

  // Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: registryPda, isSigner: false, isWritable: true },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  // Create transaction
  const transaction = new Transaction().add(instruction);

  console.log("⚠️  FINAL CONFIRMATION REQUIRED");
  console.log("   This will initialize the registry on MAINNET");
  console.log("   Cost: ~0.01 SOL + transaction fees");
  console.log("");
  console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...");

  // 5 second delay
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("");
  console.log("📤 Sending transaction to MAINNET...");

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    console.log("");
    console.log("✅ Registry initialized on MAINNET!");
    console.log("📝 Transaction:", signature);
    console.log("");
    console.log("View on Explorer:");
    console.log(`https://explorer.solana.com/tx/${signature}`);
    console.log(`https://solscan.io/tx/${signature}`);
    console.log("");
    console.log("Registry PDA:");
    console.log(`https://explorer.solana.com/address/${registryPda.toBase58()}`);
  } catch (err: any) {
    console.error("\n❌ Initialization failed:", err.message);
    
    if (err.logs) {
      console.log("\n📋 Program Logs:");
      err.logs.forEach((log: string) => console.log("   ", log));
    }
    
    process.exit(1);
  }
}

// Run with safety prompt
console.log("");
console.log("═══════════════════════════════════════════════════════");
console.log("  ⚠️  MAINNET DEPLOYMENT - REAL SOL REQUIRED  ⚠️");
console.log("═══════════════════════════════════════════════════════");
console.log("");

initialize().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});


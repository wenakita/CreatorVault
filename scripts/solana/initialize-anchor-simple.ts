#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_ID = new PublicKey("7wSrZXHF6BguZ1qwkXdZcNf3qyV2MPNvcztQLwrh9qPJ");
const DEVNET_RPC = "https://api.devnet.solana.com";
const LZ_ENDPOINT = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");

async function main() {
  console.log("🚀 Eagle Registry Solana - Anchor Initialization\n");

  // Load wallet
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("👛 Wallet:", walletKeypair.publicKey.toBase58());

  // Setup provider
  const connection = new anchor.web3.Connection(DEVNET_RPC, "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL\n");

  // Find registry PDA
  const [registryPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    PROGRAM_ID
  );

  console.log("📍 Accounts:");
  console.log("   Program ID:", PROGRAM_ID.toBase58());
  console.log("   Registry PDA:", registryPda.toBase58());
  console.log("   Bump:", bump);
  console.log("   LZ Endpoint:", LZ_ENDPOINT.toBase58());
  console.log("");

  // Load IDL
  const idlPath = path.join(__dirname, "../../target/idl/eagle_registry_solana.json");
  if (!fs.existsSync(idlPath)) {
    console.error("❌ IDL not found at:", idlPath);
    console.log("\n💡 Run: anchor build");
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // Ensure IDL has correct metadata
  if (!idl.metadata) {
    idl.metadata = { address: PROGRAM_ID.toBase58() };
  } else {
    idl.metadata.address = PROGRAM_ID.toBase58();
  }

  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  console.log("📤 Initializing registry...\n");

  try {
    const tx = await program.methods
      .initialize(LZ_ENDPOINT)
      .accounts({
        registryConfig: registryPda,
        authority: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    console.log("✅ Registry initialized!");
    console.log("📝 Transaction:", tx);
    console.log("");
    console.log("View on Solscan:");
    console.log(`https://solscan.io/tx/${tx}?cluster=devnet`);
  } catch (err: any) {
    console.error("❌ Initialization failed:", err.message);
    if (err.logs) {
      console.log("\n📋 Program Logs:");
      err.logs.forEach((log: string) => console.log("   ", log));
    }
    process.exit(1);
  }
}

main().catch(console.error);


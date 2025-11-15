#!/usr/bin/env tsx

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

async function requestAirdrop() {
  console.log("💧 Requesting SOL Airdrop on Devnet\n");

  // Load wallet
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("❌ Wallet not found at:", walletPath);
    console.log("   Run: npm run recover");
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("👛 Wallet:", walletKeypair.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  try {
    // Check current balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("💰 Current Balance:", balance / LAMPORTS_PER_SOL, "SOL");

    if (balance >= 0.5 * LAMPORTS_PER_SOL) {
      console.log("\n✅ Sufficient balance! You can proceed with initialization.");
      console.log("   Run: npm run initialize:simple");
      return;
    }

    console.log("\n🚰 Requesting airdrop (2 SOL)...");
    
    // Request airdrop
    const signature = await connection.requestAirdrop(
      walletKeypair.publicKey,
      2 * LAMPORTS_PER_SOL
    );

    console.log("📝 Airdrop Signature:", signature);
    console.log("⏳ Confirming...");

    // Wait for confirmation
    await connection.confirmTransaction(signature);

    // Check new balance
    const newBalance = await connection.getBalance(walletKeypair.publicKey);
    console.log("\n✅ Airdrop successful!");
    console.log("💰 New Balance:", newBalance / LAMPORTS_PER_SOL, "SOL");
    console.log("\nNext steps:");
    console.log("  npm run initialize:simple");

  } catch (err: any) {
    console.error("\n❌ Airdrop failed:", err.message);
    console.log("\n💡 Alternative: Use web faucet");
    console.log("   https://faucet.solana.com/");
    console.log("   Wallet:", walletKeypair.publicKey.toBase58());
    process.exit(1);
  }
}

requestAirdrop();


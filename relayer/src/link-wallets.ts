#!/usr/bin/env tsx

import fs from "fs";
import { PublicKey } from "@solana/web3.js";

// Simple CLI tool to link Ethereum and Solana wallets

interface UserMapping {
  [ethAddress: string]: string;
}

const MAPPINGS_FILE = "./user-mappings.json";

function loadMappings(): UserMapping {
  if (fs.existsSync(MAPPINGS_FILE)) {
    return JSON.parse(fs.readFileSync(MAPPINGS_FILE, "utf-8"));
  }
  return {};
}

function saveMappings(mappings: UserMapping) {
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

function linkWallet(ethAddress: string, solanaAddress: string) {
  // Validate Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
    console.error("❌ Invalid Ethereum address");
    process.exit(1);
  }

  // Validate Solana address
  try {
    new PublicKey(solanaAddress);
  } catch {
    console.error("❌ Invalid Solana address");
    process.exit(1);
  }

  const mappings = loadMappings();
  mappings[ethAddress.toLowerCase()] = solanaAddress;
  saveMappings(mappings);

  console.log("✅ Wallets linked!");
  console.log(`   Ethereum: ${ethAddress}`);
  console.log(`   Solana:   ${solanaAddress}`);
}

function listMappings() {
  const mappings = loadMappings();
  const count = Object.keys(mappings).length;
  
  console.log(`\n📋 Total linked wallets: ${count}\n`);
  
  if (count === 0) {
    console.log("No wallets linked yet.");
    return;
  }

  let i = 1;
  for (const [eth, sol] of Object.entries(mappings)) {
    console.log(`${i}. ${eth} → ${sol}`);
    i++;
  }
}

function unlinkWallet(ethAddress: string) {
  const mappings = loadMappings();
  
  if (!mappings[ethAddress.toLowerCase()]) {
    console.error("❌ Wallet not found");
    process.exit(1);
  }

  delete mappings[ethAddress.toLowerCase()];
  saveMappings(mappings);

  console.log("✅ Wallet unlinked!");
}

// CLI
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "link":
    if (args.length !== 2) {
      console.log("Usage: npm run link link <ETH_ADDRESS> <SOLANA_ADDRESS>");
      console.log("Example: npm run link link 0x742d35... 7Qi3WW7q4kmqXcMBca76...");
      process.exit(1);
    }
    linkWallet(args[0], args[1]);
    break;

  case "list":
    listMappings();
    break;

  case "unlink":
    if (args.length !== 1) {
      console.log("Usage: npm run link unlink <ETH_ADDRESS>");
      process.exit(1);
    }
    unlinkWallet(args[0]);
    break;

  default:
    console.log("EAGLE Bridge - Wallet Linking Tool");
    console.log("");
    console.log("Commands:");
    console.log("  link <ETH> <SOL>    Link Ethereum to Solana wallet");
    console.log("  list                List all linked wallets");
    console.log("  unlink <ETH>        Unlink a wallet");
    console.log("");
    console.log("Examples:");
    console.log("  npm run link link 0x742d35... 7Qi3WW7q4kmqX...");
    console.log("  npm run link list");
    console.log("  npm run link unlink 0x742d35...");
}


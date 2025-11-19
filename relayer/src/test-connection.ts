#!/usr/bin/env tsx

import { Connection, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const ETHEREUM_RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY";
const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const EAGLE_SHARE_OFT = process.env.EAGLE_SHARE_OFT_ADDRESS || "0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E";
const SOLANA_MINT = new PublicKey(process.env.SOLANA_MINT || "5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j");

async function testConnections() {
  console.log("🧪 Testing Bridge Connections\n");
  console.log("=" .repeat(50));

  // Test Ethereum connection
  console.log("\n📡 Testing Ethereum Connection...");
  try {
    const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_RPC);
    const blockNumber = await ethProvider.getBlockNumber();
    console.log(`✅ Connected to Ethereum`);
    console.log(`   RPC: ${ETHEREUM_RPC}`);
    console.log(`   Block: ${blockNumber}`);
    
    // Check EAGLE contract
    const abi = ["function totalSupply() view returns (uint256)"];
    const contract = new ethers.Contract(EAGLE_SHARE_OFT, abi, ethProvider);
    const totalSupply = await contract.totalSupply();
    console.log(`   EAGLE Total Supply: ${ethers.formatUnits(totalSupply, 18)}`);
    
  } catch (error: any) {
    console.log(`❌ Ethereum connection failed: ${error.message}`);
  }

  // Test Solana connection
  console.log("\n📡 Testing Solana Connection...");
  try {
    const solConnection = new Connection(SOLANA_RPC, "confirmed");
    const version = await solConnection.getVersion();
    console.log(`✅ Connected to Solana`);
    console.log(`   RPC: ${SOLANA_RPC}`);
    console.log(`   Version: ${version["solana-core"]}`);
    
    // Check mint
    const mintInfo = await solConnection.getParsedAccountInfo(SOLANA_MINT);
    if (mintInfo.value?.data && "parsed" in mintInfo.value.data) {
      const decimals = mintInfo.value.data.parsed.info.decimals;
      const supply = mintInfo.value.data.parsed.info.supply;
      console.log(`   EAGLE Mint: ${SOLANA_MINT.toBase58()}`);
      console.log(`   Decimals: ${decimals}`);
      console.log(`   Supply: ${supply / Math.pow(10, decimals)} EAGLE`);
    }
    
  } catch (error: any) {
    console.log(`❌ Solana connection failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Connection test complete!\n");
}

testConnections().catch(console.error);


#!/usr/bin/env tsx

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { ethers } from "ethers";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const ETHEREUM_RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY";
const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

const COMPOSER_ADDRESS = "0x4b56aF8c46088175237C6A9C951FbF24F75cDe53"; // EagleOVaultComposer
const SOLANA_PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID || "11111111111111111111111111111112");
const SOLANA_MINT = new PublicKey(process.env.SOLANA_MINT || "11111111111111111111111111111112");

// ============================================================================
// Ethereum Watcher
// ============================================================================

class EthereumWatcher {
    private provider: ethers.JsonRpcProvider;
    private composer: ethers.Contract;
    private lastBlock: number = 0;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);
        
        // EagleOVaultComposer ABI (Deposit event only)
        const composerAbi = [
            "event Deposit(address indexed user, uint256 wlfiAmount, uint256 eagleAmount, uint256 timestamp)"
        ];
        
        this.composer = new ethers.Contract(COMPOSER_ADDRESS, composerAbi, this.provider);
    }

    async start(onDeposit: (user: string, eagleAmount: bigint) => Promise<void>) {
        console.log("🔍 Watching Ethereum for deposits...");
        console.log(`   Composer: ${COMPOSER_ADDRESS}`);
        
        // Get current block
        this.lastBlock = await this.provider.getBlockNumber();
        console.log(`   Starting from block: ${this.lastBlock}`);

        // Watch for Deposit events
        this.composer.on("Deposit", async (user, wlfiAmount, eagleAmount, timestamp, event) => {
            console.log("\n✅ Deposit detected!");
            console.log(`   User: ${user}`);
            console.log(`   EAGLE Amount: ${ethers.formatUnits(eagleAmount, 18)}`);
            console.log(`   Block: ${event.log.blockNumber}`);
            
            try {
                await onDeposit(user, eagleAmount);
            } catch (error) {
                console.error("❌ Failed to process deposit:", error);
            }
        });

        // Keep process alive
        console.log("\n✨ Relayer is running...\n");
    }
}

// ============================================================================
// Solana Bridge
// ============================================================================

class SolanaBridge {
    private connection: Connection;
    private provider: AnchorProvider;
    private program: Program;
    private configPda: PublicKey;

    constructor(relayerKeypair: Keypair) {
        this.connection = new Connection(SOLANA_RPC, "confirmed");
        const wallet = new Wallet(relayerKeypair);
        this.provider = new AnchorProvider(this.connection, wallet, { commitment: "confirmed" });

        // Load IDL
        const idlPath = "../target/idl/eagle_share_oft_minimal.json";
        const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
        this.program = new Program(idl, this.provider);

        // Derive config PDA
        [this.configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], SOLANA_PROGRAM_ID);
    }

    async mintToUser(ethereumAddress: string, amount: bigint): Promise<void> {
        console.log("\n🌉 Bridging to Solana...");

        // Convert Ethereum address to Solana pubkey (you'll need a mapping database)
        const solanaAddress = await this.getSolanaAddressForEthUser(ethereumAddress);
        if (!solanaAddress) {
            console.log("⚠️  No Solana wallet linked for user:", ethereumAddress);
            return;
        }

        console.log(`   Solana recipient: ${solanaAddress.toBase58()}`);

        // Get or create associated token account
        const ata = await getAssociatedTokenAddress(SOLANA_MINT, solanaAddress);
        
        try {
            await this.connection.getAccountInfo(ata);
        } catch {
            console.log("   Creating token account...");
            const ix = createAssociatedTokenAccountInstruction(
                this.provider.wallet.publicKey,
                ata,
                solanaAddress,
                SOLANA_MINT
            );
            // Send transaction (omitted for brevity - you'd use program.provider.sendAndConfirm)
        }

        // Mint EAGLE shares
        console.log(`   Minting ${ethers.formatUnits(amount, 9)} EAGLE...`);
        
        const tx = await this.program.methods
            .mint(amount)
            .accounts({
                config: this.configPda,
                mint: SOLANA_MINT,
                to: ata,
                authority: this.provider.wallet.publicKey,
            })
            .rpc();

        console.log("✅ Minted on Solana!");
        console.log(`   Signature: ${tx}`);
        console.log(`   Explorer: https://solscan.io/tx/${tx}`);
    }

    /**
     * Get Solana address for Ethereum user
     * This would query your database/mapping service
     */
    private async getSolanaAddressForEthUser(ethAddress: string): Promise<PublicKey | null> {
        // TODO: Implement database lookup
        // For now, return null (you'll need to build a user mapping system)
        console.log("⚠️  User mapping not implemented yet");
        console.log("   Users need to link their Solana wallet on your frontend");
        return null;
    }
}

// ============================================================================
// Solana Burn Watcher (for redeems)
// ============================================================================

class SolanaBurnWatcher {
    private connection: Connection;
    private programId: PublicKey;

    constructor() {
        this.connection = new Connection(SOLANA_RPC, "confirmed");
        this.programId = SOLANA_PROGRAM_ID;
    }

    async start(onBurn: (user: string, amount: bigint) => Promise<void>) {
        console.log("🔍 Watching Solana for burns (redeems)...");
        console.log(`   Program: ${this.programId.toBase58()}`);

        // Subscribe to program logs
        this.connection.onLogs(
            this.programId,
            async (logs) => {
                // Parse burn events from logs
                const burnLog = logs.logs.find(log => log.includes("Burned"));
                if (burnLog) {
                    // Extract user and amount (you'd parse this properly)
                    console.log("\n🔥 Burn detected!");
                    console.log(`   ${burnLog}`);
                    
                    // TODO: Parse user address and amount
                    // TODO: Call onBurn callback to trigger Ethereum redeem
                }
            },
            "confirmed"
        );
    }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log("============================================");
    console.log("  EAGLE Hybrid Relayer");
    console.log("============================================");
    console.log("");

    // Load relayer keypair
    const relayerKeypairPath = process.env.RELAYER_KEYPAIR || `${process.env.HOME}/.config/solana/relayer.json`;
    if (!fs.existsSync(relayerKeypairPath)) {
        console.error("❌ Relayer keypair not found!");
        console.error(`   Expected at: ${relayerKeypairPath}`);
        console.error("   Generate one with: solana-keygen new -o ~/.config/solana/relayer.json");
        process.exit(1);
    }

    const relayerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(relayerKeypairPath, "utf-8")))
    );

    console.log("Relayer wallet:", relayerKeypair.publicKey.toBase58());
    console.log("");

    // Initialize components
    const ethWatcher = new EthereumWatcher();
    const solanaBridge = new SolanaBridge(relayerKeypair);
    const solanaBurnWatcher = new SolanaBurnWatcher();

    // Start watching Ethereum deposits
    await ethWatcher.start(async (user, eagleAmount) => {
        await solanaBridge.mintToUser(user, eagleAmount);
    });

    // Start watching Solana burns (for redeems)
    await solanaBurnWatcher.start(async (user, amount) => {
        console.log(`\n🔥 User ${user} wants to redeem ${amount} EAGLE`);
        console.log("   TODO: Trigger Ethereum redeem via Safe or direct call");
        // You'd call the EagleOVaultComposer.redeem() here
    });
}

main().catch(console.error);


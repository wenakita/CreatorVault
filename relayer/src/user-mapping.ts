#!/usr/bin/env tsx

import { PublicKey } from "@solana/web3.js";
import fs from "fs";

/**
 * User Mapping Database
 * Links Ethereum addresses to Solana addresses
 * 
 * In production, use PostgreSQL/MongoDB/Redis
 * For now, use a simple JSON file
 */

interface UserMapping {
    ethereumAddress: string;
    solanaAddress: string;
    createdAt: number;
}

export class UserMappingService {
    private dbPath: string;
    private mappings: Map<string, string>; // eth -> solana

    constructor(dbPath: string = "./user-mappings.json") {
        this.dbPath = dbPath;
        this.mappings = new Map();
        this.load();
    }

    /**
     * Link Ethereum address to Solana address
     */
    async link(ethereumAddress: string, solanaAddress: string): Promise<void> {
        // Validate inputs
        if (!/^0x[a-fA-F0-9]{40}$/.test(ethereumAddress)) {
            throw new Error("Invalid Ethereum address");
        }

        try {
            new PublicKey(solanaAddress);
        } catch {
            throw new Error("Invalid Solana address");
        }

        // Store mapping (lowercase for case-insensitive lookup)
        this.mappings.set(ethereumAddress.toLowerCase(), solanaAddress);
        
        // Save to disk
        this.save();

        console.log(`✅ Linked ${ethereumAddress} -> ${solanaAddress}`);
    }

    /**
     * Get Solana address for Ethereum address
     */
    getSolanaAddress(ethereumAddress: string): PublicKey | null {
        const solanaAddress = this.mappings.get(ethereumAddress.toLowerCase());
        if (!solanaAddress) {
            return null;
        }
        return new PublicKey(solanaAddress);
    }

    /**
     * Get Ethereum address for Solana address
     */
    getEthereumAddress(solanaAddress: string): string | null {
        for (const [eth, sol] of this.mappings.entries()) {
            if (sol === solanaAddress) {
                return eth;
            }
        }
        return null;
    }

    /**
     * Remove mapping
     */
    unlink(ethereumAddress: string): void {
        this.mappings.delete(ethereumAddress.toLowerCase());
        this.save();
    }

    /**
     * Get all mappings
     */
    getAllMappings(): UserMapping[] {
        const result: UserMapping[] = [];
        for (const [eth, sol] of this.mappings.entries()) {
            result.push({
                ethereumAddress: eth,
                solanaAddress: sol,
                createdAt: Date.now(), // Would be stored in real DB
            });
        }
        return result;
    }

    /**
     * Load mappings from disk
     */
    private load(): void {
        if (!fs.existsSync(this.dbPath)) {
            console.log("📁 No existing user mappings found");
            return;
        }

        try {
            const data = JSON.parse(fs.readFileSync(this.dbPath, "utf-8"));
            this.mappings = new Map(Object.entries(data));
            console.log(`📁 Loaded ${this.mappings.size} user mappings`);
        } catch (error) {
            console.error("❌ Failed to load user mappings:", error);
        }
    }

    /**
     * Save mappings to disk
     */
    private save(): void {
        try {
            const data = Object.fromEntries(this.mappings);
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error("❌ Failed to save user mappings:", error);
        }
    }
}

// ============================================================================
// API Server (Express) - Optional
// ============================================================================

/**
 * Simple HTTP server for users to link their wallets
 * 
 * POST /link
 * {
 *   "ethereumAddress": "0x...",
 *   "solanaAddress": "...",
 *   "signature": "..." // Signed message proving ownership
 * }
 */
export function createMappingAPI(mappingService: UserMappingService) {
    // TODO: Add Express server for frontend to call
    // For now, users can link via admin command or frontend direct call
}

// ============================================================================
// CLI Tool
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
    const service = new UserMappingService();
    
    const [command, ...args] = process.argv.slice(2);

    switch (command) {
        case "link":
            if (args.length !== 2) {
                console.log("Usage: tsx user-mapping.ts link <ETH_ADDRESS> <SOLANA_ADDRESS>");
                process.exit(1);
            }
            await service.link(args[0], args[1]);
            break;

        case "get":
            if (args.length !== 1) {
                console.log("Usage: tsx user-mapping.ts get <ETH_ADDRESS>");
                process.exit(1);
            }
            const sol = service.getSolanaAddress(args[0]);
            if (sol) {
                console.log(`Solana: ${sol.toBase58()}`);
            } else {
                console.log("No mapping found");
            }
            break;

        case "list":
            const mappings = service.getAllMappings();
            console.log(`\nTotal mappings: ${mappings.length}\n`);
            mappings.forEach((m, i) => {
                console.log(`${i + 1}. ${m.ethereumAddress} -> ${m.solanaAddress}`);
            });
            break;

        case "unlink":
            if (args.length !== 1) {
                console.log("Usage: tsx user-mapping.ts unlink <ETH_ADDRESS>");
                process.exit(1);
            }
            service.unlink(args[0]);
            console.log("✅ Unlinked");
            break;

        default:
            console.log("Eagle Hybrid Relayer - User Mapping Tool");
            console.log("");
            console.log("Commands:");
            console.log("  link <ETH> <SOL>  Link Ethereum to Solana address");
            console.log("  get <ETH>         Get Solana address for Ethereum address");
            console.log("  list              List all mappings");
            console.log("  unlink <ETH>      Remove mapping");
            console.log("");
            console.log("Examples:");
            console.log("  tsx user-mapping.ts link 0x123... 7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY");
            console.log("  tsx user-mapping.ts get 0x123...");
            console.log("  tsx user-mapping.ts list");
    }
}


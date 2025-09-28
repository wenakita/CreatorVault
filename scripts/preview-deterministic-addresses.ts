import { ethers } from "hardhat";

/**
 * Preview Deterministic Addresses 
 * Shows what addresses will be deployed across all chains BEFORE deployment
 */

interface ChainConfig {
    chainId: number;
    eid: number;
    name: string;
    endpointV2: string;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
    ethereum: { chainId: 1, eid: 30101, name: "ethereum", endpointV2: "0x1a44076050125825900e736c501f859c50fE728c" },
    arbitrum: { chainId: 42161, eid: 30110, name: "arbitrum", endpointV2: "0x1a44076050125825900e736c501f859c50fE728c" },
    base: { chainId: 8453, eid: 30184, name: "base", endpointV2: "0x1a44076050125825900e736c501f859c50fE728c" },
    bsc: { chainId: 56, eid: 30102, name: "bsc", endpointV2: "0x1a44076050125825900e736c501f859c50fE728c" }
};

const CREATE2_FACTORY = "0x472656c76f45E8a8a63FffD32aB5888898EeA91E";
const REGISTRY_ADDRESS = "0x472656c76f45E8a8a63FffD32aB5888898EeA91E";

const DEPLOYMENT_SALTS = {
    eagle: "0xe0000000023e5f2f0000000000000000000000000000000000000000000000000", // Your vanity salt
    wlfiOFT: "0x0000000000000000000000000000000000000000000000000000000000000001",
    usd1OFT: "0x0000000000000000000000000000000000000000000000000000000000000002",
};

async function calculateCreate2Address(
    contractPath: string,
    constructorArgs: any[],
    argTypes: string[],
    salt: string
): Promise<string> {
    
    const ContractFactory = await ethers.getContractFactory(contractPath);
    
    const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        argTypes,
        constructorArgs
    );
    
    const fullBytecode = ethers.concat([
        ContractFactory.bytecode,
        encodedArgs
    ]);
    
    const bytecodeHash = ethers.keccak256(fullBytecode);
    
    return ethers.getCreate2Address(
        CREATE2_FACTORY,
        salt,
        bytecodeHash
    );
}

async function previewDeterministicAddresses() {
    console.log("🔮 DETERMINISTIC ADDRESS PREVIEW");
    console.log("================================");
    console.log(`Factory: ${CREATE2_FACTORY}`);
    console.log(`Registry: ${REGISTRY_ADDRESS}\n`);
    
    // Calculate addresses for each contract type
    const contracts = [
        {
            name: "EagleShareOFT ($EAGLE)",
            path: "contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT",
            salt: DEPLOYMENT_SALTS.eagle,
            constructorTemplate: ["Eagle", "EAGLE", REGISTRY_ADDRESS, "DEPLOYER"],
            argTypes: ["string", "string", "address", "address"],
            note: "🎯 SAME ADDRESS ON ALL CHAINS (registry-based)"
        },
        {
            name: "WLFIAssetOFT",
            path: "contracts/layerzero-ovault/oft/WLFIAssetOFT.sol:WLFIAssetOFT", 
            salt: DEPLOYMENT_SALTS.wlfiOFT,
            constructorTemplate: ["Wrapped LFI", "WLFI", "ENDPOINT", "DEPLOYER"],
            argTypes: ["string", "string", "address", "address"],
            note: "⚡ Different addresses per chain (endpoint-based)"
        },
        {
            name: "USD1AssetOFT", 
            path: "contracts/layerzero-ovault/oft/USD1AssetOFT.sol:USD1AssetOFT",
            salt: DEPLOYMENT_SALTS.usd1OFT,
            constructorTemplate: ["USD1 Stablecoin", "USD1", "ENDPOINT", "DEPLOYER"],
            argTypes: ["string", "string", "address", "address"],
            note: "⚡ Different addresses per chain (endpoint-based)"
        }
    ];
    
    for (const contract of contracts) {
        console.log(`📋 ${contract.name}`);
        console.log(`   ${contract.note}`);
        console.log(`   Salt: ${contract.salt}`);
        console.log("   ─".repeat(70));
        
        const addressesByChain: Record<string, string> = {};
        let hasSameAddress = true;
        let firstAddress: string | null = null;
        
        for (const [chainName, chainConfig] of Object.entries(CHAIN_CONFIGS)) {
            try {
                // Replace template values with actual values
                let constructorArgs = contract.constructorTemplate.map(arg => {
                    switch (arg) {
                        case "ENDPOINT": return chainConfig.endpointV2;
                        case "DEPLOYER": return ethers.ZeroAddress; // Placeholder
                        default: return arg;
                    }
                });
                
                const address = await calculateCreate2Address(
                    contract.path,
                    constructorArgs,
                    contract.argTypes,
                    contract.salt
                );
                
                addressesByChain[chainName] = address;
                
                if (firstAddress === null) {
                    firstAddress = address;
                } else if (address !== firstAddress) {
                    hasSameAddress = false;
                }
                
                console.log(`   ${chainName.padEnd(10)}: ${address}`);
                
            } catch (error) {
                console.log(`   ${chainName.padEnd(10)}: ❌ Could not calculate`);
                hasSameAddress = false;
            }
        }
        
        if (hasSameAddress && firstAddress) {
            console.log(`   🎯 Result: IDENTICAL address across all chains`);
        } else {
            console.log(`   ⚡ Result: Different addresses per chain (as expected)`);
        }
        
        console.log("");
    }
    
    // Special note about EagleOVault
    console.log("📋 EagleOVault (Hub Chain Only)");
    console.log("   🏠 Deployed only on Ethereum (hub chain)");
    console.log("   ⚡ Uses regular deployment (not deterministic)");
    console.log("   📍 Address will be different from OFT contracts");
    console.log("");
    
    // Verification section
    console.log("🔍 VERIFICATION CHECKLIST");
    console.log("=========================");
    
    const uniqueAddresses = new Set();
    let eagleAddress = "";
    
    for (const [chainName, chainConfig] of Object.entries(CHAIN_CONFIGS)) {
        try {
            const address = await calculateCreate2Address(
                "contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT",
                ["Eagle", "EAGLE", REGISTRY_ADDRESS, ethers.ZeroAddress],
                ["string", "string", "address", "address"],
                DEPLOYMENT_SALTS.eagle
            );
            uniqueAddresses.add(address);
            if (!eagleAddress) eagleAddress = address;
        } catch (error) {
            console.log(`⚠️ Could not verify ${chainName}`);
        }
    }
    
    if (uniqueAddresses.size === 1) {
        console.log("✅ EagleShareOFT will have SAME address on all chains");
        console.log(`🎯 Your $EAGLE address: ${eagleAddress}`);
        
        // Check if it starts with 0x47 and ends with EA91E (vanity check)
        if (eagleAddress.startsWith("0x47") && eagleAddress.toLowerCase().endsWith("ea91e")) {
            console.log("🎉 VANITY ADDRESS CONFIRMED! (0x47...EA91E)");
        } else {
            console.log("ℹ️ Not a vanity address (update salt if needed)");
        }
    } else {
        console.log("❌ EagleShareOFT addresses will be DIFFERENT across chains");
        console.log("   Check registry address and constructor consistency");
    }
    
    console.log("\n🚀 DEPLOYMENT COMMANDS:");
    console.log("=======================");
    console.log("# Deploy deterministic system on all chains:");
    console.log("npx hardhat run scripts/deploy-all-deterministic.ts --network ethereum");
    console.log("npx hardhat run scripts/deploy-all-deterministic.ts --network arbitrum");
    console.log("npx hardhat run scripts/deploy-all-deterministic.ts --network base");
    console.log("npx hardhat run scripts/deploy-all-deterministic.ts --network bsc");
    console.log("");
    console.log("# Verify addresses are consistent:");
    console.log("npx hardhat run scripts/verify-deterministic-addresses.ts");
    console.log("");
    console.log("# Configure cross-chain wiring:");
    console.log("bash scripts/wire-all-chains.sh");
    
    console.log("\n💡 BENEFITS OF DETERMINISTIC DEPLOYMENT:");
    console.log("========================================");
    console.log("✅ Same $EAGLE address across all chains");
    console.log("✅ Predictable addresses for frontend integration");
    console.log("✅ Users see consistent addresses in wallets");
    console.log("✅ Simplified cross-chain UX");
    console.log("✅ No address confusion or mistakes");
}

async function main() {
    try {
        await previewDeterministicAddresses();
        
    } catch (error) {
        console.error("❌ Preview failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Unexpected error:", error);
        process.exit(1);
    });

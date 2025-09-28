import { ethers } from "hardhat";
import { readFileSync, existsSync } from "fs";

/**
 * Verify Deterministic Address Consistency
 * Checks that same contracts have identical addresses across all chains
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

async function loadDeployedAddresses() {
    const addressFile = "deterministic-addresses.json";
    
    if (!existsSync(addressFile)) {
        throw new Error(`Address file not found: ${addressFile}. Deploy contracts first.`);
    }
    
    return JSON.parse(readFileSync(addressFile, "utf8"));
}

async function predictAddressOnChain(chainName: string, contractType: string): Promise<string | null> {
    const chainConfig = CHAIN_CONFIGS[chainName];
    if (!chainConfig) return null;
    
    try {
        let constructorArgs: any[] = [];
        let contractPath = "";
        let salt = "";
        
        switch (contractType) {
            case "eagleShareOFT":
                constructorArgs = ["Eagle", "EAGLE", REGISTRY_ADDRESS, ethers.ZeroAddress];
                contractPath = "contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT";
                salt = "0xe0000000023e5f2f0000000000000000000000000000000000000000000000000";
                break;
                
            case "wlfiAssetOFT":
                constructorArgs = ["Wrapped LFI", "WLFI", chainConfig.endpointV2, ethers.ZeroAddress];
                contractPath = "contracts/layerzero-ovault/oft/WLFIAssetOFT.sol:WLFIAssetOFT";
                salt = "0x0000000000000000000000000000000000000000000000000000000000000001";
                break;
                
            case "usd1AssetOFT":
                constructorArgs = ["USD1 Stablecoin", "USD1", chainConfig.endpointV2, ethers.ZeroAddress];
                contractPath = "contracts/layerzero-ovault/oft/USD1AssetOFT.sol:USD1AssetOFT";
                salt = "0x0000000000000000000000000000000000000000000000000000000000000002";
                break;
                
            default:
                return null;
        }
        
        // Get contract factory
        const ContractFactory = await ethers.getContractFactory(contractPath);
        
        // Encode constructor arguments
        const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
            contractType === "eagleShareOFT" 
                ? ["string", "string", "address", "address"]
                : ["string", "string", "address", "address"],
            constructorArgs
        );
        
        // Create full bytecode
        const fullBytecode = ethers.concat([
            ContractFactory.bytecode,
            encodedArgs
        ]);
        
        // Calculate CREATE2 address
        const bytecodeHash = ethers.keccak256(fullBytecode);
        const predictedAddress = ethers.getCreate2Address(
            CREATE2_FACTORY,
            salt,
            bytecodeHash
        );
        
        return predictedAddress;
        
    } catch (error) {
        console.log(`   ⚠️ Could not predict ${contractType} for ${chainName}: ${error}`);
        return null;
    }
}

async function verifyDeterministicAddresses() {
    console.log("🔍 DETERMINISTIC ADDRESS VERIFICATION");
    console.log("====================================");
    
    try {
        // Load deployed addresses
        const deployedAddresses = await loadDeployedAddresses();
        const chains = Object.keys(deployedAddresses);
        
        console.log(`📍 Checking ${chains.length} chains: ${chains.join(", ")}\n`);
        
        // Contract types that should have same addresses
        const deterministicContracts = ["eagleShareOFT", "wlfiAssetOFT", "usd1AssetOFT"];
        
        let totalChecks = 0;
        let consistentAddresses = 0;
        let issues = 0;
        
        for (const contractType of deterministicContracts) {
            console.log(`🔍 Checking ${contractType}:`);
            console.log("─".repeat(50));
            
            const addressesByChain: Record<string, string> = {};
            const predictedAddresses: Record<string, string> = {};
            
            // Collect addresses from all chains
            for (const chain of chains) {
                const chainData = deployedAddresses[chain];
                if (chainData && chainData[contractType]) {
                    addressesByChain[chain] = chainData[contractType];
                    totalChecks++;
                }
                
                // Also predict what address should be
                const predicted = await predictAddressOnChain(chain, contractType);
                if (predicted) {
                    predictedAddresses[chain] = predicted;
                }
            }
            
            // Check consistency
            const uniqueAddresses = new Set(Object.values(addressesByChain));
            
            if (uniqueAddresses.size <= 1) {
                const address = uniqueAddresses.values().next().value;
                if (address) {
                    console.log(`   ✅ CONSISTENT: ${address}`);
                    consistentAddresses++;
                    
                    // Verify against predicted addresses
                    let allMatch = true;
                    for (const [chain, deployedAddr] of Object.entries(addressesByChain)) {
                        const predictedAddr = predictedAddresses[chain];
                        if (predictedAddr && deployedAddr !== predictedAddr) {
                            console.log(`   ⚠️ ${chain}: Deployed ${deployedAddr} ≠ Predicted ${predictedAddr}`);
                            allMatch = false;
                            issues++;
                        }
                    }
                    
                    if (allMatch && Object.keys(addressesByChain).length > 0) {
                        console.log(`   ✅ Matches CREATE2 prediction on all chains`);
                    }
                } else {
                    console.log(`   ℹ️ Not deployed on any chain yet`);
                }
            } else {
                console.log(`   ❌ INCONSISTENT ADDRESSES:`);
                for (const [chain, address] of Object.entries(addressesByChain)) {
                    console.log(`     ${chain}: ${address}`);
                }
                issues++;
            }
            
            // Show which chains are missing
            const missingChains = Object.keys(CHAIN_CONFIGS).filter(
                chain => !addressesByChain[chain]
            );
            
            if (missingChains.length > 0) {
                console.log(`   ⏳ Not deployed on: ${missingChains.join(", ")}`);
            }
            
            console.log("");
        }
        
        // Check chain-specific contracts (should be different)
        console.log("🔍 Chain-specific contracts (should differ):");
        console.log("─".repeat(50));
        
        const chainSpecificContracts = ["eagleOVault"];
        
        for (const contractType of chainSpecificContracts) {
            const addressesByChain: Record<string, string> = {};
            
            for (const chain of chains) {
                const chainData = deployedAddresses[chain];
                if (chainData && chainData[contractType]) {
                    addressesByChain[chain] = chainData[contractType];
                }
            }
            
            if (Object.keys(addressesByChain).length > 0) {
                console.log(`   📍 ${contractType}:`);
                for (const [chain, address] of Object.entries(addressesByChain)) {
                    console.log(`     ${chain}: ${address}`);
                }
            } else {
                console.log(`   ℹ️ ${contractType}: Not deployed on any chain yet`);
            }
        }
        
        // Summary
        console.log("\n📊 VERIFICATION SUMMARY");
        console.log("=======================");
        
        if (issues === 0 && consistentAddresses > 0) {
            console.log("🎉 ALL DETERMINISTIC ADDRESSES ARE CONSISTENT!");
            console.log(`✅ ${consistentAddresses} contract types verified`);
            console.log("✅ Same addresses across all chains as expected");
            console.log("✅ CREATE2 predictions match deployed addresses");
        } else if (consistentAddresses > 0 && issues === 0) {
            console.log("✅ ADDRESSES CONSISTENT (some chains pending)");
            console.log(`✅ ${consistentAddresses} contract types verified`);
            console.log("⏳ Deploy on remaining chains to complete");
        } else {
            console.log("⚠️ ISSUES FOUND:");
            if (issues > 0) {
                console.log(`❌ ${issues} address inconsistencies`);
            }
            if (consistentAddresses === 0) {
                console.log("❌ No consistent addresses found");
            }
        }
        
        console.log("\n🎯 DETERMINISTIC DEPLOYMENT STATUS:");
        console.log(`   Factory: ${CREATE2_FACTORY}`);
        console.log(`   Registry: ${REGISTRY_ADDRESS}`);
        console.log(`   Chains checked: ${chains.length}`);
        console.log(`   Contract types: ${deterministicContracts.length}`);
        
    } catch (error) {
        console.error("❌ Verification failed:", error);
        throw error;
    }
}

async function main() {
    try {
        await verifyDeterministicAddresses();
        
        console.log("\n📋 NEXT STEPS:");
        console.log("1. If addresses are consistent → Configure LayerZero wiring");
        console.log("2. If missing chains → Deploy on remaining chains");
        console.log("3. If inconsistent → Check deployment scripts and salts");
        
    } catch (error) {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Unexpected error:", error);
        process.exit(1);
    });

import { ethers } from "hardhat";

/**
 * Wire Existing Eagle Vault Contracts
 * Configure LayerZero peers for already deployed contracts
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

// Our deployed contract addresses
const DEPLOYED_ADDRESSES = {
    ethereum: {
        eagleShareAdapter: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
        wlfiAdapter: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
        usd1Adapter: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
    },
    arbitrum: {
        eagleOFT: "0xa790A43496dE635cD4aaa94346ea7025834643c9",
        wlfiAssetOFT: "0x1581b58F36E41724CC440FA7D997c0409a98b441",
        usd1AssetOFT: "0x785f66978e32D51D2a802350E5683d584Bbf6E35",
    },
    base: {
        eagleOFT: "0x778E04D42D10C5A89270eF8a3787643EAD08e41A",
        wlfiAssetOFT: "0x75D2ee6cBdA57717f60808BB9443929241ef97F0",
        // usd1AssetOFT missing
    },
    bsc: {
        eagleOFT: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
        wlfiAssetOFT: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
        usd1AssetOFT: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
    }
};

async function setPeer(contract: any, remoteEid: number, remotePeer: string, contractName: string, remoteName: string) {
    try {
        // LayerZero V2 uses bytes32 format for peer addresses
        const peerBytes32 = ethers.zeroPadValue(remotePeer, 32);
        const tx = await contract.setPeer(remoteEid, peerBytes32);
        await tx.wait();
        console.log(`   ✅ ${contractName} → ${remoteName} peer set`);
        return true;
    } catch (error) {
        console.log(`   ❌ ${contractName} → ${remoteName} peer failed:`, error.message);
        return false;
    }
}

async function wireCurrentChain() {
    console.log("🔗 WIRING EXISTING EAGLE VAULT CONTRACTS");
    console.log("========================================");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currentChain = Object.values(CHAIN_CONFIGS).find(c => c.chainId === chainId);
    if (!currentChain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    console.log(`📍 Current Chain: ${currentChain.name}`);
    console.log(`📍 Deployer: ${deployer.address}`);
    
    const currentAddresses = DEPLOYED_ADDRESSES[currentChain.name as keyof typeof DEPLOYED_ADDRESSES];
    if (!currentAddresses) {
        console.log(`❌ No deployed contracts found for ${currentChain.name}`);
        return;
    }
    
    console.log("\n🔍 Current chain contracts:");
    for (const [name, address] of Object.entries(currentAddresses)) {
        console.log(`   ${name}: ${address}`);
    }
    
    let totalPeers = 0;
    let successfulPeers = 0;
    
    // Configure peers for each contract type
    for (const [contractName, contractAddress] of Object.entries(currentAddresses)) {
        console.log(`\n🔗 Configuring ${contractName} peers...`);
        
        try {
            let contract;
            
            // Get contract instance based on type
            if (contractName.includes('Adapter')) {
                contract = await ethers.getContractAt("OFTAdapter", contractAddress);
            } else {
                contract = await ethers.getContractAt("OFT", contractAddress);
            }
            
            // Set peers on other chains
            for (const [remoteName, remoteChainConfig] of Object.entries(CHAIN_CONFIGS)) {
                if (remoteName === currentChain.name) continue;
                
                const remoteAddresses = DEPLOYED_ADDRESSES[remoteName as keyof typeof DEPLOYED_ADDRESSES];
                if (!remoteAddresses) {
                    console.log(`   ⚠️ No contracts on ${remoteName}, skipping`);
                    continue;
                }
                
                // Find corresponding contract on remote chain
                let remoteAddress = "";
                
                if (contractName === "eagleShareAdapter" && remoteAddresses.eagleOFT) {
                    remoteAddress = remoteAddresses.eagleOFT;
                } else if (contractName === "wlfiAdapter" && remoteAddresses.wlfiAssetOFT) {
                    remoteAddress = remoteAddresses.wlfiAssetOFT;
                } else if (contractName === "usd1Adapter" && remoteAddresses.usd1AssetOFT) {
                    remoteAddress = remoteAddresses.usd1AssetOFT;
                } else if (contractName === "eagleOFT" && remoteAddresses.eagleShareAdapter) {
                    remoteAddress = remoteAddresses.eagleShareAdapter;
                } else if (contractName === "wlfiAssetOFT" && remoteAddresses.wlfiAdapter) {
                    remoteAddress = remoteAddresses.wlfiAdapter;
                } else if (contractName === "usd1AssetOFT" && remoteAddresses.usd1Adapter) {
                    remoteAddress = remoteAddresses.usd1Adapter;
                } else if (contractName.includes("OFT") && remoteAddresses[contractName as keyof typeof remoteAddresses]) {
                    remoteAddress = remoteAddresses[contractName as keyof typeof remoteAddresses] as string;
                }
                
                if (remoteAddress) {
                    totalPeers++;
                    const success = await setPeer(
                        contract, 
                        remoteChainConfig.eid, 
                        remoteAddress, 
                        contractName, 
                        remoteName
                    );
                    if (success) successfulPeers++;
                } else {
                    console.log(`   ⚠️ No matching contract on ${remoteName} for ${contractName}`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Failed to configure ${contractName}:`, error.message);
        }
    }
    
    console.log("\n📊 WIRING SUMMARY");
    console.log("=================");
    console.log(`Total peer connections attempted: ${totalPeers}`);
    console.log(`Successful connections: ${successfulPeers}`);
    console.log(`Failed connections: ${totalPeers - successfulPeers}`);
    
    if (successfulPeers === totalPeers && totalPeers > 0) {
        console.log("🎉 ALL PEERS CONFIGURED SUCCESSFULLY!");
    } else if (successfulPeers > 0) {
        console.log("⚠️ PARTIAL SUCCESS - Some peers configured");
    } else {
        console.log("❌ NO PEERS CONFIGURED");
    }
    
    console.log("\n🔗 NEXT STEPS:");
    console.log("Run this script on other chains:");
    console.log("npx hardhat run scripts/wire-existing-contracts.ts --network ethereum");
    console.log("npx hardhat run scripts/wire-existing-contracts.ts --network arbitrum");
    console.log("npx hardhat run scripts/wire-existing-contracts.ts --network base");
    console.log("npx hardhat run scripts/wire-existing-contracts.ts --network bsc");
}

wireCurrentChain()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Wiring failed:", error);
        process.exit(1);
    });

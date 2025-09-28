import { ethers } from "hardhat";

/**
 * Check actual wiring status of deployed contracts
 */

interface ChainConfig {
    chainId: number;
    eid: number;
    name: string;
    contracts: Record<string, string>;
}

const ACTUAL_ADDRESSES: Record<string, ChainConfig> = {
    ethereum: {
        chainId: 1,
        eid: 30101,
        name: "ethereum",
        contracts: {
            eagleShareAdapter: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
            wlfiAdapter: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
            usd1Adapter: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
        }
    },
    arbitrum: {
        chainId: 42161,
        eid: 30110,
        name: "arbitrum",
        contracts: {
            eagleOFT: "0xa790A43496dE635cD4aaa94346ea7025834643c9",
            wlfiAssetOFT: "0x1581b58F36E41724CC440FA7D997c0409a98b441",
            usd1AssetOFT: "0x785f66978e32D51D2a802350E5683d584Bbf6E35",
        }
    },
    base: {
        chainId: 8453,
        eid: 30184,
        name: "base",
        contracts: {
            eagleOFT: "0x778E04D42D10C5A89270eF8a3787643EAD08e41A",
            wlfiAssetOFT: "0x75D2ee6cBdA57717f60808BB9443929241ef97F0",
        }
    },
    bsc: {
        chainId: 56,
        eid: 30102,
        name: "bsc",
        contracts: {
            eagleOFT: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
            wlfiAssetOFT: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
            usd1AssetOFT: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
        }
    }
};

async function checkPeerConnection(contract: any, remoteEid: number, contractName: string, remoteName: string): Promise<boolean> {
    try {
        const peer = await contract.peers(remoteEid);
        const peerHex = ethers.hexlify(peer);
        const isConnected = peerHex !== "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        if (isConnected) {
            console.log(`   ✅ ${contractName} → ${remoteName} (EID ${remoteEid}): Connected`);
            return true;
        } else {
            console.log(`   ❌ ${contractName} → ${remoteName} (EID ${remoteEid}): Not Connected`);
            return false;
        }
    } catch (error) {
        console.log(`   ❓ ${contractName} → ${remoteName} (EID ${remoteEid}): Check failed - ${error.message}`);
        return false;
    }
}

async function checkWiring() {
    console.log("🔍 REAL WIRING STATUS CHECK");
    console.log("===========================");
    
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currentChain = Object.values(ACTUAL_ADDRESSES).find(c => c.chainId === chainId);
    if (!currentChain) {
        throw new Error(`No contract addresses for chain ID: ${chainId}`);
    }
    
    console.log(`📍 Current Chain: ${currentChain.name} (EID: ${currentChain.eid})`);
    
    let totalConnections = 0;
    let successfulConnections = 0;
    
    // Check each contract on this chain
    for (const [contractName, contractAddress] of Object.entries(currentChain.contracts)) {
        console.log(`\n🔧 Checking ${contractName} at ${contractAddress}`);
        
        try {
            // Get contract instance
            let contract;
            if (contractName.includes('Adapter')) {
                contract = await ethers.getContractAt("OFTAdapter", contractAddress);
            } else {
                contract = await ethers.getContractAt("OFT", contractAddress);
            }
            
            // Check peers to all other chains
            for (const [remoteName, remoteChain] of Object.entries(ACTUAL_ADDRESSES)) {
                if (remoteName === currentChain.name) continue; // Skip self
                
                totalConnections++;
                const isConnected = await checkPeerConnection(contract, remoteChain.eid, contractName, remoteName);
                if (isConnected) successfulConnections++;
            }
            
        } catch (error) {
            console.log(`   ❌ Failed to check ${contractName}: ${error.message}`);
        }
    }
    
    console.log(`\n📊 WIRING SUMMARY FOR ${currentChain.name.toUpperCase()}`);
    console.log("=================================");
    console.log(`✅ Successful connections: ${successfulConnections}`);
    console.log(`❌ Missing connections: ${totalConnections - successfulConnections}`);
    console.log(`📈 Wiring percentage: ${Math.round((successfulConnections/totalConnections) * 100)}%`);
    
    if (successfulConnections === totalConnections) {
        console.log(`\n🎉 ${currentChain.name.toUpperCase()} IS FULLY WIRED!`);
    } else {
        console.log(`\n⚠️ ${currentChain.name.toUpperCase()} NEEDS WIRING`);
        console.log("Run: npx hardhat run scripts/wire-existing-contracts.ts --network", currentChain.name);
    }
    
    return {
        total: totalConnections,
        successful: successfulConnections,
        percentage: Math.round((successfulConnections/totalConnections) * 100)
    };
}

checkWiring()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Wiring check failed:", error);
        process.exit(1);
    });

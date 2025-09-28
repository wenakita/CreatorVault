import { ethers } from "hardhat";

/**
 * Check wiring status specifically between Ethereum and BSC
 */

interface ChainConfig {
    chainId: number;
    eid: number;
    name: string;
    contracts: Record<string, string>;
}

const ETH_BSC_ADDRESSES: Record<string, ChainConfig> = {
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

const CONTRACT_PAIRS = [
    { eth: "eagleShareAdapter", bsc: "eagleOFT", name: "Eagle Shares" },
    { eth: "wlfiAdapter", bsc: "wlfiAssetOFT", name: "WLFI Token" },
    { eth: "usd1Adapter", bsc: "usd1AssetOFT", name: "USD1 Token" }
];

async function checkPeerConnection(contract: any, remoteEid: number, contractName: string, remoteName: string): Promise<boolean> {
    try {
        const peer = await contract.peers(remoteEid);
        const peerHex = ethers.hexlify(peer);
        const isConnected = peerHex !== "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        if (isConnected) {
            console.log(`   ✅ ${contractName} → ${remoteName}: Connected`);
            return true;
        } else {
            console.log(`   ❌ ${contractName} → ${remoteName}: Not Connected`);
            return false;
        }
    } catch (error) {
        console.log(`   ❓ ${contractName} → ${remoteName}: Check failed - ${error.message}`);
        return false;
    }
}

async function checkEthBscWiring() {
    console.log("🔍 ETHEREUM ↔ BSC WIRING STATUS");
    console.log("===============================");
    
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currentChain = Object.values(ETH_BSC_ADDRESSES).find(c => c.chainId === chainId);
    if (!currentChain) {
        throw new Error(`This script only works on Ethereum or BSC. Current chain ID: ${chainId}`);
    }
    
    const remoteChain = currentChain.name === "ethereum" ? ETH_BSC_ADDRESSES.bsc : ETH_BSC_ADDRESSES.ethereum;
    
    console.log(`📍 Current Chain: ${currentChain.name.toUpperCase()} (EID: ${currentChain.eid})`);
    console.log(`🎯 Target Chain: ${remoteChain.name.toUpperCase()} (EID: ${remoteChain.eid})`);
    
    let totalConnections = 0;
    let successfulConnections = 0;
    
    // Check each contract pair
    for (const pair of CONTRACT_PAIRS) {
        const currentContractName = currentChain.name === "ethereum" ? pair.eth : pair.bsc;
        const currentContractAddress = currentChain.contracts[currentContractName];
        
        if (!currentContractAddress) {
            console.log(`\n⚠️ ${pair.name}: Contract ${currentContractName} not found on ${currentChain.name}`);
            continue;
        }
        
        console.log(`\n🔧 Checking ${pair.name} (${currentContractName})`);
        console.log(`   Address: ${currentContractAddress}`);
        
        try {
            // Get contract instance
            let contract;
            if (currentContractName.includes('Adapter')) {
                contract = await ethers.getContractAt("OFTAdapter", currentContractAddress);
            } else {
                contract = await ethers.getContractAt("OFT", currentContractAddress);
            }
            
            totalConnections++;
            const isConnected = await checkPeerConnection(contract, remoteChain.eid, pair.name, remoteChain.name);
            if (isConnected) successfulConnections++;
            
        } catch (error) {
            console.log(`   ❌ Failed to check ${pair.name}: ${error.message}`);
            totalConnections++;
        }
    }
    
    console.log(`\n📊 ETHEREUM ↔ BSC WIRING SUMMARY`);
    console.log("================================");
    console.log(`✅ Successful connections: ${successfulConnections}/${totalConnections}`);
    console.log(`📈 Wiring percentage: ${Math.round((successfulConnections/totalConnections) * 100)}%`);
    
    if (successfulConnections === totalConnections) {
        console.log(`\n🎉 ETHEREUM ↔ BSC IS PERFECTLY WIRED!`);
        console.log("✅ All token types can transfer between chains");
        console.log("✅ Your 2-chain system is production ready");
    } else {
        console.log(`\n⚠️ ETHEREUM ↔ BSC NEEDS ${totalConnections - successfulConnections} MORE CONNECTIONS`);
        console.log("Run wiring script to complete the setup");
    }
    
    // Show what works
    console.log(`\n🎯 ETHEREUM ↔ BSC CAPABILITIES`);
    console.log("==============================");
    
    for (const pair of CONTRACT_PAIRS) {
        const currentContractName = currentChain.name === "ethereum" ? pair.eth : pair.bsc;
        const currentContractAddress = currentChain.contracts[currentContractName];
        
        if (currentContractAddress) {
            console.log(`✅ ${pair.name}: Ready for cross-chain transfers`);
        } else {
            console.log(`❌ ${pair.name}: Contract missing`);
        }
    }
    
    return {
        total: totalConnections,
        successful: successfulConnections,
        percentage: Math.round((successfulConnections/totalConnections) * 100)
    };
}

checkEthBscWiring()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ethereum ↔ BSC wiring check failed:", error);
        process.exit(1);
    });

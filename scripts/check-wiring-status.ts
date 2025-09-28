import { ethers } from "hardhat";

/**
 * Check LayerZero Cross-Chain Wiring Status
 * Verifies if contracts are properly configured for cross-chain communication
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

// Example addresses from our successful test deployment
const TEST_ADDRESSES = {
    ethereum: {
        eagleOVault: "0xd3408d521d9325B14BAA67fAD4A9C7bB37C8E47b",
        eagleShareAdapter: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
        wlfiAdapter: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
        usd1Adapter: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
    }
};

async function checkContractExists(address: string, name: string): Promise<boolean> {
    try {
        const code = await ethers.provider.getCode(address);
        if (code === "0x") {
            console.log(`   ❌ ${name}: No contract at ${address}`);
            return false;
        }
        console.log(`   ✅ ${name}: Contract exists at ${address}`);
        return true;
    } catch (error) {
        console.log(`   ❌ ${name}: Error checking ${address}`);
        return false;
    }
}

async function checkPeerConfiguration(contractAddress: string, contractName: string, remoteEid: number): Promise<boolean> {
    try {
        // Try to check if peer is set (this works for OFT/Adapter contracts)
        const contract = await ethers.getContractAt("IOFT", contractAddress);
        
        try {
            const isPeer = await contract.isPeer(remoteEid, ethers.solidityPacked(["address"], [contractAddress]));
            if (isPeer) {
                console.log(`   ✅ ${contractName}: Peer configured for EID ${remoteEid}`);
                return true;
            } else {
                console.log(`   ❌ ${contractName}: No peer configured for EID ${remoteEid}`);
                return false;
            }
        } catch (error) {
            console.log(`   ❓ ${contractName}: Cannot check peer for EID ${remoteEid} (method may not exist)`);
            return false;
        }
    } catch (error) {
        console.log(`   ❓ ${contractName}: Cannot check peer configuration (not an OFT/Adapter?)`);
        return false;
    }
}

async function checkWiringStatus() {
    console.log("🔍 LAYERZERO WIRING STATUS CHECK");
    console.log("================================");
    
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currentChain = Object.values(CHAIN_CONFIGS).find(c => c.chainId === chainId);
    if (!currentChain) {
        console.log(`❌ Unsupported chain ID: ${chainId}`);
        return;
    }
    
    console.log(`📍 Current Chain: ${currentChain.name}`);
    console.log(`📍 Chain ID: ${chainId}`);
    console.log(`📍 LayerZero EID: ${currentChain.eid}\n`);
    
    // Check if contracts are deployed
    console.log("🏗️ DEPLOYMENT STATUS");
    console.log("--------------------");
    
    const addresses = TEST_ADDRESSES[currentChain.name as keyof typeof TEST_ADDRESSES];
    
    if (!addresses) {
        console.log(`❌ No test addresses available for ${currentChain.name}`);
        console.log("   Run deployment first: npx hardhat run scripts/deploy-simple-test.ts");
        return;
    }
    
    let contractsExist = 0;
    let totalContracts = 0;
    
    for (const [contractName, address] of Object.entries(addresses)) {
        totalContracts++;
        if (await checkContractExists(address, contractName)) {
            contractsExist++;
        }
    }
    
    console.log(`\n📊 Deployment: ${contractsExist}/${totalContracts} contracts found\n`);
    
    if (contractsExist === 0) {
        console.log("❌ No contracts deployed on this chain");
        console.log("   Run: npx hardhat run scripts/deploy-simple-test.ts --network " + currentChain.name);
        return;
    }
    
    // Check cross-chain wiring
    console.log("🌐 CROSS-CHAIN WIRING STATUS");
    console.log("----------------------------");
    
    const otherChains = Object.values(CHAIN_CONFIGS).filter(c => c.chainId !== chainId);
    let wiringIssues = 0;
    
    for (const [contractName, address] of Object.entries(addresses)) {
        if (!await checkContractExists(address, contractName)) continue;
        
        console.log(`\n🔍 Checking ${contractName} peers:`);
        
        for (const remoteChain of otherChains) {
            const isPeerConfigured = await checkPeerConfiguration(address, contractName, remoteChain.eid);
            if (!isPeerConfigured) {
                wiringIssues++;
            }
        }
    }
    
    // Summary
    console.log("\n📋 WIRING SUMMARY");
    console.log("=================");
    
    if (contractsExist === totalContracts && wiringIssues === 0) {
        console.log("🎉 ALL CONTRACTS FULLY WIRED!");
        console.log("✅ Ready for cross-chain transfers");
    } else if (contractsExist === totalContracts && wiringIssues > 0) {
        console.log("⚠️ CONTRACTS DEPLOYED BUT NOT WIRED");
        console.log(`❌ ${wiringIssues} wiring issues found`);
        console.log("\n🔧 TO WIRE YOUR CONTRACTS:");
        console.log("1. Deploy on all target chains");
        console.log("2. Run: npx hardhat run scripts/configure-layerzero-production.ts --network ethereum");
        console.log("3. Run: npx hardhat run scripts/configure-layerzero-production.ts --network arbitrum");
        console.log("4. Run: npx hardhat run scripts/configure-layerzero-production.ts --network base");
        console.log("5. Run: npx hardhat run scripts/configure-layerzero-production.ts --network bsc");
    } else {
        console.log("❌ DEPLOYMENT INCOMPLETE");
        console.log(`${contractsExist}/${totalContracts} contracts deployed`);
        console.log("\n🔧 NEXT STEPS:");
        console.log("1. Deploy on all chains: bash scripts/deploy-all-chains.sh");
        console.log("2. Then configure wiring with LayerZero scripts");
    }
    
    console.log("\n🎯 WHAT 'WIRED' MEANS:");
    console.log("- ✅ Contracts deployed on all target chains");
    console.log("- ✅ Peers configured (each chain knows about others)");
    console.log("- ✅ DVN security settings applied");
    console.log("- ✅ Enforced options set for gas safety");
    console.log("- ✅ Cross-chain transfers working");
}

checkWiringStatus()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Status check failed:", error);
        process.exit(1);
    });

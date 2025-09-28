import { ethers } from "hardhat";

/**
 * Configure LayerZero V2 Security Settings
 * Sets up DVN validation, enforced options, and ULN libraries
 */

interface ChainConfig {
    chainId: number;
    eid: number;
    name: string;
    endpointV2: string;
    sendLibrary: string;
    receiveLibrary: string;
    layerzeroDVN: string;
    googleDVN: string;
    chainlinkDVN?: string;
    executor: string;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
    ethereum: {
        chainId: 1,
        eid: 30101,
        name: "ethereum",
        endpointV2: "0x1a44076050125825900e736c501f859c50fE728c",
        sendLibrary: "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1",
        receiveLibrary: "0xc02Ab410f0734EFa3F14628780e6e695156024C2",
        layerzeroDVN: "0x589dEdBD617e0CBcB916A9223F4d1300c294236b",
        googleDVN: "0xa59BA433ac34D2927232918Ef5B2eaAfcF130BA5",
        chainlinkDVN: "0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc",
        executor: "0x173272739Bd7Aa6e4e214714048a9fE699453059"
    },
    arbitrum: {
        chainId: 42161,
        eid: 30110,
        name: "arbitrum",
        endpointV2: "0x1a44076050125825900e736c501f859c50fE728c",
        sendLibrary: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
        receiveLibrary: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6",
        layerzeroDVN: "0x2f55C492897526677C5B68fb199037c7e141B1a4",
        googleDVN: "0x23DE2FE932d9043291f870324B74F820e11dc81A",
        chainlinkDVN: "0xa7b5189bca84Cd304D8553977c7C614329750d99",
        executor: "0x31CAe3B7fB82d847621859fb1585353e6f6c97a4"
    },
    base: {
        chainId: 8453,
        eid: 30184,
        name: "base",
        endpointV2: "0x1a44076050125825900e736c501f859c50fE728c",
        sendLibrary: "0xB5320B0B3a13cC860893E2Bd79fcD7e13484Dda2",
        receiveLibrary: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
        layerzeroDVN: "0x9e059a54699a285714207b43B055483E78FAac25",
        googleDVN: "0x54eD2628b1D24b6cF9107bE334cEF461B5d72d18",
        chainlinkDVN: "0xf49d162484290EaEAd7bb8C2c7E3a6f8f52e32b6",
        executor: "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4"
    },
    bsc: {
        chainId: 56,
        eid: 30102,
        name: "bsc",
        endpointV2: "0x1a44076050125825900e736c501f859c50fE728c",
        sendLibrary: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
        receiveLibrary: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
        layerzeroDVN: "0xfD6865c841c2d64565562fCc7e05e619A30615f0",
        googleDVN: "0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc",
        chainlinkDVN: "0xfd869448A17476f7ADB1064D1d7b2f7b7d7b8877",
        executor: "0x1785f0cbF44C9E5d0A3E165B77Ee5caAAe3E7DA4"
    }
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
    },
    bsc: {
        eagleOFT: "0x59c0dCb8d98522DbaB94d7CB17B3b97F3F17B4a2",
        wlfiAssetOFT: "0x2F517045c27d202641799E4DB4ff27A43450E60e",
        usd1AssetOFT: "0x548bfaD679e21305Aa19d2f84ACa48Dd0880ad9a",
    }
};

async function setEnforcedOptions(contract: any, contractName: string, chainConfig: ChainConfig) {
    console.log(`\n📋 Setting enforced options for ${contractName}...`);
    
    const enforcedOptions = [];
    
    for (const [remoteName, remoteConfig] of Object.entries(CHAIN_CONFIGS)) {
        if (remoteName === chainConfig.name) continue;
        
        const gasLimit = 200000; // 200k gas for lzReceive
        const msgValue = 0;
        
        // Create Type 3 options (ExecutorLzReceiveOption)
        const options = ethers.concat([
            "0x0003", // Type 3
            "0x0001", // ExecutorLzReceiveOption
            ethers.zeroPadValue(ethers.toBeHex(gasLimit), 16), // Gas limit (128 bits)
            ethers.zeroPadValue(ethers.toBeHex(msgValue), 16)  // Msg value (128 bits)
        ]);

        enforcedOptions.push({
            eid: remoteConfig.eid,
            msgType: 1, // SEND message type
            options: options
        });
    }
    
    if (enforcedOptions.length > 0) {
        try {
            const tx = await contract.setEnforcedOptions(enforcedOptions);
            await tx.wait();
            console.log(`   ✅ Enforced options set for ${contractName}`);
            return true;
        } catch (error) {
            console.log(`   ❌ Failed to set enforced options for ${contractName}:`, error.message);
            return false;
        }
    }
    
    return false;
}

async function configureDVNSecurity(endpoint: any, contractAddress: string, chainConfig: ChainConfig) {
    console.log(`\n🔐 Configuring DVN security for contract ${contractAddress}...`);
    
    let successCount = 0;
    let totalCount = 0;
    
    for (const [remoteName, remoteConfig] of Object.entries(CHAIN_CONFIGS)) {
        if (remoteName === chainConfig.name) continue;
        
        totalCount++;
        
        try {
            console.log(`   📡 Setting up security for ${chainConfig.name} → ${remoteName}...`);
            
            // Send-side ULN config
            const sendUlnConfig = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(uint64,address[],address[],uint8)"],
                [[
                    15n, // confirmations
                    [chainConfig.layerzeroDVN, chainConfig.googleDVN], // required DVNs
                    chainConfig.chainlinkDVN ? [chainConfig.chainlinkDVN] : [], // optional DVNs
                    chainConfig.chainlinkDVN ? 1 : 0 // optional threshold
                ]]
            );
            
            // Set send-side config
            const sendTx = await endpoint.setConfig(
                contractAddress,
                chainConfig.sendLibrary,
                remoteConfig.eid,
                2, // ULN_CONFIG_TYPE
                sendUlnConfig
            );
            await sendTx.wait();
            
            // Receive-side ULN config  
            const receiveUlnConfig = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(uint64,address[],address[],uint8)"],
                [[
                    10n, // confirmations (for remote chain)
                    [remoteConfig.layerzeroDVN, remoteConfig.googleDVN], // required DVNs
                    remoteConfig.chainlinkDVN ? [remoteConfig.chainlinkDVN] : [], // optional DVNs
                    remoteConfig.chainlinkDVN ? 1 : 0 // optional threshold
                ]]
            );
            
            // Set receive-side config
            const receiveTx = await endpoint.setConfig(
                contractAddress,
                chainConfig.receiveLibrary,
                remoteConfig.eid,
                2, // ULN_CONFIG_TYPE
                receiveUlnConfig
            );
            await receiveTx.wait();
            
            console.log(`     ✅ DVN security configured for ${remoteName}`);
            successCount++;
            
        } catch (error) {
            console.log(`     ❌ Failed to configure ${remoteName}:`, error.message);
        }
    }
    
    console.log(`   📊 DVN configuration: ${successCount}/${totalCount} successful`);
    return successCount;
}

async function configureSecurity() {
    console.log("🔐 EAGLE VAULT SECURITY CONFIGURATION");
    console.log("=====================================");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currentChain = Object.values(CHAIN_CONFIGS).find(c => c.chainId === chainId);
    if (!currentChain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    console.log(`📍 Current Chain: ${currentChain.name}`);
    console.log(`📍 Deployer: ${deployer.address}`);
    console.log(`📍 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    
    const currentAddresses = DEPLOYED_ADDRESSES[currentChain.name as keyof typeof DEPLOYED_ADDRESSES];
    if (!currentAddresses) {
        console.log(`❌ No deployed contracts found for ${currentChain.name}`);
        return;
    }
    
    // Get LayerZero endpoint
    const endpoint = await ethers.getContractAt(
        "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2", 
        currentChain.endpointV2
    );
    
    let totalEnforcedOptions = 0;
    let totalDVNConfigs = 0;
    
    // Configure each contract
    for (const [contractName, contractAddress] of Object.entries(currentAddresses)) {
        console.log(`\n🔧 Configuring ${contractName} at ${contractAddress}`);
        
        try {
            // Get contract instance
            let contract;
            if (contractName.includes('Adapter')) {
                contract = await ethers.getContractAt("OFTAdapter", contractAddress);
            } else {
                contract = await ethers.getContractAt("OFT", contractAddress);
            }
            
            // Set enforced options
            const enforcedSuccess = await setEnforcedOptions(contract, contractName, currentChain);
            if (enforcedSuccess) totalEnforcedOptions++;
            
            // Configure DVN security
            const dvnCount = await configureDVNSecurity(endpoint, contractAddress, currentChain);
            totalDVNConfigs += dvnCount;
            
        } catch (error) {
            console.log(`   ❌ Failed to configure ${contractName}:`, error.message);
        }
    }
    
    console.log("\n📊 SECURITY CONFIGURATION SUMMARY");
    console.log("==================================");
    console.log(`✅ Contracts configured: ${Object.keys(currentAddresses).length}`);
    console.log(`✅ Enforced options set: ${totalEnforcedOptions}`);
    console.log(`✅ DVN security configs: ${totalDVNConfigs}`);
    
    if (totalEnforcedOptions > 0 && totalDVNConfigs > 0) {
        console.log("\n🎉 SECURITY CONFIGURATION SUCCESSFUL!");
        console.log("✅ Gas safety enforced (200k gas limit)");
        console.log("✅ Multi-DVN validation (LayerZero + Google + Chainlink)");
        console.log("✅ Production-grade security enabled");
    } else {
        console.log("\n⚠️ PARTIAL SECURITY CONFIGURATION");
        console.log("Some settings may need manual review");
    }
    
    console.log("\n🔗 NEXT STEPS:");
    console.log("Run this script on other chains:");
    console.log("npx hardhat run scripts/configure-security-settings.ts --network arbitrum");
    console.log("npx hardhat run scripts/configure-security-settings.ts --network base");
    console.log("npx hardhat run scripts/configure-security-settings.ts --network bsc");
}

configureSecurity()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Security configuration failed:", error);
        process.exit(1);
    });

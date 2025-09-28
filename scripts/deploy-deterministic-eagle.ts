import { ethers } from "hardhat";
import { writeFileSync, readFileSync, existsSync } from "fs";

/**
 * Deterministic $EAGLE Token Deployment
 * Uses CREATE2 to achieve same address across all LayerZero chains
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

// Your existing CREATE2 factory (same address on all chains)
const CREATE2_FACTORY = "0x472656c76f45E8a8a63FffD32aB5888898EeA91E";

// Your registry (should be deployed at same address on all chains)  
const REGISTRY_ADDRESS = "0x472656c76f45E8a8a63FffD32aB5888898EeA91E"; // Update if different from factory

// Vanity salt from generator (replace with actual salt you generated)
const VANITY_SALT = "0xe0000000023e5f2f00000000000000000000000000000000000000000000000"; // Replace with your vanity salt

async function validateFactoryAndRegistry() {
    console.log("🔍 Validating CREATE2 factory and registry...");
    
    // Check CREATE2 factory exists
    const factoryCode = await ethers.provider.getCode(CREATE2_FACTORY);
    if (factoryCode === "0x") {
        throw new Error(`CREATE2 factory not found at ${CREATE2_FACTORY}`);
    }
    
    // Check if we can call it
    const factory = await ethers.getContractAt("ICREATE2Factory", CREATE2_FACTORY);
    try {
        const owner = await factory.owner();
        console.log(`   ✅ Factory owner: ${owner}`);
    } catch (error) {
        console.log(`   ⚠️ Factory interface may not match: ${error}`);
    }
    
    // Check registry exists (if different from factory)
    if (REGISTRY_ADDRESS !== CREATE2_FACTORY) {
        const registryCode = await ethers.provider.getCode(REGISTRY_ADDRESS);
        if (registryCode === "0x") {
            console.log(`   ⚠️ Registry not found at ${REGISTRY_ADDRESS}`);
            console.log(`   ℹ️ Will deploy without registry (direct endpoint mode)`);
            return false;
        } else {
            console.log(`   ✅ Registry found at ${REGISTRY_ADDRESS}`);
            return true;
        }
    }
    
    return true;
}

async function calculateDeterministicAddress() {
    console.log("🧮 Calculating deterministic $EAGLE address...");
    
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const currentChain = Object.values(CHAIN_CONFIGS).find(c => c.chainId === chainId);
    
    if (!currentChain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    // Get contract bytecode with constructor parameters
    const EagleShareOFT = await ethers.getContractFactory("contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT");
    
    const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "address"],
        [
            "Eagle",                    // name (same on all chains)
            "EAGLE",                    // symbol (same on all chains) 
            REGISTRY_ADDRESS,           // registry (same address on all chains)
            ethers.ZeroAddress         // delegate placeholder (will be replaced with actual deployer)
        ]
    );
    
    const bytecode = ethers.concat([
        EagleShareOFT.bytecode,
        constructorArgs
    ]);
    
    const bytecodeHash = ethers.keccak256(bytecode);
    
    // Calculate CREATE2 address
    const predictedAddress = ethers.getCreate2Address(
        CREATE2_FACTORY,
        VANITY_SALT,
        bytecodeHash
    );
    
    console.log(`   📍 Chain: ${currentChain.name}`);
    console.log(`   🎯 Predicted EAGLE address: ${predictedAddress}`);
    console.log(`   🧂 Salt: ${VANITY_SALT}`);
    console.log(`   🏭 Factory: ${CREATE2_FACTORY}`);
    
    return { predictedAddress, bytecode, currentChain };
}

async function deployDeterministicEagle() {
    console.log("🦅 DETERMINISTIC $EAGLE DEPLOYMENT");
    console.log("==================================");
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 Deployer: ${deployer.address}`);
    console.log(`📍 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
    
    // Validate prerequisites
    const hasRegistry = await validateFactoryAndRegistry();
    
    // Calculate deterministic address
    const { predictedAddress, bytecode, currentChain } = await calculateDeterministicAddress();
    
    // Check if already deployed
    const existingCode = await ethers.provider.getCode(predictedAddress);
    if (existingCode !== "0x") {
        console.log(`   ✅ $EAGLE already deployed at ${predictedAddress}`);
        console.log(`   ℹ️ Skipping deployment\n`);
        
        // Save to addresses file
        saveDeploymentAddress(currentChain.name, predictedAddress);
        return predictedAddress;
    }
    
    try {
        console.log("🚀 Deploying deterministic $EAGLE...");
        
        // Get factory contract
        const factory = await ethers.getContractAt("ICREATE2Factory", CREATE2_FACTORY);
        
        // Replace placeholder delegate with actual deployer in bytecode
        const finalConstructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "address", "address"],
            [
                "Eagle",
                "EAGLE", 
                REGISTRY_ADDRESS,
                deployer.address  // Real deployer address
            ]
        );
        
        const EagleShareOFT = await ethers.getContractFactory("contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT");
        const finalBytecode = ethers.concat([
            EagleShareOFT.bytecode,
            finalConstructorArgs
        ]);
        
        // Deploy via CREATE2 factory
        const deployTx = await factory.deploy(VANITY_SALT, finalBytecode);
        await deployTx.wait();
        
        console.log(`   ✅ $EAGLE deployed at: ${predictedAddress}`);
        
        // Verify the deployment worked
        const deployedCode = await ethers.provider.getCode(predictedAddress);
        if (deployedCode === "0x") {
            throw new Error("Deployment failed - no code at predicted address");
        }
        
        // Test the deployed contract
        const eagleContract = await ethers.getContractAt("contracts/layerzero-ovault/oft/EagleShareOFT.sol:EagleShareOFT", predictedAddress);
        const name = await eagleContract.name();
        const symbol = await eagleContract.symbol();
        
        console.log(`   ✅ Name: ${name}`);
        console.log(`   ✅ Symbol: ${symbol}`);
        
        // Save to addresses file
        saveDeploymentAddress(currentChain.name, predictedAddress);
        
        console.log("\n🎉 DETERMINISTIC DEPLOYMENT SUCCESS!");
        console.log(`🎯 Same address across all chains: ${predictedAddress}`);
        
        return predictedAddress;
        
    } catch (error) {
        console.error(`❌ Deployment failed: ${error}`);
        throw error;
    }
}

function saveDeploymentAddress(chainName: string, address: string) {
    const addressFile = "deterministic-addresses.json";
    let addresses: any = {};
    
    if (existsSync(addressFile)) {
        addresses = JSON.parse(readFileSync(addressFile, "utf8"));
    }
    
    addresses[chainName] = {
        ...addresses[chainName],
        eagle: address,
        factory: CREATE2_FACTORY,
        salt: VANITY_SALT,
        deployedAt: new Date().toISOString()
    };
    
    writeFileSync(addressFile, JSON.stringify(addresses, null, 2));
    console.log(`   💾 Address saved to ${addressFile}`);
}

async function main() {
    try {
        const address = await deployDeterministicEagle();
        
        console.log("\n📋 NEXT STEPS:");
        console.log("1. Deploy on remaining chains with same script");
        console.log("2. All deployments will have IDENTICAL address:", address);
        console.log("3. Configure LayerZero peers between all chains");
        console.log("4. Test cross-chain transfers");
        
        console.log("\n🚀 DEPLOY ON OTHER CHAINS:");
        console.log("npx hardhat run scripts/deploy-deterministic-eagle.ts --network arbitrum");
        console.log("npx hardhat run scripts/deploy-deterministic-eagle.ts --network base");
        console.log("npx hardhat run scripts/deploy-deterministic-eagle.ts --network bsc");
        
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

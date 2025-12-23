// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

// Core contracts
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "../contracts/factories/CreatorOVaultFactory.sol";
import {CreatorChainlinkOracle} from "../contracts/oracles/CreatorChainlinkOracle.sol";
import {CreatorVRFConsumerV2_5} from "../contracts/vrf/CreatorVRFConsumerV2_5.sol";
import {CreatorLotteryManager} from "../contracts/lottery/CreatorLotteryManager.sol";

/**
 * @title DeployBase
 * @notice Deployment script for CreatorVault infrastructure on Base
 * @dev Run with: forge script script/DeployBase.s.sol:DeployBase --rpc-url base --broadcast
 */
contract DeployBase is Script {
    
    // ============ BASE MAINNET ADDRESSES ============
    
    /// @notice LayerZero V2 Endpoint on Base
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    /// @notice Chainlink ETH/USD Price Feed on Base
    address constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    
    /// @notice Chainlink VRF Coordinator V2.5 on Base
    address constant VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    
    /// @notice Existing Tax Hook on Base (6.9% sell fees)
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    
    /// @notice Base Chain ID
    uint16 constant BASE_CHAIN_ID = 8453;
    
    /// @notice Base LayerZero EID
    uint32 constant BASE_EID = 30184;
    
    // ============ DEPLOYMENT STATE ============
    
    CreatorRegistry public registry;
    CreatorOVaultFactory public factory;
    CreatorChainlinkOracle public oracle;
    CreatorVRFConsumerV2_5 public vrfConsumer;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== CreatorVault Base Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ============ PHASE 1: Core Infrastructure ============
        
        // 1. Deploy Registry
        console.log("\n[1/4] Deploying CreatorRegistry...");
        registry = new CreatorRegistry(deployer);
        console.log("CreatorRegistry:", address(registry));
        
        // 2. Deploy Factory
        console.log("\n[2/4] Deploying CreatorOVaultFactory...");
        factory = new CreatorOVaultFactory(address(registry), deployer);
        console.log("CreatorOVaultFactory:", address(factory));
        
        // 3. Deploy Oracle (for a specific creator - can deploy multiple)
        console.log("\n[3/4] Deploying CreatorChainlinkOracle...");
        oracle = new CreatorChainlinkOracle(
            LZ_ENDPOINT,
            CHAINLINK_ETH_USD,
            "CREATOR", // Creator symbol - change per deployment
            deployer
        );
        console.log("CreatorChainlinkOracle:", address(oracle));
        
        // 4. Deploy VRF Consumer (Hub)
        console.log("\n[4/4] Deploying CreatorVRFConsumerV2_5...");
        // Note: Registry must be configured with LZ endpoint before this
        vrfConsumer = new CreatorVRFConsumerV2_5(
            address(registry),
            deployer
        );
        console.log("CreatorVRFConsumerV2_5:", address(vrfConsumer));
        
        // ============ PHASE 2: Configuration ============
        
        console.log("\n=== Configuring Registry ===");
        
        // Register Base chain
        registry.registerChain(
            BASE_CHAIN_ID,
            "Base",
            0x4200000000000000000000000000000000000006, // WETH on Base
            true
        );
        
        // Set LayerZero endpoint
        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, LZ_ENDPOINT);
        
        // Set chain ID to EID mapping
        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);
        
        // Authorize factory
        registry.setAuthorizedFactory(address(factory), true);
        
        // Set hub chain
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);
        
        vm.stopBroadcast();
        
        // ============ Summary ============
        
        console.log("\n=== Deployment Complete ===");
        console.log("CreatorRegistry:", address(registry));
        console.log("CreatorOVaultFactory:", address(factory));
        console.log("CreatorChainlinkOracle:", address(oracle));
        console.log("CreatorVRFConsumerV2_5:", address(vrfConsumer));
        console.log("\nExisting Tax Hook:", TAX_HOOK);
        
        console.log("\n=== Next Steps ===");
        console.log("1. Fund VRF subscription and set subscription ID");
        console.log("2. Configure VRF keyHash for Base");
        console.log("3. Set LayerZero peers if deploying to other chains");
        console.log("4. Deploy creator vaults using factory.deployCreatorVaultAuto()");
    }
}

/**
 * @title DeployCreatorVault
 * @notice Deploy infrastructure for a specific Creator Coin
 * @dev Run with: forge script script/DeployBase.s.sol:DeployCreatorVault --rpc-url base --broadcast
 */
contract DeployCreatorVault is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load addresses from environment
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        address creatorCoin = vm.envAddress("CREATOR_COIN_ADDRESS");
        
        console.log("=== Deploy Creator Vault ===");
        console.log("Factory:", factoryAddr);
        console.log("Creator Coin:", creatorCoin);
        console.log("Creator:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CreatorOVaultFactory factory = CreatorOVaultFactory(factoryAddr);
        
        CreatorOVaultFactory.DeploymentInfo memory info = factory.deploy(creatorCoin);
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployed ===");
        console.log("Vault:", info.vault);
        console.log("Wrapper:", info.wrapper);
        console.log("ShareOFT:", info.shareOFT);
        console.log("GaugeController:", info.gaugeController);
        console.log("CCAStrategy:", info.ccaStrategy);
        console.log("Oracle:", info.oracle);
        
        console.log("\n=== Token Flow ===");
        console.log("CreatorCoin -> deposit -> Vault -> wrap -> ShareOFT");
        console.log("Users trade ShareOFT on DEX with 6.9% buy/sell fees");
    }
}


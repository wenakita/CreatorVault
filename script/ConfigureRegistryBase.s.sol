// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title ConfigureRegistryBase
 * @notice Configure EagleRegistry on Base with all chains
 */
contract ConfigureRegistryBase is Script {
    // Registry address (same on all chains)
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    // Wrapped native tokens
    address constant WETH_ETHEREUM = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WETH_ARBITRUM = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant WETH_BASE = 0x4200000000000000000000000000000000000006;
    
    // LayerZero V2 Endpoints
    address constant LZ_ETHEREUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ARBITRUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_BASE = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // LayerZero V2 Endpoint IDs (EIDs)
    uint32 constant EID_ETHEREUM = 30101;
    uint32 constant EID_ARBITRUM = 30110;
    uint32 constant EID_BASE = 30184;
    
    function run() external {
        console.log("=============================================");
        console.log("CONFIGURE: EagleRegistry on Base");
        console.log("=============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Registry:", REGISTRY);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        require(block.chainid == 8453, "Must run on Base");
        
        EagleRegistry registry = EagleRegistry(REGISTRY);
        
        // Check ownership
        address owner = registry.owner();
        console.log("Registry Owner:", owner);
        require(owner == deployer, "Deployer is not owner");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Step 1: Registering chains...");
        console.log("");
        
        // Register Ethereum
        try registry.registerChain(
            1,                  // chainId
            "Ethereum",         // chainName
            WETH_ETHEREUM,      // wrappedNativeToken
            "WETH",             // wrappedNativeSymbol
            true                // isActive
        ) {
            console.log("[OK] Registered: Ethereum (1)");
        } catch {
            console.log("[SKIP] Ethereum already registered");
        }
        
        // Register Arbitrum
        try registry.registerChain(
            42161,              // chainId
            "Arbitrum One",     // chainName
            WETH_ARBITRUM,      // wrappedNativeToken
            "WETH",             // wrappedNativeSymbol
            true                // isActive
        ) {
            console.log("[OK] Registered: Arbitrum One (42161)");
        } catch {
            console.log("[SKIP] Arbitrum already registered");
        }
        
        // Register Base
        try registry.registerChain(
            8453,               // chainId
            "Base",             // chainName
            WETH_BASE,          // wrappedNativeToken
            "WETH",             // wrappedNativeSymbol
            true                // isActive
        ) {
            console.log("[OK] Registered: Base (8453)");
        } catch {
            console.log("[SKIP] Base already registered");
        }
        
        console.log("");
        console.log("Step 2: Setting LayerZero endpoints...");
        console.log("");
        
        // Set LayerZero endpoints
        registry.setLayerZeroEndpoint(1, LZ_ETHEREUM);
        console.log("[OK] Set LZ endpoint for Ethereum");
        
        registry.setLayerZeroEndpoint(42161, LZ_ARBITRUM);
        console.log("[OK] Set LZ endpoint for Arbitrum");
        
        registry.setLayerZeroEndpoint(8453, LZ_BASE);
        console.log("[OK] Set LZ endpoint for Base");
        
        console.log("");
        console.log("Step 3: Setting EID mappings...");
        console.log("");
        
        // Set EID mappings
        registry.setChainIdToEid(1, EID_ETHEREUM);
        console.log("[OK] Set EID for Ethereum: 1 -> 30101");
        
        registry.setChainIdToEid(42161, EID_ARBITRUM);
        console.log("[OK] Set EID for Arbitrum: 42161 -> 30110");
        
        registry.setChainIdToEid(8453, EID_BASE);
        console.log("[OK] Set EID for Base: 8453 -> 30184");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("=============================================");
        console.log("");
        console.log("Registered Chains:");
        console.log("  1. Ethereum (1)");
        console.log("  2. Arbitrum One (42161)");
        console.log("  3. Base (8453)");
        console.log("");
        console.log("LayerZero V2 Endpoints Set:");
        console.log("  Ethereum:  ", LZ_ETHEREUM);
        console.log("  Arbitrum:  ", LZ_ARBITRUM);
        console.log("  Base:      ", LZ_BASE);
        console.log("");
        console.log("EID Mappings:");
        console.log("  Ethereum (1)       -> EID 30101");
        console.log("  Arbitrum (42161)   -> EID 30110");
        console.log("  Base (8453)        -> EID 30184");
        console.log("");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title ConfigureRegistryBNB
 * @notice Configure EagleRegistry on BNB Chain with all chains
 */
contract ConfigureRegistryBNB is Script {
    // Registry address (same on all chains)
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    // Wrapped native tokens
    address constant WETH_ETHEREUM = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WETH_ARBITRUM = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant WETH_BASE = 0x4200000000000000000000000000000000000006;
    address constant WBNB_BSC = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    
    // LayerZero V2 Endpoints
    address constant LZ_ETHEREUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ARBITRUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_BASE = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_BSC = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // LayerZero V2 Endpoint IDs (EIDs)
    uint32 constant EID_ETHEREUM = 30101;
    uint32 constant EID_ARBITRUM = 30110;
    uint32 constant EID_BASE = 30184;
    uint32 constant EID_BSC = 30102;
    
    function run() external {
        console.log("CONFIGURE: EagleRegistry on BNB Chain");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(block.chainid == 56, "Must run on BNB Chain");
        
        EagleRegistry registry = EagleRegistry(REGISTRY);
        console.log("Registry Owner:", registry.owner());
        
        vm.startBroadcast(pk);
        _registerChains(registry);
        _setEndpoints(registry);
        _setEIDs(registry);
        vm.stopBroadcast();
        
        console.log("CONFIGURATION COMPLETE!");
    }
    
    function _registerChains(EagleRegistry registry) internal {
        console.log("Registering chains...");
        try registry.registerChain(1, "Ethereum", WETH_ETHEREUM, "WETH", true) {
            console.log("[OK] Ethereum");
        } catch { console.log("[SKIP] Ethereum"); }
        
        try registry.registerChain(42161, "Arbitrum One", WETH_ARBITRUM, "WETH", true) {
            console.log("[OK] Arbitrum");
        } catch { console.log("[SKIP] Arbitrum"); }
        
        try registry.registerChain(8453, "Base", WETH_BASE, "WETH", true) {
            console.log("[OK] Base");
        } catch { console.log("[SKIP] Base"); }
        
        try registry.registerChain(56, "BNB Chain", WBNB_BSC, "WBNB", true) {
            console.log("[OK] BNB Chain");
        } catch { console.log("[SKIP] BNB Chain"); }
    }
    
    function _setEndpoints(EagleRegistry registry) internal {
        console.log("Setting LayerZero endpoints...");
        registry.setLayerZeroEndpoint(1, LZ_ETHEREUM);
        registry.setLayerZeroEndpoint(42161, LZ_ARBITRUM);
        registry.setLayerZeroEndpoint(8453, LZ_BASE);
        registry.setLayerZeroEndpoint(56, LZ_BSC);
        console.log("[OK] All endpoints set");
    }
    
    function _setEIDs(EagleRegistry registry) internal {
        console.log("Setting EID mappings...");
        registry.setChainIdToEid(1, EID_ETHEREUM);
        registry.setChainIdToEid(42161, EID_ARBITRUM);
        registry.setChainIdToEid(8453, EID_BASE);
        registry.setChainIdToEid(56, EID_BSC);
        console.log("[OK] All EIDs set");
    }
}


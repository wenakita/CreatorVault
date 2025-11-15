// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EagleRegistry} from "../contracts/EagleRegistry.sol";

contract SetEIDsHyperEVM is Script {
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;

    // LayerZero EIDs
    uint32 constant EID_ETHEREUM = 30101;
    uint32 constant EID_ARBITRUM = 30110;
    uint32 constant EID_BASE = 30184;
    uint32 constant EID_BSC = 30102;
    uint32 constant EID_SONIC = 30332;
    uint32 constant EID_AVALANCHE = 30106;
    uint32 constant EID_HYPEREVM = 30367;

    function run() external {
        console.log("SET EIDs: EagleRegistry on HyperEVM");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(block.chainid == 999, "Must run on HyperEVM");
        
        EagleRegistry registry = EagleRegistry(REGISTRY);
        
        vm.startBroadcast(pk);
        
        console.log("Setting EID mappings...");
        registry.setChainIdToEid(1, EID_ETHEREUM);
        registry.setChainIdToEid(42161, EID_ARBITRUM);
        registry.setChainIdToEid(8453, EID_BASE);
        registry.setChainIdToEid(56, EID_BSC);
        registry.setChainIdToEid(146, EID_SONIC);
        registry.setChainIdToEid(43114, EID_AVALANCHE);
        registry.setChainIdToEid(999, EID_HYPEREVM);
        console.log("[OK] All EIDs set");
        
        vm.stopBroadcast();
        
        console.log("EID CONFIGURATION COMPLETE!");
    }
}


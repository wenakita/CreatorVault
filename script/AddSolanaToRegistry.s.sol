// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EagleRegistry} from "../contracts/EagleRegistry.sol";

/// @title AddSolanaToRegistry
/// @notice Adds Solana configuration to Eagle Registry on all EVM chains
/// @dev Run this script on each chain after deploying Solana program
contract AddSolanaToRegistry is Script {
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;

    // Solana Configuration
    uint16 constant SOLANA_CHAIN_ID = 30168; // Solana uses EID as chain ID
    uint32 constant SOLANA_EID = 30168;
    string constant SOLANA_NAME = "Solana";
    string constant WSOL_SYMBOL = "SOL";
    
    // Wrapped SOL address
    address constant WSOL = 0x1111111111111111111111111111111111111112; // Placeholder - Solana addresses are not EVM compatible
    
    // LayerZero V2 Solana Endpoint Program ID
    // TODO: Update with actual endpoint address when available
    address constant SOLANA_LZ_ENDPOINT = 0x76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6; // Placeholder

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        console.log("=============================================");
        console.log("ADD SOLANA TO REGISTRY");
        console.log("=============================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Registry:", REGISTRY);
        console.log("Caller:", vm.addr(pk));
        console.log("");
        
        EagleRegistry registry = EagleRegistry(REGISTRY);
        
        // Verify caller is owner
        address owner = registry.owner();
        require(owner == vm.addr(pk), "Caller is not registry owner");
        
        console.log("Registry Owner:", owner);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Register Solana chain
        console.log("Step 1: Registering Solana chain...");
        try registry.registerChain(
            SOLANA_CHAIN_ID,
            SOLANA_NAME,
            WSOL,
            WSOL_SYMBOL,
            true
        ) {
            console.log("[OK] Registered: Solana (Chain ID: %s)", SOLANA_CHAIN_ID);
        } catch {
            console.log("[SKIP] Solana already registered");
        }
        
        // Step 2: Set LayerZero endpoint
        console.log("Step 2: Setting LayerZero endpoint...");
        registry.setLayerZeroEndpoint(SOLANA_CHAIN_ID, SOLANA_LZ_ENDPOINT);
        console.log("[OK] Set LZ endpoint for Solana");
        
        // Step 3: Set EID mapping
        console.log("Step 3: Setting EID mapping...");
        registry.setChainIdToEid(SOLANA_CHAIN_ID, SOLANA_EID);
        console.log("[OK] Set EID mapping: %s -> %s", SOLANA_CHAIN_ID, SOLANA_EID);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("=============================================");
        console.log("");
        
        // Verify configuration
        console.log("Verification:");
        bool isSupported = registry.isChainSupported(SOLANA_CHAIN_ID);
        console.log("  Chain Supported:", isSupported ? "YES" : "NO");
        
        address endpoint = registry.getLayerZeroEndpoint(SOLANA_CHAIN_ID);
        console.log("  LZ Endpoint:", endpoint);
        
        uint32 eid = registry.getEidForChainId(SOLANA_CHAIN_ID);
        console.log("  EID:", eid);
        
        console.log("");
        console.log("Solana has been added to the registry!");
        console.log("");
        
        // Display current supported chains
        uint256 chainCount = registry.getSupportedChainCount();
        console.log("Total supported chains: %s", chainCount);
    }
}


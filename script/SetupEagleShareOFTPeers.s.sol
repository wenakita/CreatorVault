// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

/**
 * @title SetupEagleShareOFTPeers
 * @notice Configure LayerZero peers for EagleShareOFT cross-chain bridge
 * 
 * Usage:
 *   forge script script/SetupEagleShareOFTPeers.s.sol:SetupEagleShareOFTPeers \
 *     --rpc-url ethereum \
 *     --broadcast \
 *     --verify
 */
contract SetupEagleShareOFTPeers is Script {
    // =================================
    // CONFIGURATION
    // =================================
    
    // EagleShareOFT on Ethereum
    address constant EAGLE_SHARE_OFT_ETH = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Solana Program ID (convert to bytes32 for setPeer)
    // 3973MRkbN9E3GW4TnE9A8VzAgNxWAVRSAFVW4QQktAkb
    bytes32 constant SOLANA_PROGRAM_BYTES32 = 0x000000000000000000000000207f1ae831b5ae3a1a03c41ff3b57b63c22b3935;
    
    // LayerZero Endpoint IDs
    uint32 constant EID_ETHEREUM = 30101;
    uint32 constant EID_SOLANA = 30168; // LayerZero V2 Solana EID
    
    // =================================
    // SETUP FUNCTION
    // =================================
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=============================================");
        console.log("  SETUP: EagleShareOFT LayerZero Peers");
        console.log("=============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        // Check current chain
        require(block.chainid == 1, "Must run on Ethereum mainnet");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Setting Solana as peer for EagleShareOFT...");
        console.log("");
        console.log("Configuration:");
        console.log("  EagleShareOFT (ETH): ", EAGLE_SHARE_OFT_ETH);
        console.log("  Solana Program:      ", vm.toString(SOLANA_PROGRAM_BYTES32));
        console.log("  Solana EID:          ", EID_SOLANA);
        console.log("");
        
        // Call setPeer on EagleShareOFT
        // function setPeer(uint32 _eid, bytes32 _peer) external onlyOwner
        (bool success, bytes memory returnData) = EAGLE_SHARE_OFT_ETH.call(
            abi.encodeWithSignature(
                "setPeer(uint32,bytes32)",
                EID_SOLANA,
                SOLANA_PROGRAM_BYTES32
            )
        );
        
        if (!success) {
            console.log("ERROR: setPeer failed");
            if (returnData.length > 0) {
                console.log("Reason:", string(returnData));
            }
            revert("setPeer failed");
        }
        
        console.log("[OK] Peer set successfully!");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=============================================");
        console.log("  CONFIGURATION COMPLETE!");
        console.log("=============================================");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Configure Solana program to accept messages from Ethereum");
        console.log("2. Register peer chain in Solana program");
        console.log("3. Test cross-chain message");
        console.log("");
        console.log("Solana Setup:");
        console.log("  cd programs/eagle-registry-solana");
        console.log("  anchor run configure-ethereum-peer");
    }
}


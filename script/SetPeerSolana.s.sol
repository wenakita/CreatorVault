// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

/**
 * @title SetPeerSolana
 * @notice Generate calldata for Safe multisig to set Solana as peer in EagleShareOFT
 * 
 * Usage:
 *   forge script script/SetPeerSolana.s.sol:SetPeerSolana
 */
contract SetPeerSolana is Script {
    // EagleShareOFT on Ethereum
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Solana Program ID as bytes32
    // 3973MRkbN9E3GW4TnE9A8VzAgNxWAVRSAFVW4QQktAkb
    bytes32 constant SOLANA_PEER = 0x000000000000000000000000207f1ae831b5ae3a1a03c41ff3b57b63c22b3935;
    
    // LayerZero Solana EID
    uint32 constant SOLANA_EID = 30168;
    
    function run() external view {
        console.log("==============================================");
        console.log("  GENERATE: setPeer Calldata for Safe");
        console.log("==============================================");
        console.log("");
        console.log("Target Contract: ", EAGLE_SHARE_OFT);
        console.log("Function:        setPeer(uint32,bytes32)");
        console.log("Solana EID:      ", SOLANA_EID);
        console.log("Solana Peer:     ", vm.toString(SOLANA_PEER));
        console.log("");
        
        // Generate calldata
        bytes memory calldata_ = abi.encodeWithSignature(
            "setPeer(uint32,bytes32)",
            SOLANA_EID,
            SOLANA_PEER
        );
        
        console.log("==============================================");
        console.log("  SAFE TRANSACTION DETAILS");
        console.log("==============================================");
        console.log("");
        console.log("To:       ", EAGLE_SHARE_OFT);
        console.log("Value:    ", "0");
        console.log("Calldata: ", vm.toString(calldata_));
        console.log("");
        console.log("==============================================");
        console.log("  INSTRUCTIONS");
        console.log("==============================================");
        console.log("");
        console.log("1. Go to Safe wallet UI:");
        console.log("   https://app.safe.global/home?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
        console.log("");
        console.log("2. Click 'New Transaction' -> 'Transaction Builder'");
        console.log("");
        console.log("3. Enter:");
        console.log("   To: ", EAGLE_SHARE_OFT);
        console.log("   Value: 0");
        console.log("   Calldata: (see above)");
        console.log("");
        console.log("4. Review and submit for signatures");
        console.log("");
        console.log("5. After execution, verify with:");
        console.log("   cast call 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E");
        console.log("   'peers(uint32)(bytes32)' 30168 --rpc-url ethereum");
        console.log("");
    }
}


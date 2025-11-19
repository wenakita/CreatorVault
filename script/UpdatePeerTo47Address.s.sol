// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title UpdatePeerTo47Address
 * @notice Updates the LayerZero peer to the new vanity Solana address: 6LJBmKz9jpCk6WAcD2WxaAy1xxX47H34FrdVN6DyEAGL
 * @dev For Safe multisig execution on Ethereum mainnet
 */
contract UpdatePeerTo47Address is Script {
    // Mainnet addresses
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    uint32 constant SOLANA_EID = 30168;
    
    // New vanity Solana address: 6LJBmKz9jpCk6WAcD2WxaAy1xxX47H34FrdVN6DyEAGL
    bytes32 constant SOLANA_PEER = 0x4f3be6dd41d10a2fdc827d6409d20a81696a334c0a3a48bf00e3246579181085;

    function run() external view {
        console.log("\n=== UPDATE LAYERZERO PEER TO VANITY ADDRESS ===");
        console.log("EagleShareOFT:", EAGLE_SHARE_OFT);
        console.log("Solana EID:", SOLANA_EID);
        console.log("New Solana Address: 6LJBmKz9jpCk6WAcD2WxaAy1xxX47H34FrdVN6DyEAGL");
        console.log("Bytes32:", vm.toString(SOLANA_PEER));
        
        // Generate setPeer calldata
        bytes memory setPeerCalldata = abi.encodeWithSignature(
            "setPeer(uint32,bytes32)",
            SOLANA_EID,
            SOLANA_PEER
        );
        
        console.log("\n=== SAFE TRANSACTION ===");
        console.log("To:", EAGLE_SHARE_OFT);
        console.log("Value: 0");
        console.log("Data:", vm.toString(setPeerCalldata));
        
        console.log("\n=== CAST COMMAND ===");
        console.log("cast send %s \\", EAGLE_SHARE_OFT);
        console.log("  'setPeer(uint32,bytes32)' \\");
        console.log("  %s \\", SOLANA_EID);
        console.log("  %s \\", vm.toString(SOLANA_PEER));
        console.log("  --from <YOUR_SAFE>");
        
        console.log("\n=== VERIFICATION ===");
        console.log("After execution, verify with:");
        console.log("cast call %s \\", EAGLE_SHARE_OFT);
        console.log("  'peers(uint32)(bytes32)' \\");
        console.log("  %s", SOLANA_EID);
        console.log("Expected: %s", vm.toString(SOLANA_PEER));
    }
}

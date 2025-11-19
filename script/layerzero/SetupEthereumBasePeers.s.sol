// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title SetupEthereumBasePeers
 * @notice Connect EagleShareOFT on Ethereum with Base using LayerZero
 * 
 * @dev This enables the Composer on Ethereum to bridge EAGLE tokens to/from Base
 * 
 * @dev Architecture:
 *      - EagleShareOFT on both chains (same address via CREATE2)
 *      - Composer on Ethereum can now send EAGLE to Base
 *      - Users on Base can hold/transfer EAGLE
 *      - Users on Base can bridge back to Ethereum via Composer
 * 
 * @dev Usage:
 *      # Step 1: Configure from Ethereum side
 *      forge script script/layerzero/SetupEthereumBasePeers.s.sol:SetupEthereumBasePeers \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 * 
 *      # Step 2: Configure from Base side
 *      forge script script/layerzero/SetupEthereumBasePeers.s.sol:SetupEthereumBasePeers \
 *        --rpc-url $BASE_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract SetupEthereumBasePeers is Script {
    
    // =================================
    // ADDRESSES
    // =================================
    
    // EagleShareOFT deployed at same address on both chains (CREATE2)
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Composer (Ethereum only) - no changes needed, just documenting
    address constant COMPOSER_ETHEREUM = 0x3A91B3e863C0bd6948088e8A0A9B1D22d6D05da9;
    
    // =================================
    // LAYERZERO V2 CONFIGURATION
    // =================================
    
    // LayerZero Endpoint IDs (EIDs)
    uint32 constant ETHEREUM_EID = 30101;
    uint32 constant BASE_EID = 30184;
    
    // Chain IDs for detection
    uint256 constant ETHEREUM_CHAIN_ID = 1;
    uint256 constant BASE_CHAIN_ID = 8453;
    
    // =================================
    // MAIN FUNCTION
    // =================================
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("  SETUP: Ethereum <-> Base Bridge");
        console.log("  EagleShareOFT LayerZero Peers");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        // Determine which chain we're on
        uint32 localEid;
        uint32 remoteEid;
        string memory localName;
        string memory remoteName;
        
        if (block.chainid == ETHEREUM_CHAIN_ID) {
            localEid = ETHEREUM_EID;
            remoteEid = BASE_EID;
            localName = "Ethereum";
            remoteName = "Base";
            console.log("Mode: Configuring Ethereum -> Base");
        } else if (block.chainid == BASE_CHAIN_ID) {
            localEid = BASE_EID;
            remoteEid = ETHEREUM_EID;
            localName = "Base";
            remoteName = "Ethereum";
            console.log("Mode: Configuring Base -> Ethereum");
        } else {
            revert("Unsupported chain. Must be Ethereum (1) or Base (8453)");
        }
        
        console.log("");
        console.log("Configuration:");
        console.log("  Local Chain:", localName);
        console.log("  Local EID:", localEid);
        console.log("  Remote Chain:", remoteName);
        console.log("  Remote EID:", remoteEid);
        console.log("  EagleShareOFT:", EAGLE_SHARE_OFT);
        console.log("");
        
        // Convert address to bytes32 for LayerZero peer format
        bytes32 peerAddress = bytes32(uint256(uint160(EAGLE_SHARE_OFT)));
        
        console.log("Peer Address (bytes32):", vm.toString(peerAddress));
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Call setPeer on the OFT
        console.log("Calling setPeer on EagleShareOFT...");
        (bool success, bytes memory returnData) = EAGLE_SHARE_OFT.call(
            abi.encodeWithSignature(
                "setPeer(uint32,bytes32)",
                remoteEid,
                peerAddress
            )
        );
        
        if (!success) {
            console.log("");
            console.log("ERROR: setPeer failed");
            if (returnData.length > 0) {
                console.log("Reason:", vm.toString(returnData));
            }
            console.log("");
            console.log("Possible reasons:");
            console.log("1. Not owner - must be called by OFT owner");
            console.log("2. Peer already set - check with: cast call", EAGLE_SHARE_OFT, "'peers(uint32)(bytes32)'", remoteEid);
            console.log("3. Contract not deployed at expected address");
            revert("setPeer failed");
        }
        
        console.log("SUCCESS! Peer configured.");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("==============================================");
        console.log("  CONFIGURATION COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Status:", localName, "now trusts", remoteName);
        console.log("");
        
        if (block.chainid == ETHEREUM_CHAIN_ID) {
            console.log("Next Steps:");
            console.log("1. Run this script again on BASE network");
            console.log("   forge script script/layerzero/SetupEthereumBasePeers.s.sol \\");
            console.log("     --rpc-url $BASE_RPC_URL \\");
            console.log("     --broadcast");
            console.log("");
            console.log("2. After both are configured, test bridging:");
            console.log("   - Use Composer to deposit WLFI -> EAGLE on Ethereum");
            console.log("   - Bridge EAGLE from Ethereum to Base");
            console.log("   - Hold/transfer on Base");
            console.log("   - Bridge back to Ethereum");
            console.log("");
            console.log("Composer Integration:");
            console.log("  The Composer (", COMPOSER_ETHEREUM, ") already supports");
            console.log("  cross-chain operations via depositAndSend() and redeemAndSend()");
            console.log("  No changes needed to Composer contract!");
        } else {
            console.log("Next Steps:");
            console.log("1. If you haven't already, run this script on ETHEREUM");
            console.log("   forge script script/layerzero/SetupEthereumBasePeers.s.sol \\");
            console.log("     --rpc-url $ETHEREUM_RPC_URL \\");
            console.log("     --broadcast");
            console.log("");
            console.log("2. Test bridging EAGLE between Ethereum and Base");
            console.log("");
            console.log("Base Setup Complete:");
            console.log("  Users can now receive EAGLE on Base");
            console.log("  Bridge back to Ethereum anytime via Composer");
        }
        console.log("");
        
        // Verification commands
        console.log("==============================================");
        console.log("  VERIFY CONFIGURATION");
        console.log("==============================================");
        console.log("");
        console.log("Check peer is set correctly:");
        console.log("  cast call", EAGLE_SHARE_OFT, " \\");
        console.log("    'peers(uint32)(bytes32)' \\");
        console.log("    ", remoteEid, " \\");
        console.log("    --rpc-url [YOUR_RPC]");
        console.log("");
        console.log("Expected output:", vm.toString(peerAddress));
        console.log("");
        
        _saveConfiguration(localName, remoteName, localEid, remoteEid);
    }
    
    /**
     * @notice Save configuration to JSON file
     */
    function _saveConfiguration(
        string memory localChain,
        string memory remoteChain,
        uint32 localEid,
        uint32 remoteEid
    ) internal {
        string memory fileName = string.concat(
            "./deployments/shared/layerzero_peers_",
            localChain,
            "_to_",
            remoteChain,
            ".json"
        );
        
        string memory json = "{}";
        json = vm.serializeString(json, "localChain", localChain);
        json = vm.serializeString(json, "remoteChain", remoteChain);
        json = vm.serializeUint(json, "localEid", localEid);
        json = vm.serializeUint(json, "remoteEid", remoteEid);
        json = vm.serializeAddress(json, "eagleShareOFT", EAGLE_SHARE_OFT);
        json = vm.serializeAddress(json, "composer", COMPOSER_ETHEREUM);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeString(json, "status", "configured");
        
        vm.writeJson(json, fileName);
        console.log("Configuration saved to:", fileName);
        console.log("");
    }
}


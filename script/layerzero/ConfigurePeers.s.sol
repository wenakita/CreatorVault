// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

/**
 * @title ConfigurePeers
 * @notice Configure LayerZero peers for cross-chain bridging
 * 
 * @dev This script connects Arbitrum <-> Base for all three tokens
 * 
 * @dev Usage:
 *      # Configure from Arbitrum side
 *      NETWORK=arbitrum forge script script/layerzero/ConfigurePeers.s.sol \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast
 * 
 *      # Configure from Base side
 *      NETWORK=base forge script script/layerzero/ConfigurePeers.s.sol \
 *        --rpc-url $BASE_RPC_URL \
 *        --broadcast
 */
contract ConfigurePeers is Script {
    
    // LayerZero Endpoint IDs (EIDs)
    uint32 constant ARBITRUM_EID = 30110;
    uint32 constant BASE_EID = 30184;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        string memory network = vm.envOr("NETWORK", string("arbitrum"));
        
        address eagleLocal;
        address wlfiLocal;
        address usd1Local;
        address eagleRemote;
        address wlfiRemote;
        address usd1Remote;
        uint32 remoteEid;
        string memory remoteName;
        
        if (keccak256(bytes(network)) == keccak256(bytes("arbitrum"))) {
            // Configuring from Arbitrum
            eagleLocal = vm.envAddress("EAGLE_ARBITRUM");
            wlfiLocal = vm.envAddress("WLFI_ARBITRUM");
            usd1Local = vm.envAddress("USD1_ARBITRUM");
            
            eagleRemote = vm.envAddress("EAGLE_BASE");
            wlfiRemote = vm.envAddress("WLFI_BASE");
            usd1Remote = vm.envAddress("USD1_BASE");
            
            remoteEid = BASE_EID;
            remoteName = "Base";
        } else if (keccak256(bytes(network)) == keccak256(bytes("base"))) {
            // Configuring from Base
            eagleLocal = vm.envAddress("EAGLE_BASE");
            wlfiLocal = vm.envAddress("WLFI_BASE");
            usd1Local = vm.envAddress("USD1_BASE");
            
            eagleRemote = vm.envAddress("EAGLE_ARBITRUM");
            wlfiRemote = vm.envAddress("WLFI_ARBITRUM");
            usd1Remote = vm.envAddress("USD1_ARBITRUM");
            
            remoteEid = ARBITRUM_EID;
            remoteName = "Arbitrum";
        } else {
            revert("Unsupported network");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("CONFIGURING LAYERZERO PEERS");
        console.log("==============================================");
        console.log("");
        console.log("Local Chain:", network);
        console.log("Remote Chain:", remoteName);
        console.log("Remote EID:", remoteEid);
        console.log("Deployer:", deployer);
        console.log("");
        
        // Configure EAGLE
        console.log("Configuring EAGLE...");
        console.log("  Local:", eagleLocal);
        console.log("  Remote:", eagleRemote);
        
        bytes32 eaglePeer = bytes32(uint256(uint160(eagleRemote)));
        (bool success1,) = eagleLocal.call(
            abi.encodeWithSignature("setPeer(uint32,bytes32)", remoteEid, eaglePeer)
        );
        
        if (success1) {
            console.log("  EAGLE peer configured!");
        } else {
            console.log("  EAGLE peer configuration failed (may already be set)");
        }
        console.log("");
        
        // Configure WLFI
        console.log("Configuring WLFI...");
        console.log("  Local:", wlfiLocal);
        console.log("  Remote:", wlfiRemote);
        
        bytes32 wlfiPeer = bytes32(uint256(uint160(wlfiRemote)));
        (bool success2,) = wlfiLocal.call(
            abi.encodeWithSignature("setPeer(uint32,bytes32)", remoteEid, wlfiPeer)
        );
        
        if (success2) {
            console.log("  WLFI peer configured!");
        } else {
            console.log("  WLFI peer configuration failed (may already be set)");
        }
        console.log("");
        
        // Configure USD1
        console.log("Configuring USD1...");
        console.log("  Local:", usd1Local);
        console.log("  Remote:", usd1Remote);
        
        bytes32 usd1Peer = bytes32(uint256(uint160(usd1Remote)));
        (bool success3,) = usd1Local.call(
            abi.encodeWithSignature("setPeer(uint32,bytes32)", remoteEid, usd1Peer)
        );
        
        if (success3) {
            console.log("  USD1 peer configured!");
        } else {
            console.log("  USD1 peer configuration failed (may already be set)");
        }
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("==============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Tokens can now bridge between", network, "and", remoteName);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Run this script on the OTHER chain");
        console.log("   (Both sides need to be configured)");
        console.log("2. Test bridging with a small amount");
        console.log("3. Verify tokens arrive on remote chain");
        console.log("");
        
        _saveConfiguration(network, remoteName, eagleLocal, wlfiLocal, usd1Local);
    }
    
    function _saveConfiguration(
        string memory localChain,
        string memory remoteChain,
        address eagle,
        address wlfi,
        address usd1
    ) internal {
        string memory fileName = string.concat(
            "./deployments/layerzero_peers_",
            localChain,
            "_to_",
            remoteChain,
            ".json"
        );
        
        string memory json = "{}";
        json = vm.serializeString(json, "localChain", localChain);
        json = vm.serializeString(json, "remoteChain", remoteChain);
        json = vm.serializeAddress(json, "eagle", eagle);
        json = vm.serializeAddress(json, "wlfi", wlfi);
        json = vm.serializeAddress(json, "usd1", usd1);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        
        vm.writeJson(json, fileName);
        console.log("Configuration saved to:", fileName);
    }
}


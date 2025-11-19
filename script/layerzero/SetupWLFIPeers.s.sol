// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title SetupWLFIPeers
 * @notice Connect WLFI OFT Adapter on Ethereum with WLFI OFT on Base using LayerZero
 * 
 * @dev Usage:
 *      # Step 1: Configure from Ethereum side
 *      forge script script/layerzero/SetupWLFIPeers.s.sol:SetupWLFIPeers \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 * 
 *      # Step 2: Configure from Base side
 *      forge script script/layerzero/SetupWLFIPeers.s.sol:SetupWLFIPeers \
 *        --rpc-url $BASE_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract SetupWLFIPeers is Script {
    
    // =================================
    // ADDRESSES
    // =================================
    
    // WLFI Adapter (Ethereum only)
    address constant WLFI_ADAPTER_ETHEREUM = 0x2437F6555350c131647daA0C655c4B49A7aF3621;
    
    // WLFI OFT (Base - CREATE2 vanity address matching EAGLE pattern)
    address constant WLFI_OFT_BASE = 0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e;
    
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
        console.log("  SETUP: Ethereum <-> Base Bridge (WLFI)");
        console.log("  WLFI OFT LayerZero Peers");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        // Determine which chain we're on
        uint32 localEid;
        uint32 remoteEid;
        address localContract;
        address remoteContract;
        string memory localName;
        string memory remoteName;
        
        if (block.chainid == ETHEREUM_CHAIN_ID) {
            localEid = ETHEREUM_EID;
            remoteEid = BASE_EID;
            localContract = WLFI_ADAPTER_ETHEREUM;
            remoteContract = WLFI_OFT_BASE;
            localName = "Ethereum";
            remoteName = "Base";
            console.log("Mode: Configuring Ethereum -> Base");
        } else if (block.chainid == BASE_CHAIN_ID) {
            localEid = BASE_EID;
            remoteEid = ETHEREUM_EID;
            localContract = WLFI_OFT_BASE;
            remoteContract = WLFI_ADAPTER_ETHEREUM;
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
        console.log("  Local Contract:", localContract);
        console.log("  Remote Chain:", remoteName);
        console.log("  Remote EID:", remoteEid);
        console.log("  Remote Contract:", remoteContract);
        console.log("");
        
        // Convert address to bytes32 for LayerZero peer format
        bytes32 peerAddress = bytes32(uint256(uint160(remoteContract)));
        
        console.log("Setting peer to:", vm.toString(peerAddress));
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Call setPeer on the OFT
        console.log("Calling setPeer...");
        (bool success, bytes memory returnData) = localContract.call(
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
            console.log("2. Peer already set - check with: cast call", localContract, "'peers(uint32)(bytes32)'", remoteEid);
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
            console.log("   forge script script/layerzero/SetupWLFIPeers.s.sol \\");
            console.log("     --rpc-url $BASE_RPC_URL \\");
            console.log("     --broadcast");
            console.log("");
            console.log("2. After both are configured, test bridging:");
            console.log("   - Bridge WLFI from Ethereum to Base");
            console.log("   - Bridge WLFI from Base to Ethereum");
        } else {
            console.log("Next Steps:");
            console.log("1. If you haven't already, run this script on ETHEREUM");
            console.log("   forge script script/layerzero/SetupWLFIPeers.s.sol \\");
            console.log("     --rpc-url $ETHEREUM_RPC_URL \\");
            console.log("     --broadcast");
            console.log("");
            console.log("2. Test bridging WLFI between Ethereum and Base");
        }
        console.log("");
        
        // Verification commands
        console.log("==============================================");
        console.log("  VERIFY CONFIGURATION");
        console.log("==============================================");
        console.log("");
        console.log("Check peer is set correctly:");
        console.log("  cast call", localContract, " \\");
        console.log("    'peers(uint32)(bytes32)' \\");
        console.log("    ", remoteEid, " \\");
        console.log("    --rpc-url [YOUR_RPC]");
        console.log("");
        console.log("Expected output:", vm.toString(peerAddress));
        console.log("");
    }
}


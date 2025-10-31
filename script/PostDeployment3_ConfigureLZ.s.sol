// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { IOAppCore } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppCore.sol";

/**
 * @title PostDeployment3_ConfigureLZ
 * @notice Configures LayerZero peers for cross-chain operations
 * @dev Sets up peer addresses for OFT contracts on Sepolia to connect to other chains
 * 
 * NOTE: This is a template. For actual cross-chain setup, you need to:
 * 1. Deploy the same OFT contracts on spoke chains (Arbitrum Sepolia, Base Sepolia, etc.)
 * 2. Update the peer addresses in this script with actual deployed addresses
 * 3. Run this script on each chain to establish bi-directional peers
 */
contract PostDeployment3_ConfigureLZ is Script {
    // Deployed contract addresses on Sepolia (Hub)
    address constant WLFI_OFT = 0xba9B60A00fD10323Abbdc1044627B54D3ebF470e;
    address constant USD1_OFT = 0x93d48D3625fF8E522f63E873352256607b37f2EF;
    address constant SHARE_OFT = 0xbeA4D2841e1892a8186853A818F5db43D2C5071E;
    address constant COMPOSER = 0x87B831E8e1b09B35c888595cBae81CeA0d6bB260;
    
    // LayerZero Endpoint IDs (V2)
    uint32 constant EID_SEPOLIA = 40161;
    uint32 constant EID_ARBITRUM_SEPOLIA = 40231;
    uint32 constant EID_BASE_SEPOLIA = 40245;
    uint32 constant EID_OPTIMISM_SEPOLIA = 40232;
    
    // Placeholder addresses - UPDATE THESE after deploying to spoke chains
    address constant WLFI_OFT_ARBITRUM = address(0); // Deploy on Arbitrum Sepolia first
    address constant USD1_OFT_ARBITRUM = address(0);
    address constant SHARE_OFT_ARBITRUM = address(0);
    
    address constant WLFI_OFT_BASE = address(0); // Deploy on Base Sepolia first
    address constant USD1_OFT_BASE = address(0);
    address constant SHARE_OFT_BASE = address(0);
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=================================================");
        console.log("POST-DEPLOYMENT: CONFIGURE LAYERZERO PEERS");
        console.log("=================================================");
        console.log("");
        console.log("Configuring from:", deployer);
        console.log("Current chain: Sepolia (Hub)");
        console.log("");
        
        console.log("WARNING  IMPORTANT:");
        console.log("This script requires spoke chain deployments first.");
        console.log("Current status: Spoke chains not yet deployed");
        console.log("");
        
        if (WLFI_OFT_ARBITRUM == address(0)) {
            console.log("[FAIL] Arbitrum Sepolia contracts not deployed yet");
            console.log("   Please deploy contracts to Arbitrum Sepolia first");
            console.log("");
        }
        
        if (WLFI_OFT_BASE == address(0)) {
            console.log("[FAIL] Base Sepolia contracts not deployed yet");
            console.log("   Please deploy contracts to Base Sepolia first");
            console.log("");
        }
        
        console.log("=================================================");
        console.log("CONFIGURATION GUIDE");
        console.log("=================================================");
        console.log("");
        console.log("To complete LayerZero setup:");
        console.log("");
        console.log("1. Deploy OFT contracts to spoke chains:");
        console.log("   - Arbitrum Sepolia");
        console.log("   - Base Sepolia");
        console.log("   - Optimism Sepolia");
        console.log("");
        console.log("2. Update peer addresses in this script");
        console.log("");
        console.log("3. Run setPeer() for each OFT contract:");
        console.log("   Example:");
        console.log("   wlfiOFT.setPeer(EID_ARBITRUM_SEPOLIA, bytes32(uint256(uint160(WLFI_OFT_ARBITRUM))))");
        console.log("");
        console.log("4. Repeat on each spoke chain (bi-directional)");
        console.log("");
        console.log("5. Test cross-chain transfers");
        console.log("");
        
        // Placeholder configuration (will be enabled once spoke chains are deployed)
        console.log("Template configuration ready.");
        console.log("Waiting for spoke chain deployments...");
        console.log("");
        
        // Example of how to set peers (commented out until spoke chains are ready)
        /*
        if (WLFI_OFT_ARBITRUM != address(0)) {
            console.log("Setting WLFI OFT peer for Arbitrum Sepolia...");
            IOAppCore(WLFI_OFT).setPeer(
                EID_ARBITRUM_SEPOLIA,
                bytes32(uint256(uint160(WLFI_OFT_ARBITRUM)))
            );
            console.log("  [OK] WLFI peer set for Arbitrum Sepolia");
        }
        
        if (USD1_OFT_ARBITRUM != address(0)) {
            console.log("Setting USD1 OFT peer for Arbitrum Sepolia...");
            IOAppCore(USD1_OFT).setPeer(
                EID_ARBITRUM_SEPOLIA,
                bytes32(uint256(uint160(USD1_OFT_ARBITRUM)))
            );
            console.log("  [OK] USD1 peer set for Arbitrum Sepolia");
        }
        
        if (SHARE_OFT_ARBITRUM != address(0)) {
            console.log("Setting Share OFT peer for Arbitrum Sepolia...");
            IOAppCore(SHARE_OFT).setPeer(
                EID_ARBITRUM_SEPOLIA,
                bytes32(uint256(uint160(SHARE_OFT_ARBITRUM)))
            );
            console.log("  [OK] Share OFT peer set for Arbitrum Sepolia");
        }
        */
        
        console.log("Next: Deploy to spoke chains (Arbitrum, Base, Optimism)");
        
        vm.stopBroadcast();
    }
}


pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { IOAppCore } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppCore.sol";

/**
 * @title PostDeployment3_ConfigureLZ
 * @notice Configures LayerZero peers for cross-chain operations
 * @dev Sets up peer addresses for OFT contracts on Sepolia to connect to other chains
 * 
 * NOTE: This is a template. For actual cross-chain setup, you need to:
 * 1. Deploy the same OFT contracts on spoke chains (Arbitrum Sepolia, Base Sepolia, etc.)
 * 2. Update the peer addresses in this script with actual deployed addresses
 * 3. Run this script on each chain to establish bi-directional peers
 */

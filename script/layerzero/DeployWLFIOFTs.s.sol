// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/WLFIOFTAdapter.sol";
import "../../contracts/layerzero/oft/WLFIOFT.sol";

/**
 * @title DeployWLFIOFTs
 * @notice Deploy WLFI OFT Adapter (Ethereum) and WLFI OFT (Base)
 */
contract DeployWLFIOFTs is Script {
    // LayerZero V2 Endpoints
    address constant LZ_ETHEREUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_BASE = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // WLFI token on Ethereum
    address constant WLFI_ETHEREUM = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=============================================");
        console.log("DEPLOY: WLFI OFTs for Cross-Chain Bridge");
        console.log("=============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        if (block.chainid == 1) {
            // Deploy WLFI OFT Adapter on Ethereum
            console.log("Deploying WLFI OFT Adapter on Ethereum...");
            
            WLFIOFTAdapter adapter = new WLFIOFTAdapter(
                WLFI_ETHEREUM,
                LZ_ETHEREUM,
                deployer
            );
            
            console.log("[OK] WLFI OFT Adapter:", address(adapter));
            console.log("");
            
        } else if (block.chainid == 8453) {
            // Deploy WLFI OFT on Base
            console.log("Deploying WLFI OFT on Base...");
            
            WLFIOFT oft = new WLFIOFT(
                "WLFI",
                "WLFI",
                LZ_BASE,
                deployer
            );
            
            console.log("[OK] WLFI OFT:", address(oft));
            console.log("");
            
        } else {
            revert("Unsupported chain");
        }
        
        vm.stopBroadcast();
        
        console.log("=============================================");
        console.log("[SUCCESS] Deployment complete!");
        console.log("=============================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Run: forge script script/layerzero/ConfigureWLFIOFTs.s.sol");
        console.log("2. Test: npx tsx scripts/testing/test-eagle-to-wlfi-compose.ts");
    }
}


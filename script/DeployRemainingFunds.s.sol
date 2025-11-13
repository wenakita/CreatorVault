// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployRemainingFunds
 * @notice Deploy remaining idle funds with working swap logic
 */
contract DeployRemainingFunds is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("DEPLOY REMAINING FUNDS (SWAPS WORKING!)");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        require(deployer == vault.management(), "Not management!");
        console.log("");
        
        // Check idle funds
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle WLFI before:", wlfiBalance / 1e18);
        console.log("");
        
        if (wlfiBalance == 0) {
            console.log("No idle funds to deploy!");
            return;
        }
        
        vm.startBroadcast(pk);
        
        console.log("Deploying remaining funds...");
        console.log("(Swaps are enabled - this should work!)");
        console.log("");
        
        try vault.forceDeployToStrategies() {
            console.log("[SUCCESS!] Funds deployed!");
            
            uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
            console.log("");
            console.log("Idle WLFI after:", wlfiAfter / 1e18);
            console.log("Deployed:", (wlfiBalance - wlfiAfter) / 1e18, "WLFI");
            
        } catch Error(string memory reason) {
            console.log("[INFO]", reason);
            
            uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
            if (wlfiAfter < wlfiBalance) {
                console.log("");
                console.log("Partial deployment succeeded!");
                console.log("  Deployed:", (wlfiBalance - wlfiAfter) / 1e18, "WLFI");
                console.log("  Remaining:", wlfiAfter / 1e18, "WLFI");
                console.log("");
                console.log("Keep calling this script to deploy more!");
            } else {
                console.log("");
                console.log("Possible reasons:");
                console.log("  - StalePrice: Oracle data too old");
                console.log("  - cross: Still out of range (unlikely)");
                console.log("");
                console.log("Wait a few minutes and try again");
            }
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("COMPLETE");
        console.log("===============================================");
    }
}


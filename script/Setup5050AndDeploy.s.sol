// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Setup5050AndDeploy is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    // Strategies
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        EagleOVault vault = EagleOVault(payable(VAULT));
        
        console.log("====================================================");
        console.log("SETTING UP 50/50 STRATEGY SPLIT");
        console.log("====================================================");
        console.log("");
        
        uint256 balanceBefore = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle funds:", balanceBefore / 1e18, "WLFI");
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Remove WETH strategy (currently at 100%)
        console.log("[1/4] Removing WETH strategy...");
        vault.removeStrategy(WETH_STRATEGY);
        console.log("      [OK]");
        console.log("");
        
        // Step 2: Re-add WETH strategy at 50%
        console.log("[2/4] Adding WETH strategy at 50%...");
        vault.addStrategy(WETH_STRATEGY, 5000);
        console.log("      [OK]");
        console.log("");
        
        // Step 3: Add USD1 strategy at 50%
        console.log("[3/4] Adding USD1 strategy at 50%...");
        vault.addStrategy(USD1_STRATEGY, 5000);
        console.log("      [OK]");
        console.log("");
        
        // Step 4: Deploy funds (will split 50/50)
        console.log("[4/4] Deploying funds (50/50 split)...");
        vault.forceDeployToStrategies();
        console.log("      [OK]");
        
        vm.stopBroadcast();
        
        uint256 balanceAfter = IERC20(WLFI).balanceOf(VAULT);
        uint256 deployed = balanceBefore - balanceAfter;
        
        console.log("");
        console.log("====================================================");
        console.log("SUCCESS!");
        console.log("====================================================");
        console.log("USD1 Strategy:  50%", USD1_STRATEGY);
        console.log("WETH Strategy:  50%", WETH_STRATEGY);
        console.log("");
        console.log("Total deployed:", deployed / 1e18, "WLFI");
        console.log("Remaining idle:", balanceAfter / 1e18, "WLFI");
        console.log("====================================================");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract JustDeployFunds is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        EagleOVault vault = EagleOVault(payable(VAULT));
        
        console.log("====================================================");
        console.log("DEPLOYING IDLE FUNDS TO STRATEGY");
        console.log("====================================================");
        console.log("");
        
        uint256 balanceBefore = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle funds:", balanceBefore / 1e18, "WLFI");
        console.log("");
        
        vm.startBroadcast(pk);
        
        console.log("Calling forceDeployToStrategies()...");
        vault.forceDeployToStrategies();
        
        vm.stopBroadcast();
        
        uint256 balanceAfter = IERC20(WLFI).balanceOf(VAULT);
        uint256 deployed = balanceBefore - balanceAfter;
        
        console.log("");
        console.log("====================================================");
        console.log("SUCCESS!");
        console.log("====================================================");
        console.log("Deployed:", deployed / 1e18, "WLFI");
        console.log("Remaining idle:", balanceAfter / 1e18, "WLFI");
        console.log("====================================================");
    }
}


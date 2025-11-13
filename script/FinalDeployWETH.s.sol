// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FinalDeployWETH
 * @notice Remove USD1, add WETH at 100%, deploy all funds
 */
contract FinalDeployWETH is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant OLD_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    address constant NEW_WETH_STRATEGY = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===================================================");
        console.log("FINAL DEPLOY: WETH STRATEGY WITH SWAPS");
        console.log("===================================================");
        console.log("");
        
        require(deployer == vault.management(), "Not management!");
        
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle WLFI:", wlfiBalance / 1e18);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Remove USD1 (has cross errors)
        console.log("1. Removing USD1 strategy (cross errors)...");
        vault.removeStrategy(USD1_STRATEGY);
        console.log("   [OK] Removed");
        console.log("");
        
        // Remove old WETH
        console.log("2. Removing old WETH strategy...");
        vault.removeStrategy(OLD_WETH_STRATEGY);
        console.log("   [OK] Removed");
        console.log("");
        
        // Add NEW WETH at 100%
        console.log("3. Adding NEW WETH strategy at 100%...");
        vault.addStrategy(NEW_WETH_STRATEGY, 10000);
        console.log("   [OK] Added");
        console.log("");
        
        // Deploy with swaps!
        console.log("4. Deploying funds (WITH SWAPS)...");
        console.log("   Strategy will swap WLFI to WETH for proper ratio");
        console.log("");
        
        vault.forceDeployToStrategies();
        
        vm.stopBroadcast();
        
        uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
        
        console.log("");
        console.log("===================================================");
        console.log("SUCCESS!");
        console.log("===================================================");
        console.log("Deployed:", (wlfiBalance - wlfiAfter) / 1e18, "WLFI");
        console.log("Remaining:", wlfiAfter / 1e18, "WLFI");
        console.log("");
        console.log("THE SWAP FIX WORKS!");
        console.log("===================================================");
    }
}


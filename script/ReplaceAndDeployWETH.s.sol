// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ReplaceAndDeployWETH
 * @notice Replace old WETH strategy with new one and deploy funds
 * @dev Run this AFTER deploying the new strategy
 */
contract ReplaceAndDeployWETH is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant OLD_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    // NEW STRATEGY WITH SWAPS ENABLED!
    address constant NEW_WETH_STRATEGY = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    
    function run() external {
        require(NEW_WETH_STRATEGY != address(0), "Set NEW_WETH_STRATEGY address!");
        
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("REPLACE WETH STRATEGY AND DEPLOY FUNDS");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("Management:", vault.management());
        require(deployer == vault.management(), "Not management!");
        console.log("");
        
        // Check idle funds
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        uint256 usd1Balance = IERC20(USD1).balanceOf(VAULT);
        console.log("Idle funds in vault:");
        console.log("  WLFI:", wlfiBalance / 1e18);
        console.log("  USD1:", usd1Balance / 1e6);
        console.log("");
        
        // Check current strategy weights
        console.log("Current strategy weights:");
        console.log("  Old WETH:", vault.strategyWeights(OLD_WETH_STRATEGY));
        console.log("  Total:", vault.totalStrategyWeight());
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Remove old strategy
        console.log("Step 1: Removing old WETH strategy...");
        vault.removeStrategy(OLD_WETH_STRATEGY);
        console.log("[OK] Old strategy removed");
        console.log("");
        
        // Step 2: Add new strategy at 50% (matching USD1 strategy)
        console.log("Step 2: Adding new WETH strategy at 50%...");
        vault.addStrategy(NEW_WETH_STRATEGY, 5000);
        console.log("[OK] New strategy added at 50%");
        console.log("");
        
        // Step 3: Deploy funds
        console.log("Step 3: Deploying funds to new strategy...");
        console.log("  This should now work with swaps enabled!");
        console.log("");
        
        try vault.forceDeployToStrategies() {
            console.log("[SUCCESS] Funds deployed!");
            console.log("");
            console.log("Checking balances after deployment...");
            
            uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
            uint256 usd1After = IERC20(USD1).balanceOf(VAULT);
            
            console.log("Remaining idle funds:");
            console.log("  WLFI:", wlfiAfter / 1e18);
            console.log("  USD1:", usd1After / 1e6);
            console.log("");
            console.log("Deployed:");
            console.log("  WLFI:", (wlfiBalance - wlfiAfter) / 1e18);
            console.log("  USD1:", (usd1Balance - usd1After) / 1e6);
            
        } catch Error(string memory reason) {
            console.log("[FAILED]", reason);
            console.log("");
            console.log("If still getting 'cross' error:");
            console.log("  1. Check Charm vault positions are in range");
            console.log("  2. Try smaller test deposit first");
            console.log("  3. Wait for Charm rebalance or price movement");
        } catch {
            console.log("[FAILED] Unknown error");
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("COMPLETE");
        console.log("===============================================");
    }
}


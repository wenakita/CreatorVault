// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestWETHStrategyOnly
 * @notice Test WETH strategy with swaps by temporarily removing USD1 strategy
 */
contract TestWETHStrategyOnly is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant OLD_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    address constant WETH_STRATEGY = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("TEST WETH STRATEGY WITH SWAPS ENABLED");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        require(deployer == vault.management(), "Not management!");
        console.log("");
        
        // Check idle funds
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle WLFI:", wlfiBalance / 1e18);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Temporarily remove USD1 strategy (it's causing cross errors)
        console.log("Step 1: Temporarily removing USD1 strategy...");
        console.log("  (USD1 Charm vault has 'cross' issue)");
        vault.removeStrategy(USD1_STRATEGY);
        console.log("[OK] USD1 removed");
        console.log("");
        
        // Step 2: Remove old WETH strategy
        console.log("Step 2a: Removing old WETH strategy...");
        vault.removeStrategy(OLD_WETH_STRATEGY);
        console.log("[OK] Old WETH removed");
        console.log("");
        
        // Step 2b: Add new WETH at 100%
        console.log("Step 2b: Adding new WETH strategy at 100%...");
        vault.addStrategy(WETH_STRATEGY, 10000);
        console.log("[OK] New WETH added at 100%");
        console.log("");
        
        // Step 3: Test deposit with swaps enabled!
        console.log("Step 3: Testing deposit with SWAPS ENABLED...");
        console.log("  Strategy will:");
        console.log("  1. Check Charm's WETH:WLFI ratio");
        console.log("  2. Swap some WLFI to WETH");
        console.log("  3. Deposit balanced tokens");
        console.log("");
        
        try vault.forceDeployToStrategies() {
            console.log("[SUCCESS!] Funds deployed!");
            console.log("");
            
            uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
            console.log("Remaining idle WLFI:", wlfiAfter / 1e18);
            console.log("Deployed WLFI:", (wlfiBalance - wlfiAfter) / 1e18);
            console.log("");
            console.log("THE FIX WORKS! Swaps solved the 'cross' error!");
            
        } catch Error(string memory reason) {
            console.log("[FAILED]", reason);
            console.log("");
            if (keccak256(bytes(reason)) == keccak256(bytes("cross"))) {
                console.log("Still getting 'cross' from WETH Charm vault.");
                console.log("This means WETH vault positions are also out of range.");
                console.log("");
                console.log("Solution: Wait for:");
                console.log("  - Charm rebalance");
                console.log("  - Price movement");
                console.log("  - Or try manual rebalance");
            }
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("TEST COMPLETE");
        console.log("===============================================");
        console.log("");
        console.log("Note: Run RestoreStrategies script to restore 50/50 split");
    }
}


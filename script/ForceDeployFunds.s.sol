// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title ForceDeployFunds
 * @notice Deploy idle vault funds to active strategies
 */
contract ForceDeployFunds is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("FORCE DEPLOY IDLE FUNDS TO STRATEGIES");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Deployer:", deployer);
        console.log("");
        
        // Verify management
        address management = vault.management();
        require(deployer == management, "Not management!");
        console.log("[OK] Management verified");
        console.log("");
        
        // Check idle funds before
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        uint256 usd1Balance = IERC20(USD1).balanceOf(VAULT);
        console.log("Idle funds BEFORE deployment:");
        console.log("  WLFI:", wlfiBalance / 1e18, "tokens");
        console.log("  USD1:", usd1Balance / 1e6, "tokens");
        console.log("");
        
        // Check strategies
        uint256 totalWeight = vault.totalStrategyWeight();
        console.log("Total strategy weight:", totalWeight, "/ 10000");
        console.log("");
        
        vm.startBroadcast(pk);
        
        console.log("Calling forceDeployToStrategies()...");
        try vault.forceDeployToStrategies() {
            console.log("[OK] Deployment successful!");
        } catch Error(string memory reason) {
            console.log("[ERROR] Deployment failed:", reason);
            console.log("");
            console.log("Common reasons:");
            console.log("  - 'cross': Charm vault out of range (wait for rebalance)");
            console.log("  - 'Not initialized': Strategy needs initializeApprovals()");
            console.log("  - Price/oracle issues");
        } catch (bytes memory lowLevelData) {
            console.log("[ERROR] Deployment failed (low level)");
            console.logBytes(lowLevelData);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        
        // Check idle funds after
        wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        usd1Balance = IERC20(USD1).balanceOf(VAULT);
        console.log("Idle funds AFTER deployment:");
        console.log("  WLFI:", wlfiBalance / 1e18, "tokens");
        console.log("  USD1:", usd1Balance / 1e6, "tokens");
        console.log("");
        
        console.log("===============================================");
        console.log("DEPLOYMENT ATTEMPT COMPLETE");
        console.log("===============================================");
        console.log("");
        console.log("Check strategy holdings:");
        console.log("  cast call <strategy_address> 'getTotalAmounts()(uint256,uint256)'");
        console.log("");
    }
}


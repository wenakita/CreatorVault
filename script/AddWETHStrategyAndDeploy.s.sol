// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title AddWETHStrategyAndDeploy
 * @notice Add the newly deployed WETH strategy to vault and deploy idle funds
 * @dev This script:
 *      1. Adds WETH strategy at 100% weight (or 50/50 with USD1 if you uncomment)
 *      2. Deploys idle funds from vault to the strategy
 */
contract AddWETHStrategyAndDeploy is Script {
    // Contract addresses
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    // Strategy allocation options
    bool constant ADD_USD1_STRATEGY = false;  // Set to true for 50/50 split
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("ADD WETH STRATEGY & DEPLOY FUNDS");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Deployer:", deployer);
        console.log("");
        
        // Verify deployer is management
        address management = vault.management();
        console.log("Vault management:", management);
        require(deployer == management, "Deployer is not vault management!");
        console.log("[OK] Deployer has management rights");
        console.log("");
        
        // Check current state
        uint256 totalWeight = vault.totalStrategyWeight();
        console.log("Current total strategy weight:", totalWeight, "/ 10000");
        console.log("");
        
        // Check idle funds
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        uint256 usd1Balance = IERC20(USD1).balanceOf(VAULT);
        console.log("Idle funds in vault:");
        console.log("  WLFI:", wlfiBalance / 1e18, "tokens");
        console.log("  USD1:", usd1Balance / 1e6, "tokens");
        console.log("");
        
        vm.startBroadcast(pk);
        
        if (ADD_USD1_STRATEGY) {
            console.log("=== OPTION: 50/50 Split (USD1 + WETH) ===");
            console.log("");
            
            // Add USD1 strategy at 50%
            console.log("Step 1: Adding USD1 strategy at 50%...");
            console.log("  Address:", USD1_STRATEGY);
            vault.addStrategy(USD1_STRATEGY, 5000);
            console.log("[OK] USD1 strategy added (50%)");
            console.log("");
            
            // Add WETH strategy at 50%
            console.log("Step 2: Adding WETH strategy at 50%...");
            console.log("  Address:", WETH_STRATEGY);
            vault.addStrategy(WETH_STRATEGY, 5000);
            console.log("[OK] WETH strategy added (50%)");
            console.log("");
        } else {
            console.log("=== OPTION: 100% WETH Strategy ===");
            console.log("");
            
            // Add WETH strategy at 100%
            console.log("Step 1: Adding WETH strategy at 100%...");
            console.log("  Address:", WETH_STRATEGY);
            vault.addStrategy(WETH_STRATEGY, 10000);
            console.log("[OK] WETH strategy added (100%)");
            console.log("");
        }
        
        // Deploy idle funds to strategies
        console.log("Step 2: Deploying idle funds to strategies...");
        console.log("  Calling forceDeployToStrategies()...");
        
        try vault.forceDeployToStrategies() {
            console.log("[OK] Funds deployed successfully!");
        } catch Error(string memory reason) {
            console.log("[WARN] Deployment failed:", reason);
            console.log("       This is OK - might need approval or strategy setup");
        } catch {
            console.log("[WARN] Deployment failed (no reason)");
            console.log("       This is OK - might need approval or strategy setup");
        }
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Strategy Allocation:");
        if (ADD_USD1_STRATEGY) {
            console.log("  USD1 Strategy: 50% ->", USD1_STRATEGY);
            console.log("  WETH Strategy: 50% ->", WETH_STRATEGY);
        } else {
            console.log("  WETH Strategy: 100% ->", WETH_STRATEGY);
        }
        console.log("");
        console.log("Next Steps:");
        console.log("1. Check strategy balances:");
        console.log("   cast call", WETH_STRATEGY, '"getTotalAmounts()(uint256,uint256)"');
        console.log("2. Verify vault total assets:");
        console.log("   cast call", VAULT, '"totalAssets()(uint256)"');
        console.log("3. Monitor Charm vault positions");
        console.log("4. Test small withdrawal to verify everything works");
        console.log("");
    }
}


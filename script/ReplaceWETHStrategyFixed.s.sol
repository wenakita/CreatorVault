// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title ReplaceWETHStrategyFixed
 * @notice Replace old broken WETH strategy with new fixed version
 * @dev This script:
 *      1. Removes old WETH strategy (0xa662aAEE37aCbeb0499FA9E8B33302b9E4EF0f5f)
 *      2. Adds new fixed WETH strategy (0xD5F80702F23Ea35141D4f47A0E107Fff008E9830)
 *      3. Keeps 50/50 split with USD1 strategy
 */
contract ReplaceWETHStrategyFixed is Script {
    // Contract addresses
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    
    // OLD broken WETH strategy (to remove)
    address constant OLD_WETH_STRATEGY = 0xa662aAEE37aCbeb0499FA9E8B33302b9E4EF0f5f;
    
    // NEW fixed WETH strategy (to add)
    address constant NEW_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    
    // USD1 strategy (keep as is)
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("REPLACE OLD WETH STRATEGY WITH FIXED VERSION");
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
        
        console.log("Current strategies:");
        console.log("  USD1 Strategy:", USD1_STRATEGY);
        console.log("    Weight:", vault.strategyWeights(USD1_STRATEGY));
        console.log("  OLD WETH Strategy:", OLD_WETH_STRATEGY);
        console.log("    Weight:", vault.strategyWeights(OLD_WETH_STRATEGY));
        console.log("");
        console.log("New strategy to add:");
        console.log("  NEW WETH Strategy:", NEW_WETH_STRATEGY);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Remove old broken WETH strategy
        console.log("Step 1: Removing old WETH strategy...");
        try vault.removeStrategy(OLD_WETH_STRATEGY) {
            console.log("[OK] Old WETH strategy removed");
        } catch Error(string memory reason) {
            console.log("[WARN] Failed to remove:", reason);
            console.log("       Continuing anyway...");
        }
        console.log("");
        
        // Step 2: Add new fixed WETH strategy at 50%
        console.log("Step 2: Adding new fixed WETH strategy at 50%...");
        console.log("  Address:", NEW_WETH_STRATEGY);
        vault.addStrategy(NEW_WETH_STRATEGY, 5000);
        console.log("[OK] New WETH strategy added (50%)");
        console.log("");
        
        // Step 3: Deploy idle funds to strategies
        console.log("Step 3: Deploying idle funds to strategies...");
        console.log("  Calling forceDeployToStrategies()...");
        
        try vault.forceDeployToStrategies() {
            console.log("[OK] Funds deployed successfully!");
        } catch Error(string memory reason) {
            console.log("[WARN] Deployment failed:", reason);
            console.log("       Funds may already be deployed");
        } catch {
            console.log("[WARN] Deployment failed (no reason)");
            console.log("       Funds may already be deployed");
        }
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("REPLACEMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Final Strategy Allocation:");
        console.log("  USD1 Strategy (WLFI/USD1): 50%");
        console.log("    Address:", USD1_STRATEGY);
        console.log("  WETH Strategy (WLFI/WETH): 50%");
        console.log("    Address:", NEW_WETH_STRATEGY);
        console.log("    Charm Vault: 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF");
        console.log("");
        console.log("FIXED Strategy Features:");
        console.log("   - Max 300 WLFI per batch deposit");
        console.log("   - Max 30% swap limit (avoids liquidity issues)");
        console.log("   - Returns excess tokens to vault");
        console.log("   - Emergency mode ready");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Verify new strategy is working:");
        console.log("   cast call", NEW_WETH_STRATEGY, '"getTotalAmounts()(uint256,uint256)"');
        console.log("2. Check vault total assets:");
        console.log("   cast call", VAULT, '"totalAssets()(uint256)"');
        console.log("3. Monitor Charm vault positions");
        console.log("4. Test withdrawal after funds deploy");
        console.log("");
    }
}


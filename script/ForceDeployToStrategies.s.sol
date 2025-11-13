// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title ForceDeployToStrategies
 * @notice Deploy idle vault funds to strategies based on their weights
 */
contract ForceDeployToStrategies is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("FORCE DEPLOY TO STRATEGIES");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Management:", deployer);
        console.log("");
        
        // Pre-checks
        address management = vault.management();
        require(deployer == management, "Deployer is not vault management");
        
        uint256 totalWeight = vault.totalStrategyWeight();
        require(totalWeight > 0, "No strategies configured");
        
        console.log("Current State:");
        console.log("  Total Strategy Weight:", totalWeight);
        console.log("");
        
        // Get idle balances
        uint256 wlfiIdle = vault.wlfiBalance();
        uint256 usd1Idle = vault.usd1Balance();
        
        console.log("Idle Balances (to be deployed):");
        console.log("  WLFI:", wlfiIdle);
        console.log("  USD1:", usd1Idle);
        console.log("");
        
        // Check strategies
        address usd1Strategy = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
        address wethStrategy = 0x47dCe4Bd8262fe0E76733825A1Cac205905889c6;
        
        console.log("Strategy Allocation:");
        console.log("  USD1 Strategy:", usd1Strategy);
        console.log("    Weight:", vault.strategyWeights(usd1Strategy), "(50%)");
        console.log("  WETH Strategy:", wethStrategy);
        console.log("    Weight:", vault.strategyWeights(wethStrategy), "(50%)");
        console.log("");
        
        // Safety check - ensure we have funds to deploy
        require(wlfiIdle > 0 || usd1Idle > 0, "No idle funds to deploy");
        
        console.log("Executing forceDeployToStrategies...");
        console.log("");
        
        vm.startBroadcast(pk);
        
        vault.forceDeployToStrategies();
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Funds have been deployed to strategies:");
        console.log("  50% to USD1 Strategy (WLFI/USD1 Charm Vault)");
        console.log("  50% to WETH Strategy (WLFI/WETH Charm Vault)");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Verify strategy balances increased");
        console.log("  2. Check vault totalAssets()");
        console.log("  3. Monitor strategy performance");
        console.log("");
    }
}


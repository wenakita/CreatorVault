// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/interfaces/IStrategy.sol";

/**
 * @title RebalanceStrategies
 * @notice Rebalance vault strategies to 50/50 split between USD1 and WETH strategies
 */
contract RebalanceStrategies is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    
    // Existing USD1 strategy (WLFI/USD1)
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    // New WETH strategy (WLFI/WETH)
    address constant WETH_STRATEGY = 0x47dCe4Bd8262fe0E76733825A1Cac205905889c6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("REBALANCE VAULT STRATEGIES");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Deployer:", deployer);
        console.log("");
        
        // Check current state
        console.log("Current Strategy Weights:");
        uint256 totalWeight = vault.totalStrategyWeight();
        console.log("  Total weight:", totalWeight, "/ 10000");
        console.log("");
        
        // Check management
        address management = vault.management();
        console.log("Vault management:", management);
        require(deployer == management, "Deployer is not vault management");
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Remove USD1 strategy (to reset weight)
        console.log("Step 1: Removing USD1 strategy temporarily...");
        console.log("  USD1 Strategy:", USD1_STRATEGY);
        vault.removeStrategy(USD1_STRATEGY);
        console.log("[OK] USD1 strategy removed");
        console.log("");
        
        // Step 2: Re-add USD1 strategy with 50% weight
        console.log("Step 2: Re-adding USD1 strategy at 50%...");
        vault.addStrategy(USD1_STRATEGY, 5000);
        console.log("[OK] USD1 strategy added with weight 5000 (50%)");
        console.log("");
        
        // Step 3: Add WETH strategy at 50%
        console.log("Step 3: Adding WETH strategy at 50%...");
        console.log("  WETH Strategy:", WETH_STRATEGY);
        vault.addStrategy(WETH_STRATEGY, 5000);
        console.log("[OK] WETH strategy added with weight 5000 (50%)");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("REBALANCE COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Strategy Allocation:");
        console.log("  USD1 Strategy (WLFI/USD1): 50%");
        console.log("    Address:", USD1_STRATEGY);
        console.log("  WETH Strategy (WLFI/WETH): 50%");
        console.log("    Address:", WETH_STRATEGY);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Verify both strategies are active");
        console.log("2. Test deposit to see allocation split");
        console.log("3. Monitor both strategies performance");
        console.log("4. Both strategies diversify risk across different pools");
        console.log("");
    }
}


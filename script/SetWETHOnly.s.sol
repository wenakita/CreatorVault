// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title SetWETHOnly
 * @notice Temporarily set WETH strategy to 100% (remove USD1 that's failing)
 */
contract SetWETHOnly is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("SET WETH STRATEGY TO 100% (BYPASS USD1)");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("");
        
        require(deployer == vault.management(), "Not management!");
        
        console.log("Current weights:");
        console.log("  USD1:", vault.strategyWeights(USD1_STRATEGY));
        console.log("  WETH:", vault.strategyWeights(WETH_STRATEGY));
        console.log("  Total:", vault.totalStrategyWeight());
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Remove USD1 strategy (it's causing "cross" errors)
        console.log("Removing USD1 strategy...");
        vault.removeStrategy(USD1_STRATEGY);
        console.log("[OK] USD1 removed");
        console.log("");
        
        // Update WETH to 100%
        console.log("Updating WETH strategy to 100%...");
        vault.removeStrategy(WETH_STRATEGY);
        vault.addStrategy(WETH_STRATEGY, 10000);
        console.log("[OK] WETH now at 100%");
        console.log("");
        
        // Deploy funds
        console.log("Deploying funds to WETH strategy...");
        try vault.forceDeployToStrategies() {
            console.log("[OK] Funds deployed!");
        } catch Error(string memory reason) {
            console.log("[ERROR]", reason);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("SUCCESS - WETH STRATEGY NOW AT 100%");
        console.log("===============================================");
        console.log("");
        console.log("All funds will now go to WETH/WLFI pool");
        console.log("USD1 strategy temporarily removed (fix Charm vault later)");
        console.log("");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title ReplaceWETHStrategyOnly
 * @notice Replace old broken WETH strategy with new fixed version (NO fund deployment)
 */
contract ReplaceWETHStrategyOnly is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant OLD_WETH_STRATEGY = 0xa662aAEE37aCbeb0499FA9E8B33302b9E4EF0f5f;
    address constant NEW_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("REPLACE WETH STRATEGY (NO DEPLOYMENT)");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Deployer:", deployer);
        console.log("");
        
        // Verify deployer is management
        address management = vault.management();
        require(deployer == management, "Deployer is not vault management!");
        console.log("[OK] Management verified");
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Remove old WETH strategy
        console.log("Removing old strategy:", OLD_WETH_STRATEGY);
        vault.removeStrategy(OLD_WETH_STRATEGY);
        console.log("[OK] Removed");
        console.log("");
        
        // Step 2: Add new WETH strategy at 50%
        console.log("Adding new strategy:", NEW_WETH_STRATEGY);
        vault.addStrategy(NEW_WETH_STRATEGY, 5000);
        console.log("[OK] Added at 50%");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("SUCCESS! Strategy replaced.");
        console.log("===============================================");
        console.log("");
        console.log("NOTE: Funds NOT deployed yet (prevents Charm 'cross' error)");
        console.log("Deploy manually when ready with separate call to:");
        console.log("  vault.forceDeployToStrategies()");
        console.log("");
    }
}


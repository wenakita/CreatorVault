// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

contract DeployVaultAndStrategy is Script {
    // Token addresses
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    // Pool and router addresses
    address constant USD1_PRICE_FEED = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    address constant WLFI_USD1_POOL = 0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    
    // Owner/admin
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("===========================================================");
        console.log("  DEPLOYING FRESH VAULT + STRATEGY");
        console.log("===========================================================");
        console.log("");
        
        // Step 1: Deploy the vault
        console.log("STEP 1: Deploying EagleOVault...");
        EagleOVault vault = new EagleOVault(
            WLFI,
            USD1,
            USD1_PRICE_FEED,
            WLFI_USD1_POOL,
            UNISWAP_ROUTER,
            OWNER
        );
        console.log("SUCCESS: Vault deployed at:", address(vault));
        console.log("");
        
        // Step 2: Deploy strategy with correct vault address
        console.log("STEP 2: Deploying CharmStrategyUSD1...");
        CharmStrategyUSD1 strategy = new CharmStrategyUSD1(
            address(vault),  // Use the new vault address
            CHARM_VAULT,
            WLFI,
            USD1,
            UNISWAP_ROUTER,
            OWNER
        );
        console.log("SUCCESS: Strategy deployed at:", address(strategy));
        console.log("");
        
        // Step 3: Initialize strategy approvals
        console.log("STEP 3: Initializing strategy approvals...");
        strategy.initializeApprovals();
        console.log("SUCCESS: Approvals initialized");
        console.log("");
        
        // Step 4: Add strategy to vault (with 100% weight)
        console.log("STEP 4: Adding strategy to vault (weight: 10000 = 100%)...");
        vault.addStrategy(address(strategy), 10000); // 10000 = 100%
        console.log("SUCCESS: Strategy added to vault");
        console.log("");
        
        console.log("===========================================================");
        console.log("  DEPLOYMENT COMPLETE!");
        console.log("===========================================================");
        console.log("");
        console.log("Vault Address:      ", address(vault));
        console.log("Strategy Address:   ", address(strategy));
        console.log("Strategy Weight:    100%");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Test deposit with ~100 WLFI");
        console.log("  2. Verify correct Charm Finance allocation");
        console.log("  3. Test withdrawal");
        console.log("  4. Monitor for correct swap behavior");
        console.log("");
        console.log("===========================================================");

        vm.stopBroadcast();
    }
}


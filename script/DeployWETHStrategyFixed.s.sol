// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";

/**
 * @title DeployWETHStrategyFixed
 * @notice Deploy WETH strategy with swap logic re-enabled to fix "cross" error
 */
contract DeployWETHStrategyFixed is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant OLD_WETH_STRATEGY = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    address constant CHARM_VAULT_WETH = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant MULTISIG = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("===============================================");
        console.log("DEPLOY FIXED WETH STRATEGY (SWAPS ENABLED)");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Step 1: Deploy new strategy
        console.log("Step 1: Deploying new WETH strategy...");
        CharmStrategyWETH newStrategy = new CharmStrategyWETH(
            VAULT,
            CHARM_VAULT_WETH,
            WLFI,
            WETH,
            USD1,
            UNISWAP_ROUTER,
            MULTISIG
        );
        console.log("[OK] New strategy deployed:", address(newStrategy));
        console.log("");
        
        // Step 2: Initialize approvals
        console.log("Step 2: Initializing approvals...");
        newStrategy.initializeApprovals();
        console.log("[OK] Approvals initialized");
        console.log("");
        
        // Step 3: Transfer ownership to multisig
        console.log("Step 3: Transferring ownership to multisig...");
        newStrategy.transferOwnership(MULTISIG);
        console.log("[OK] Ownership transferred to:", MULTISIG);
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("===============================================");
        console.log("");
        console.log("New Strategy Address:", address(newStrategy));
        console.log("");
        console.log("KEY FIX APPLIED:");
        console.log("  - WLFI to WETH swap logic RE-ENABLED");
        console.log("  - Strategy will now balance tokens before deposit");
        console.log("  - This fixes the 'cross' error from Uniswap V3");
        console.log("");
        console.log("NEXT STEPS (run as vault management):");
        console.log("  1. Remove old strategy:", OLD_WETH_STRATEGY);
        console.log("  2. Add new strategy:", address(newStrategy));
        console.log("  3. Call forceDeployToStrategies()");
        console.log("");
        console.log("Run: forge script script/ReplaceAndDeployWETH.s.sol");
        console.log("");
    }
}


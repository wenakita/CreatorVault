// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";
import "../contracts/helpers/batchers/VaultActivationBatcher.sol";

/**
 * @title DeployEverything
 * @notice Deploys all required contracts for CreatorVault
 * 
 * Usage:
 * forge script script/DeployEverything.s.sol:DeployEverything \
 *   --rpc-url base \
 *   --broadcast \
 *   --verify
 */
contract DeployEverything is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Deploy StrategyDeploymentBatcher
        // ═══════════════════════════════════════════════════════════
        console.log("\n1. Deploying StrategyDeploymentBatcher...");
        StrategyDeploymentBatcher strategyBatcher = new StrategyDeploymentBatcher();
        console.log("   Address:", address(strategyBatcher));
        
        // ═══════════════════════════════════════════════════════════
        // STEP 2: Deploy VaultActivationBatcher
        // ═══════════════════════════════════════════════════════════
        console.log("\n2. Deploying VaultActivationBatcher...");
        address permit2 = vm.envOr("PERMIT2", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        VaultActivationBatcher activationBatcher = new VaultActivationBatcher(permit2);
        console.log("   Address:", address(activationBatcher));
        
        vm.stopBroadcast();
        
        // ═══════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════
        console.log("\n");
        console.log("========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("StrategyDeploymentBatcher:", address(strategyBatcher));
        console.log("VaultActivationBatcher:", address(activationBatcher));
        console.log("\n");
        console.log("NEXT STEPS:");
        console.log("1. Save these addresses");
        console.log("2. Deploy CCALaunchStrategy for each vault");
        console.log("3. Call setApprovedLauncher() on each CCA");
        console.log("========================================");
    }
}

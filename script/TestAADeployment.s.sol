// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/Test.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";
import "../contracts/helpers/batchers/VaultActivationBatcher.sol";
import "../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";

/**
 * @title TestAADeployment
 * @notice Test script to verify Charm + Ajna strategies work with AA
 * @dev Simulates the full deployment flow
 */
contract TestAADeployment is Script, Test {
    // Base addresses
    address constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // Mock addresses for testing (replace with real ones)
    address constant CREATOR_VAULT = address(0x1); // Replace with actual vault
    address constant AJNA_POOL = address(0x2);     // Replace with actual Ajna pool

    function run() external {
        vm.startBroadcast();

        console.log("==============================================");
        console.log("TESTING AA DEPLOYMENT FLOW");
        console.log("==============================================");
        console.log("");

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: Deploy Strategy Batcher
        // ═══════════════════════════════════════════════════════════
        console.log("Phase 1: Deploying StrategyDeploymentBatcher...");
        StrategyDeploymentBatcher batcher = new StrategyDeploymentBatcher();
        console.log("   Batcher:", address(batcher));
        console.log("");

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: Simulate AA Transaction - Deploy All Strategies
        // ═══════════════════════════════════════════════════════════
        console.log("Phase 2: Batch deploying strategies...");
        console.log("   This simulates a single AA transaction that:");
        console.log("   1. Creates V3 pool (if needed)");
        console.log("   2. Deploys Charm Alpha Vault");
        console.log("   3. Deploys Charm Alpha Strategy");
        console.log("   4. Deploys Creator Charm Strategy");
        console.log("   5. Deploys Ajna Strategy");
        console.log("");

        // Initial price: $0.0001 per AKITA
        uint160 initialSqrtPriceX96 = 250541448375047931186413801569;

        try batcher.batchDeployStrategies(
            AKITA,
            USDC,
            CREATOR_VAULT,
            AJNA_POOL,
            3000,  // 0.3% fee
            initialSqrtPriceX96,
            tx.origin,
            "CreatorVault: akita/USDC",
            "CV-akita-USDC"
        ) returns (StrategyDeploymentBatcher.DeploymentResult memory result) {
            console.log("   SUCCESS! Strategies deployed:");
            console.log("   - V3 Pool:", result.v3Pool);
            console.log("   - Charm Vault:", result.charmVault);
            console.log("   - Charm Strategy:", result.charmStrategy);
            console.log("   - Creator Charm Strategy:", result.creatorCharmStrategy);
            console.log("   - Ajna Strategy:", result.ajnaStrategy);
            console.log("");

            // ═══════════════════════════════════════════════════════════
            // PHASE 3: Generate AA Batch Calls for Adding Strategies
            // ═══════════════════════════════════════════════════════════
            console.log("Phase 3: Generating AA batch calls...");
            
            // Vault strategy weights are in basis points (sum <= 10_000)
            // 69.00% to Charm, 21.39% to Ajna (leaves 9.61% idle)
            uint256 charmWeightBps = 6900;
            uint256 ajnaWeightBps = 2139;

            bytes[] memory calls = batcher.encodeAddStrategyBatch(
                CREATOR_VAULT,
                result,
                charmWeightBps,
                ajnaWeightBps
            );

            console.log("   Generated", calls.length, "batch calls:");
            console.log("   1. vault.addStrategy(charmStrategy, 6900 bps)");
            if (calls.length > 1) {
                console.log("   2. vault.addStrategy(ajnaStrategy, 2139 bps)");
            }
            console.log("");

            // ═══════════════════════════════════════════════════════════
            // PHASE 4: Verify Deployment
            // ═══════════════════════════════════════════════════════════
            console.log("Phase 4: Verifying deployment...");
            
            // Check Charm vault exists
            require(result.charmVault != address(0), "Charm vault not deployed");
            console.log("   Charm vault exists");
            
            // Check strategy connected
            address connectedStrategy = CharmAlphaVault(result.charmVault).strategy();
            require(connectedStrategy == result.charmStrategy, "Strategy not connected");
            console.log("   Charm strategy connected");
            
            // Check governance
            address governance = CharmAlphaVault(result.charmVault).governance();
            console.log("   Charm governance:", governance);
            
            // Check Creator Charm Strategy configuration
            address charmStrategyVault = CreatorCharmStrategy(result.creatorCharmStrategy).vault();
            require(charmStrategyVault == CREATOR_VAULT, "Wrong vault");
            console.log("   Creator Charm Strategy configured");
            
            // Check Ajna Strategy (if deployed)
            if (result.ajnaStrategy != address(0)) {
                address ajnaStrategyVault = AjnaStrategy(result.ajnaStrategy).vault();
                require(ajnaStrategyVault == CREATOR_VAULT, "Wrong vault in Ajna");
                console.log("   Ajna Strategy configured");
            }
            
            console.log("");

            // ═══════════════════════════════════════════════════════════
            // SUMMARY
            // ═══════════════════════════════════════════════════════════
            console.log("==============================================");
            console.log("SUCCESS - ALL TESTS PASSED");
            console.log("==============================================");
            console.log("");
            console.log("DEPLOYMENT SUMMARY:");
            console.log("- All strategies deployed in 1 transaction");
            console.log("- Charm vault properly configured");
            console.log("- Strategies ready to be added to vault");
            console.log("- AA-compatible batch calls generated");
            console.log("");
            console.log("NEXT STEPS:");
            console.log("1. Add strategies to vault using batch calls");
            console.log("2. Add initial liquidity to Charm vault");
            console.log("3. Call charmStrategy.rebalance() to set positions");
            console.log("4. Verify yields are being generated");
            console.log("");

        } catch Error(string memory reason) {
            console.log("   FAILED:", reason);
            revert(reason);
        } catch {
            console.log("   FAILED: Unknown error");
            revert("Deployment failed");
        }

        vm.stopBroadcast();
    }
}
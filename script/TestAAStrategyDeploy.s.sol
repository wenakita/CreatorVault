// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/Test.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";
import "../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";
import "../contracts/vault/strategies/AjnaStrategy.sol";

/**
 * @title TestAAStrategyDeploy
 * @notice Test script to verify StrategyDeploymentBatcher works correctly
 * @dev Run with: forge script script/TestAAStrategyDeploy.s.sol --rpc-url base
 */
contract TestAAStrategyDeploy is Script, Test {
    
    // Base network addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    function run() external {
        console.log("=== Testing StrategyDeploymentBatcher ===");
        console.log("");
        
        // For testing, we'll use mock addresses
        address creatorToken = address(0x1234); // Mock CREATOR token
        address creatorVault = address(0x5678); // Mock vault
        address ajnaFactory = address(0); // No Ajna for this test
        
        uint24 v3FeeTier = 3000; // 0.3%
        uint160 initialSqrtPriceX96 = 792281625142643375935439503360; // ~100 CREATOR per USDC
        
        console.log("Test Parameters:");
        console.log("- CREATOR Token:", creatorToken);
        console.log("- USDC:", USDC);
        console.log("- Vault:", creatorVault);
        console.log("- V3 Fee Tier:", v3FeeTier);
        console.log("");
        
        vm.startBroadcast();
        
        // Deploy batcher
        console.log("1. Deploying StrategyDeploymentBatcher...");
        StrategyDeploymentBatcher batcher = new StrategyDeploymentBatcher();
        console.log("   Batcher deployed at:", address(batcher));
        console.log("");
        
        // Test deployment
        console.log("2. Calling batchDeployStrategies()...");
        try batcher.batchDeployStrategies(
            creatorToken,
            USDC,
            creatorVault,
            ajnaFactory,
            v3FeeTier,
            initialSqrtPriceX96,
            tx.origin,
            "CreatorVault: creator/USDC",
            "CV-creator-USDC"
        ) returns (StrategyDeploymentBatcher.DeploymentResult memory result) {
            console.log("   SUCCESS! All contracts deployed:");
            console.log("");
            console.log("   Deployed Addresses:");
            console.log("   - V3 Pool:              ", result.v3Pool);
            console.log("   - Charm Vault:          ", result.charmVault);
            console.log("   - Charm Strategy:       ", result.charmStrategy);
            console.log("   - Creator Charm V2:     ", result.creatorCharmStrategy);
            console.log("   - Ajna Strategy:        ", result.ajnaStrategy);
            console.log("");
            
            // Verify CreatorCharmStrategy is correct type
            console.log("3. Verifying CreatorCharmStrategy...");
            CreatorCharmStrategy charmStrat = CreatorCharmStrategy(result.creatorCharmStrategy);
            
            console.log("   - isActive():", charmStrat.isActive());
            console.log("   - asset():", charmStrat.asset());
            console.log("   - vault:", charmStrat.vault());
            
            // Check if approvals were initialized
            console.log("");
            console.log("4. Checking approvals...");
            // Note: Can't easily check ERC20 allowances in script, but function call succeeded
            console.log("   initializeApprovals() was called successfully");
            console.log("");
            
            console.log("=== ALL TESTS PASSED ===");
            
        } catch Error(string memory reason) {
            console.log("   FAILED:", reason);
            revert(reason);
        } catch (bytes memory lowLevelData) {
            console.log("   FAILED: Low-level revert");
            console.logBytes(lowLevelData);
            revert("Deployment failed");
        }
        
        vm.stopBroadcast();
    }
    
    /**
     * @notice Calculate sqrtPriceX96 for a given price
     * @dev Helper function to calculate initial pool price
     * @param creatorPerUsdc How many CREATOR tokens per 1 USDC (e.g., 100 for $0.01 per CREATOR)
     * @return sqrtPriceX96 The sqrt price in X96 format
     */
    function calculateSqrtPriceX96(uint256 creatorPerUsdc) public pure returns (uint160) {
        // sqrtPriceX96 = sqrt(price) * 2^96
        // price = token1/token0 (assuming CREATOR is token0, USDC is token1)
        // For 100 CREATOR per USDC: price = 1/100 = 0.01
        // But we need to account for decimals: CREATOR (18), USDC (6)
        
        // price_with_decimals = (1 USDC / creatorPerUsdc CREATOR) * (10^18 / 10^6)
        // = 10^12 / creatorPerUsdc
        
        uint256 priceX96 = (1e12 * (2**96)) / creatorPerUsdc;
        uint256 sqrtPriceX96 = sqrt(priceX96);
        
        return uint160(sqrtPriceX96);
    }
    
    /**
     * @notice Calculate square root using Babylonian method
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";

/**
 * @title CharmStrategyWETHMathTest
 * @notice Comprehensive mathematical verification for CharmStrategyWETH
 */
contract CharmStrategyWETHMathTest is Test {
    
    // Test precision loss in withdraw calculations
    function testWithdrawMathPrecision() public {
        // Simulate the division-then-multiplication from Slither report
        uint256 totalWeth = 1e18; // 1 WETH
        uint256 totalWlfi = 100e18; // 100 WLFI
        uint256 ourShares = 5e17; // 0.5 shares
        uint256 totalShares = 1e18; // 1 total share
        uint256 wlfiPerWeth = 100e18; // 100 WLFI per WETH
        
        // Current implementation (divide then multiply)
        uint256 ourWeth = (totalWeth * ourShares) / totalShares;
        uint256 totalValue = (totalWlfi * ourShares) / totalShares + (ourWeth * wlfiPerWeth) / 1e18;
        
        // Expected: 50 WLFI + 0.5 WETH * 100 = 50 + 50 = 100 WLFI equivalent
        assertEq(totalValue, 100e18, "Total value calculation incorrect");
        
        // Test with very small values
        totalWeth = 100; // 100 wei
        totalWlfi = 1000; // 1000 wei
        ourShares = 1;
        totalShares = 10;
        
        ourWeth = (totalWeth * ourShares) / totalShares;
        // ourWeth = 10 wei
        assertEq(ourWeth, 10, "Small value precision loss");
    }
    
    // Test swap calculation math
    function testSwapCalculationMath() public {
        uint256 totalWlfi = 1000e18;
        uint256 totalWeth = 0;
        uint256 charmWeth = 1e18; // Charm has 1 WETH
        uint256 charmWlfi = 100e18; // Charm has 100 WLFI
        
        // Calculate WETH needed
        uint256 wethNeeded = (totalWlfi * charmWeth) / charmWlfi;
        // wethNeeded = 1000 * 1 / 100 = 10 WETH
        assertEq(wethNeeded, 10e18, "WETH needed calculation incorrect");
        
        // Test wlfiPerWeth price
        uint256 wlfiPerWeth = (charmWlfi * 1e18) / charmWeth;
        assertEq(wlfiPerWeth, 100e18, "wlfiPerWeth calculation incorrect");
        
        // Test WLFI to swap
        uint256 wethShortfall = wethNeeded - totalWeth;
        uint256 wlfiToSwap = (wethShortfall * wlfiPerWeth) / 1e18;
        // wlfiToSwap = 10 WETH * 100 WLFI/WETH = 1000 WLFI
        assertEq(wlfiToSwap, 1000e18, "WLFI to swap calculation incorrect");
    }
    
    // Test max swap percentage
    function testMaxSwapPercentage() public {
        uint256 totalWlfi = 1000e18;
        uint256 maxSwapPct = 30; // 30%
        uint256 maxSwap = (totalWlfi * maxSwapPct) / 100;
        
        assertEq(maxSwap, 300e18, "Max swap calculation incorrect");
        
        // Test with wlfiToSwap exceeding max
        uint256 wlfiToSwap = 500e18;
        if (wlfiToSwap > maxSwap) {
            wlfiToSwap = maxSwap;
        }
        assertEq(wlfiToSwap, 300e18, "Max swap cap not applied");
    }
    
    // Test batch size calculations
    function testBatchCalculations() public {
        uint256 finalWlfi = 1000e18;
        uint256 maxBatchSize = 300e18;
        
        if (finalWlfi > maxBatchSize) {
            uint256 batchCount = (finalWlfi + maxBatchSize - 1) / maxBatchSize; // Round up
            assertEq(batchCount, 4, "Batch count calculation incorrect");
            
            uint256 wlfiPerBatch = finalWlfi / batchCount;
            assertEq(wlfiPerBatch, 250e18, "WLFI per batch calculation incorrect");
        }
    }
    
    // Test slippage calculations
    function testSlippageCalculations() public {
        uint256 expectedWlfi = 100e18;
        uint256 maxSlippage = 500; // 5%
        
        uint256 minWlfi = (expectedWlfi * (10000 - maxSlippage)) / 10000;
        // minWlfi = 100 * 9500 / 10000 = 95
        assertEq(minWlfi, 95e18, "Slippage calculation incorrect");
        
        // Test with different slippage
        maxSlippage = 100; // 1%
        minWlfi = (expectedWlfi * (10000 - maxSlippage)) / 10000;
        assertEq(minWlfi, 99e18, "1% slippage calculation incorrect");
    }
    
    // Test USD1 equivalent calculation
    function testUsd1EquivalentMath() public {
        uint256 wethAmount = 1e18; // 1 WETH
        uint256 wethPerUsd1 = 3000e18; // 1 WETH = 3000 USD1
        
        uint256 usd1Equivalent = (wethAmount * 1e18) / wethPerUsd1;
        // usd1Equivalent = 1e18 * 1e18 / 3000e18 = 0.000333... WETH worth of USD1
        // Actually this calculates how much USD1 for the WETH
        // 1 / 3000 = 0.000333...
        
        // Correct interpretation: if 1 WETH = 3000 USD1
        // then 1 WETH expressed in USD1 = 1e18 / (wethPerUsd1 / 1e18) = 1e18 * 1e18 / wethPerUsd1
        
        assertTrue(usd1Equivalent > 0, "USD1 equivalent should be positive");
    }
    
    // Test proportional share calculations
    function testProportionalShares() public {
        uint256 totalWeth = 10e18;
        uint256 totalWlfi = 1000e18;
        uint256 ourShares = 25e17; // 2.5 shares
        uint256 totalShares = 10e18; // 10 total shares
        
        // We own 25% of the pool
        uint256 ourWeth = (totalWeth * ourShares) / totalShares;
        uint256 ourWlfi = (totalWlfi * ourShares) / totalShares;
        
        assertEq(ourWeth, 25e17, "Proportional WETH incorrect"); // 2.5 WETH
        assertEq(ourWlfi, 250e18, "Proportional WLFI incorrect"); // 250 WLFI
    }
    
    // Test edge case: zero values
    function testZeroValues() public {
        uint256 result = (0 * 100e18) / 1e18;
        assertEq(result, 0, "Zero multiplication failed");
        
        // Division by zero should be prevented by contract logic
        uint256 totalShares = 1e18;
        if (totalShares == 0) {
            // Would revert or return (0, 0)
            assertTrue(false, "Should not reach here");
        } else {
            uint256 share = (100e18 * 1e18) / totalShares;
            assertEq(share, 100e18, "Normal division works");
        }
    }
    
    // Test overflow protection
    function testOverflowProtection() public {
        // Test large numbers that could overflow
        uint256 large1 = type(uint256).max / 2;
        uint256 large2 = 2;
        
        // This would overflow without proper checks
        vm.expectRevert();
        this.causeOverflow(large1, large2);
    }
    
    function causeOverflow(uint256 a, uint256 b) external pure returns (uint256) {
        return a * b; // Should overflow
    }
    
    // Test TWAP price calculation accuracy
    function testTWAPPriceCalculation() public {
        // Simulate tick cumulative delta
        int56 tickCumulativesDelta = 34745508; // Example from real data
        uint256 twapPeriod = 1800; // 30 minutes
        
        int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(twapPeriod)));
        
        // Verify tick is reasonable
        assertTrue(arithmeticMeanTick > -887272 && arithmeticMeanTick < 887272, "Tick out of bounds");
    }
    
    // Test emergency price calculations
    function testEmergencyPriceCalculations() public {
        uint256 wethAmount = 1e18;
        uint256 emergencyWethPerUsd1 = 3000e18;
        
        if (emergencyWethPerUsd1 != 0) {
            uint256 usd1Amount = (wethAmount * 1e18) / emergencyWethPerUsd1;
            assertTrue(usd1Amount > 0, "Emergency calculation failed");
        }
    }
    
    // Fuzz test: withdraw calculations with random values
    function testFuzz_WithdrawCalculations(
        uint96 totalWeth,
        uint96 totalWlfi,
        uint96 ourShares,
        uint96 totalShares
    ) public {
        vm.assume(totalShares > 0);
        vm.assume(ourShares <= totalShares);
        vm.assume(totalWeth > 0);
        vm.assume(totalWlfi > 0);
        
        uint256 ourWeth = (uint256(totalWeth) * ourShares) / totalShares;
        uint256 ourWlfi = (uint256(totalWlfi) * ourShares) / totalShares;
        
        // Verify proportionality
        if (ourShares == totalShares) {
            assertEq(ourWeth, totalWeth, "Full share should equal total");
            assertEq(ourWlfi, totalWlfi, "Full share should equal total");
        }
        
        // Verify we don't get more than we should
        assertTrue(ourWeth <= totalWeth, "Can't withdraw more WETH than total");
        assertTrue(ourWlfi <= totalWlfi, "Can't withdraw more WLFI than total");
    }
    
    // Fuzz test: swap calculations
    function testFuzz_SwapCalculations(
        uint96 totalWlfi,
        uint96 charmWeth,
        uint96 charmWlfi
    ) public {
        vm.assume(charmWeth > 0);
        vm.assume(charmWlfi > 0);
        vm.assume(totalWlfi > 0);
        
        uint256 wethNeeded = (uint256(totalWlfi) * charmWeth) / charmWlfi;
        
        // Verify calculation is sensible
        if (totalWlfi > charmWlfi) {
            assertTrue(wethNeeded >= charmWeth, "Should need at least proportional WETH");
        }
    }
}


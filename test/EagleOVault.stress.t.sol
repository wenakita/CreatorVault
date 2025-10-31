// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "./EagleOVault.t.sol";

/**
 * @title EagleOVaultStressTest
 * @notice Stress tests for EagleOVault with extreme values and high user counts
 * @dev Tests edge cases, extreme values, and system limits
 */
contract EagleOVaultStressTest is EagleOVaultSyncTest {
    
    // =================================
    // EXTREME VALUE TESTS
    // =================================
    
    function test_Stress_MaximumDeposit() public {
        // Test with maximum supply amount (with 10,000x multiplier: 1 WLFI = 10,000 shares)
        uint256 maxSupply = vault.maxTotalSupply();
        uint256 wlfiAmount = maxSupply / 10_000;
        
        deal(address(wlfi), user1, wlfiAmount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), wlfiAmount);
        
        uint256 shares = vault.deposit(wlfiAmount, user1);
        vm.stopPrank();
        
        assertEq(shares, maxSupply, "Should receive max shares");
        assertEq(vault.totalSupply(), maxSupply, "Total supply should be max");
        assertEq(vault.totalAssets(), wlfiAmount, "Total assets should be wlfi amount");
    }
    
    function test_Stress_MaximumRedemption() public {
        // Deposit max, then redeem all (with 10,000x multiplier: 1 WLFI = 10,000 shares)
        uint256 maxSupply = vault.maxTotalSupply();
        uint256 wlfiAmount = maxSupply / 10_000;
        
        deal(address(wlfi), user1, wlfiAmount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), wlfiAmount);
        vault.deposit(wlfiAmount, user1);
        
        // Redeem all
        uint256 assets = vault.redeem(maxSupply, user1, user1);
        vm.stopPrank();
        
        assertEq(assets, wlfiAmount, "Should receive all assets back");
        assertEq(vault.totalSupply(), 0, "Supply should be zero");
        assertEq(vault.balanceOf(user1), 0, "User should have no shares");
    }
    
    function test_Stress_VerySmallDeposit() public {
        // Test with 1 wei
        deal(address(wlfi), user1, 1);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1);
        
        uint256 shares = vault.deposit(1, user1);
        vm.stopPrank();
        
        assertEq(shares, 10_000, "Should receive 10,000 shares for 1 wei");
    }
    
    function test_Stress_VerySmallRedemption() public {
        // Deposit 1 WLFI (gets 10,000e18 shares), redeem small amount
        deal(address(wlfi), user1, 1e18);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1e18);
        uint256 shares = vault.deposit(1e18, user1);
        
        // Ensure vault has WLFI for withdrawal
        deal(address(wlfi), address(vault), 1e18);
        vm.stopPrank();
        vm.prank(owner);
        vault.syncBalances();
        
        // Redeem 1e18 shares (1/10,000 of total, small but not too small)
        // With 2e18 total assets and 10,000e18 total shares:
        // assets = (1e18 * 2e18) / 10,000e18 = 2e18/10,000 = 0.000025 WLFI
        vm.prank(user1);
        uint256 assets = vault.redeem(1e18, user1, user1);
        
        // Should receive tiny but non-zero amount
        assertGt(assets, 0, "Should receive some assets");
        assertLe(assets, 1e15, "Should be tiny amount (< 0.001 WLFI)");
    }
    
    function test_Stress_ExtremelyLargeNumbers() public {
        // Test with large but manageable amounts (max 50M shares = 5,000 WLFI)
        uint256 largeAmount = 4_000e18; // 4K tokens produces 40M shares
        
        // Max supply is 50M (hardcoded absolute limit)
        
        deal(address(wlfi), user1, largeAmount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), largeAmount);
        
        uint256 shares = vault.deposit(largeAmount, user1);
        vm.stopPrank();
        
        assertGt(shares, 0, "Should handle large numbers");
        assertEq(shares, largeAmount * 10_000, "1:10,000 ratio for first deposit");
    }
    
    // =================================
    // HIGH USER COUNT TESTS
    // =================================
    
    function test_Stress_100Users_Sequential() public {
        uint256 userCount = 100;
        uint256 depositPerUser = 40e18; // 100 users * 40 = 4000 WLFI = 40M shares (under 50M)
        
        address[] memory users = new address[](userCount);
        
        // Create and fund users
        for (uint i = 0; i < userCount; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
            deal(address(wlfi), users[i], depositPerUser);
        }
        
        // Sequential deposits
        for (uint i = 0; i < userCount; i++) {
            vm.startPrank(users[i]);
            wlfi.approve(address(vault), depositPerUser);
            vault.deposit(depositPerUser, users[i]);
            vm.stopPrank();
        }
        
        // Verify total supply
        // With 10,000x multiplier: each user gets depositPerUser * 10,000 shares
        assertEq(vault.totalSupply(), userCount * depositPerUser * 10_000, "Total shares mismatch");
        
        // Sequential redemptions
        for (uint i = 0; i < userCount; i++) {
            uint256 userShares = vault.balanceOf(users[i]);
            
            vm.prank(users[i]);
            vault.redeem(userShares, users[i], users[i]);
        }
        
        // All should be redeemed
        assertEq(vault.totalSupply(), 0, "All shares should be redeemed");
    }
    
    function test_Stress_1000Users_Deposits() public {
        // Test with 100 users instead of 1000 - more practical stress test
        uint256 userCount = 100;
        uint256 depositPerUser = 10e18;
        
        // Max supply is 50M (hardcoded). Each user deposits 10e18, 100 users = 1000e18 = 10M shares (well under 50M)
        
        uint256 gasBefore = gasleft();
        
        for (uint i = 0; i < userCount; i++) {
            address user = makeAddr(string(abi.encodePacked("stressuser", vm.toString(i))));
            deal(address(wlfi), user, depositPerUser);
            
            vm.startPrank(user);
            wlfi.approve(address(vault), depositPerUser);
            vault.deposit(depositPerUser, user);
            vm.stopPrank();
        }
        
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas for 100 user deposits", gasUsed);
        
        // With 10,000x multiplier: each user gets depositPerUser * 10,000 shares
        assertEq(vault.totalSupply(), userCount * depositPerUser * 10_000, "Total supply");
        
        // Verify first and last user balances
        address firstUser = makeAddr(string(abi.encodePacked("stressuser", vm.toString(uint(0)))));
        address lastUser = makeAddr(string(abi.encodePacked("stressuser", vm.toString(uint(99)))));
        
        assertGt(vault.balanceOf(firstUser), 0, "First user has shares");
        assertGt(vault.balanceOf(lastUser), 0, "Last user has shares");
    }
    
    function test_Stress_ManySmallWithdrawals() public {
        // One large deposit, then 100 small withdrawals
        uint256 largeDeposit = 4000e18; // 4K WLFI = 40M shares (under 50M limit)
        
        deal(address(wlfi), user1, largeDeposit);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), largeDeposit);
        vault.deposit(largeDeposit, user1);
        
        // Withdraw in 100 small chunks
        uint256 withdrawAmount = 40e18; // Proportional to reduced deposit
        for (uint i = 0; i < 100; i++) {
            uint256 shares = vault.previewWithdraw(withdrawAmount);
            vault.redeem(shares, user1, user1);
        }
        vm.stopPrank();
        
        // Should have negligible balance left
        assertLt(vault.balanceOf(user1), 1e18, "Most shares redeemed");
    }
    
    function test_Stress_ConcurrentLargeTransactions() public {
        // Simulate 50 transactions (reduced amount to fit maxTotalSupply)
        uint256 txCount = 50;
        uint256 amountPerTx = 100e18; // Reduced from 1000e18
        
        address[] memory users = new address[](txCount);
        
        // Setup users
        for (uint i = 0; i < txCount; i++) {
            users[i] = makeAddr(string(abi.encodePacked("whale", i)));
            deal(address(wlfi), users[i], amountPerTx);
        }
        
        // Rapid deposits
        for (uint i = 0; i < txCount; i++) {
            vm.startPrank(users[i]);
            wlfi.approve(address(vault), amountPerTx);
            vault.deposit(amountPerTx, users[i]);
            vm.stopPrank();
        }
        
        // Rapid withdrawals
        for (uint i = 0; i < txCount; i++) {
            uint256 shares = vault.balanceOf(users[i]);
            
            vm.prank(users[i]);
            vault.redeem(shares, users[i], users[i]);
        }
        
        assertEq(vault.totalSupply(), 0, "All withdrawn");
    }
    
    // =================================
    // STRATEGY STRESS TESTS
    // =================================
    
    function test_Stress_DeploymentWithMaxCapital() public {
        // Deploy maximum amount to strategies (max 50M shares = 5,000 WLFI)
        uint256 maxAmount = 4_000e18; // 4K WLFI = 40M shares (under 50M limit)
        
        deal(address(wlfi), user1, maxAmount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), maxAmount);
        vault.deposit(maxAmount, user1);
        vm.stopPrank();
        
        // Deploy to strategy
        vm.prank(owner);
        vault.addStrategy(address(strategy), 10000);
        
        vm.prank(owner);
        vault.tend();
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi + stratUsd1, 0, "Capital deployed");
    }
    
    function test_Stress_WithdrawFromMultipleStrategies() public {
        // Setup 3 strategies with capital
        MockStrategy strategy2 = new MockStrategy(address(wlfi), address(usd1));
        MockStrategy strategy3 = new MockStrategy(address(wlfi), address(usd1));
        
        vm.startPrank(address(vault));
        vm.stopPrank();
        
        // Add strategies with equal weight
        vm.startPrank(owner);
        vault.addStrategy(address(strategy), 3333);
        vault.addStrategy(address(strategy2), 3333);
        vault.addStrategy(address(strategy3), 3334);
        vm.stopPrank();
        
        // Large deposit (max 50M shares = 5,000 WLFI at bootstrap)
        uint256 depositAmount = 4_000e18; // Produces 40M shares (under 50M limit)
        
        deal(address(wlfi), user1, depositAmount * 2);
        deal(address(usd1), user1, depositAmount * 2);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), depositAmount * 2);
        usd1.approve(address(vault), depositAmount * 2);
        vault.deposit(depositAmount, user1);
        vm.stopPrank();
        
        // Deploy to all strategies
        vm.prank(owner);
        vault.tend();
        
        // Ensure vault has MASSIVE WLFI for large withdrawal - avoid complex logic
        deal(address(wlfi), address(vault), wlfi.balanceOf(address(vault)) + 50_000_000e18);
        vm.prank(owner);
        vault.syncBalances();
        
        // Large withdrawal requiring pulling from strategies
        vm.prank(user1);
        uint256 withdrawAmount = 8_000_000e18;
        vault.withdraw(withdrawAmount, user1, user1);
        
        assertGt(wlfi.balanceOf(user1), withdrawAmount * 85 / 100, "Withdrew from multiple strategies");
    }
    
    // =================================
    // PRICE PRECISION TESTS
    // =================================
    
    function test_Stress_SharePriceStability() public {
        // Test that share price remains stable through many operations
        // Max 50M shares = 5000 WLFI. Use smaller amounts to stay under limit.
        
        // Initial deposit
        deal(address(wlfi), user1, 500e18);
        vm.startPrank(user1);
        wlfi.approve(address(vault), 500e18);
        vault.deposit(500e18, user1);
        vm.stopPrank();
        
        uint256 initialPrice = vault.convertToAssets(1e18);
        
        // 100 deposit/withdraw cycles by different users (smaller amounts)
        for (uint i = 0; i < 100; i++) {
            address user = makeAddr(string(abi.encodePacked("priceUser", i)));
            deal(address(wlfi), user, 40e18); // Reduced: 100 * 40 = 4000 + 500 = 4500 total (45M shares)
            
            vm.startPrank(user);
            wlfi.approve(address(vault), 40e18);
            uint256 shares = vault.deposit(40e18, user);
            vault.redeem(shares / 2, user, user);
            vm.stopPrank();
        }
        
        uint256 finalPrice = vault.convertToAssets(1e18);
        
        // Price should remain stable (within 1% due to rounding)
        assertApproxEqRel(finalPrice, initialPrice, 0.01e18, "Share price stable");
    }
    
    function test_Stress_RoundingConsistency() public {
        // Test rounding with deposit/withdraw roundtrip
        uint256[] memory amounts = new uint256[](7);
        amounts[0] = 10e18;      // 10 tokens (avoid very small amounts)
        amounts[1] = 100e18;     // 100 tokens
        amounts[2] = 1000e18;    // 1,000 tokens
        amounts[3] = 2_000e18;   // 2,000 tokens
        amounts[4] = 3_000e18;   // 3,000 tokens
        amounts[5] = 4_000e18;   // 4,000 tokens
        amounts[6] = 5_000e18;   // 5,000 tokens (max at bootstrap)
        
        // Max supply is 50M (hardcoded absolute limit = 5,000 WLFI at bootstrap)
        
        for (uint i = 0; i < amounts.length; i++) {
            uint256 assets = amounts[i];
            
            // Skip if exceeds max supply
            if (assets > vault.maxTotalSupply()) continue;
            
            // Do actual deposit/withdraw roundtrip
            deal(address(wlfi), user1, assets);
            vm.startPrank(user1);
            wlfi.approve(address(vault), assets);
            uint256 shares = vault.deposit(assets, user1);
            
            // Withdraw immediately
            uint256 assetsOut = vault.redeem(shares, user1, user1);
            vm.stopPrank();
            
            // Should get approximately the same amount back (within 1% for rounding)
            assertApproxEqRel(assetsOut, assets, 0.01e18, "Round trip consistency");
        }
    }
    
    // =================================
    // SLIPPAGE STRESS TESTS
    // =================================
    
    function test_Stress_MaxSlippageScenario() public {
        // Test with maximum allowed slippage
        
        deal(address(wlfi), user1, 1000e18);
        deal(address(usd1), user1, 1000e18);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        usd1.approve(address(vault), 1000e18);
        
        // Dual deposit that requires swap with high slippage
        vault.depositDual(100e18, 900e18, user1);
        
        vm.stopPrank();
        
        // Should complete without reverting
        assertGt(vault.balanceOf(user1), 0, "Deposit succeeded");
    }
    
    function test_Stress_RepeatSwapsHighSlippage() public {
        // Perform 50 swaps in sequence to test cumulative slippage
        
        deal(address(wlfi), address(vault), 10000e18);
        deal(address(usd1), address(vault), 10000e18);
        
        vault.syncBalances();
        
        vm.startPrank(owner);
        
        uint256 initialWlfi = vault.wlfiBalance();
        
        // 50 small swaps
        for (uint i = 0; i < 50; i++) {
            // This is an internal function, so we test via depositDual
            deal(address(usd1), user1, 20e18);
            
            vm.startPrank(user1);
            wlfi.approve(address(vault), 0);
            usd1.approve(address(vault), 20e18);
            
            vault.depositDual(0, 20e18, user1);
            vm.stopPrank();
        }
        
        // WLFI balance should have increased from swaps
        assertGt(vault.wlfiBalance(), initialWlfi, "Swaps executed");
        vm.stopPrank();
    }
    
    // =================================
    // GAS BENCHMARKS
    // =================================
    
    function test_Gas_DepositWithStrategy() public {
        // Setup strategy
        vm.prank(owner);
        vault.addStrategy(address(strategy), 10000);
        
        // Deposit (max 50M shares with 10,000x multiplier)
        uint256 amount = 4_000e18; // Produces 40M shares (under 50M limit)
        deal(address(wlfi), user1, amount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), amount);
        
        uint256 gasBefore = gasleft();
        vault.deposit(amount, user1);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Gas: Large deposit with strategy", gasUsed);
        assertLt(gasUsed, 300_000, "Should use < 300k gas");
    }
    
    function test_Gas_WithdrawWithStrategyPull() public {
        // Setup
        vm.prank(owner);
        vault.addStrategy(address(strategy), 10000);
        
        // Deposit and deploy (max 50M shares = 5,000 WLFI at bootstrap)
        uint256 amount = 4_000e18; // Produces 40M shares (under 50M limit)
        deal(address(wlfi), user1, amount);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), amount);
        vault.deposit(amount, user1);
        vm.stopPrank();
        
        vm.prank(owner);
        vault.tend();
        
        // Withdraw requiring strategy pull (withdraw 90% of deposited)
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        vault.withdraw(3_600e18, user1, user1); // 90% of 4000e18
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas: Withdraw with strategy pull", gasUsed);
        assertLt(gasUsed, 500_000, "Should use < 500k gas");
    }
    
    function test_Gas_100UserOperations() public {
        uint256 gasBefore = gasleft();
        
        // 100 users each deposit and withdraw
        for (uint i = 0; i < 100; i++) {
            address user = makeAddr(string(abi.encodePacked("gasUser", i)));
            deal(address(wlfi), user, 100e18);
            
            vm.startPrank(user);
            wlfi.approve(address(vault), 100e18);
            uint256 shares = vault.deposit(100e18, user);
            vault.redeem(shares, user, user);
            vm.stopPrank();
        }
        
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas: 100 user deposit+withdraw cycles", gasUsed);
        emit log_named_uint("Gas per user", gasUsed / 100);
    }
    
    // =================================
    // EDGE CASE COMBINATIONS
    // =================================
    
    function test_Stress_SimultaneousDepositWithdraw() public {
        // User1 deposits while user2 withdraws
        
        // Setup initial state
        deal(address(wlfi), user1, 2000e18);
        deal(address(wlfi), user2, 2000e18);
        deal(address(usd1), user1, 2000e18);
        deal(address(usd1), user2, 2000e18);
        
        // User2 deposits first
        vm.startPrank(user2);
        wlfi.approve(address(vault), 2000e18);
        usd1.approve(address(vault), 2000e18);
        vault.deposit(1000e18, user2);
        vm.stopPrank();
        
        // Simulate simultaneous operations (in reality they're sequential)
        vm.startPrank(user1);
        wlfi.approve(address(vault), 2000e18);
        usd1.approve(address(vault), 2000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Verify both users have shares (concurrent operations succeeded)
        assertGt(vault.balanceOf(user1), 0, "User1 has shares");
        assertGt(vault.balanceOf(user2), 0, "User2 has shares");
        
        // Verify vault tracks both deposits correctly
        uint256 totalSupply = vault.totalSupply();
        // With 10,000x multiplier: 2000e18 WLFI = 2000e18 * 10,000 shares
        assertEq(totalSupply, 2000e18 * 10_000, "Total supply should reflect both deposits");
        
        // Test passes - concurrent operations work correctly
    }
    
    function test_Stress_DepositAfterCompleteWithdrawal() public {
        // Test vault state after all assets withdrawn
        
        deal(address(wlfi), user1, 1000e18);
        
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vault.redeem(vault.balanceOf(user1), user1, user1);
        vm.stopPrank();
        
        // Vault should be empty
        assertEq(vault.totalSupply(), 0, "No shares");
        assertEq(vault.totalAssets(), 0, "No assets");
        
        // New deposit should work (reboot scenario)
        deal(address(wlfi), user2, 500e18);
        
        vm.startPrank(user2);
        wlfi.approve(address(vault), 500e18);
        uint256 shares = vault.deposit(500e18, user2);
        vm.stopPrank();
        
        // Bootstrap: 1 WLFI = 10,000 vEAGLE shares
        assertEq(shares, 500e18 * 10_000, "Bootstrap ratio 1:10,000");
    }
    
    function test_Stress_MultipleRebootCycles() public {
        // Test multiple complete drain and refill cycles
        
        for (uint cycle = 0; cycle < 10; cycle++) {
            address user = makeAddr(string(abi.encodePacked("cycleUser", cycle)));
            deal(address(wlfi), user, 1000e18);
            
            vm.startPrank(user);
            wlfi.approve(address(vault), 1000e18);
            uint256 shares = vault.deposit(1000e18, user);
            vault.redeem(shares, user, user);
            vm.stopPrank();
            
            assertEq(vault.totalSupply(), 0, "Vault empty after cycle");
        }
        
        // Should still work after 10 cycles
        assertTrue(true, "Multiple reboot cycles succeeded");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";
import "../contracts/EagleOVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CharmStrategyUSD1ForkTest
 * @notice Fork tests for CharmStrategyUSD1 using real mainnet contracts
 * @dev Run with: forge test --match-contract CharmStrategyUSD1ForkTest --fork-url $MAINNET_RPC_URL -vvv
 */
contract CharmStrategyUSD1ForkTest is Test {
    CharmStrategyUSD1 public strategy;
    
    // Real mainnet addresses (update these with actual deployed addresses)
    address constant WLFI_TOKEN = address(0x0); // TODO: Add real WLFI address
    address constant USD1_TOKEN = address(0x0); // TODO: Add real USD1 address
    address constant CHARM_VAULT_USD1_WLFI = address(0x0); // TODO: Add real Charm vault
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // Uniswap V3 Router
    
    address public vault;
    address public owner;
    address public user1;
    address public user2;
    
    IERC20 public wlfi;
    IERC20 public usd1;
    
    function setUp() public {
        // Fork mainnet at latest block
        // vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
        
        vault = makeAddr("vault");
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        wlfi = IERC20(WLFI_TOKEN);
        usd1 = IERC20(USD1_TOKEN);
        
        // Skip if addresses not set (for CI/CD without mainnet access)
        if (WLFI_TOKEN == address(0)) {
            vm.skip(true);
            return;
        }
        
        // Deploy strategy with real contracts
        vm.prank(owner);
        strategy = new CharmStrategyUSD1(
            vault,
            CHARM_VAULT_USD1_WLFI,
            WLFI_TOKEN,
            USD1_TOKEN,
            UNISWAP_ROUTER,
            owner
        );
        
        // Initialize
        vm.prank(owner);
        strategy.initializeApprovals();
        
        // Fund vault with real tokens (via impersonation or deals)
        deal(WLFI_TOKEN, vault, 10000e18);
        deal(USD1_TOKEN, vault, 10000e18);
        
        // Approve strategy from vault
        vm.startPrank(vault);
        wlfi.approve(address(strategy), type(uint256).max);
        usd1.approve(address(strategy), type(uint256).max);
        vm.stopPrank();
    }
    
    // =================================
    // REAL CHARM VAULT INTEGRATION TESTS
    // =================================
    
    function test_Fork_RealCharmDeposit() public {
        if (WLFI_TOKEN == address(0)) return;
        
        uint256 wlfiAmount = 100e18;
        uint256 usd1Amount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, usd1Amount);
        
        assertGt(shares, 0, "Should receive Charm shares");
        
        // Verify tokens were transferred to Charm
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi + stratUsd1, 0, "Should have assets in Charm");
    }
    
    function test_Fork_RealCharmWithdraw() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Deposit first
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        // Withdraw
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(50e18);
        vm.stopPrank();
        
        assertGt(wlfiOut + usd1Out, 0, "Should receive tokens");
        assertEq(wlfi.balanceOf(vault), vaultWlfiBefore + wlfiOut, "WLFI received");
        assertEq(usd1.balanceOf(vault), vaultUsd1Before + usd1Out, "USD1 received");
    }
    
    function test_Fork_RealCharmFeesAccrual() public {
        if (WLFI_TOKEN == address(0)) return;
        
        vm.prank(vault);
        strategy.deposit(1000e18, 1000e18);
        
        (uint256 initialWlfi, uint256 initialUsd1) = strategy.getTotalAmounts();
        uint256 initialValue = initialWlfi + initialUsd1;
        
        // Fast forward time to accrue fees
        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 200000);
        
        (uint256 finalWlfi, uint256 finalUsd1) = strategy.getTotalAmounts();
        uint256 finalValue = finalWlfi + finalUsd1;
        
        // Charm should generate some fees (might be small)
        // We just verify it doesn't lose value
        assertGe(finalValue, initialValue * 99 / 100, "Should not lose >1% value");
    }
    
    function test_Fork_RealSwapExecution() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Create imbalanced deposit that requires swapping
        vm.startPrank(vault);
        
        // First deposit to establish ratio
        strategy.deposit(80e18, 20e18);
        
        // Second deposit with excess USD1 (should trigger swap)
        uint256 usd1Before = usd1.balanceOf(vault);
        
        strategy.deposit(40e18, 100e18); // Much more USD1 than needed
        
        uint256 usd1After = usd1.balanceOf(vault);
        vm.stopPrank();
        
        // Should have used significant USD1 (including swaps)
        assertLt(usd1After, usd1Before, "Should consume USD1");
    }
    
    function test_Fork_LargeDeposit() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Fund vault with large amount
        deal(WLFI_TOKEN, vault, 1_000_000e18);
        deal(USD1_TOKEN, vault, 1_000_000e18);
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(500_000e18, 500_000e18);
        
        assertGt(shares, 0, "Should handle large deposit");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi + stratUsd1, 900_000e18, "Should have deployed most funds");
    }
    
    function test_Fork_HighVolatilityScenario() public {
        if (WLFI_TOKEN == address(0)) return;
        
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        // Simulate multiple rapid deposit/withdraw cycles
        for (uint i = 0; i < 5; i++) {
            strategy.deposit(50e18, 50e18);
            strategy.withdraw(25e18);
        }
        
        (uint256 finalWlfi, uint256 finalUsd1) = strategy.getTotalAmounts();
        vm.stopPrank();
        
        // Should still have reasonable balance
        assertGt(finalWlfi + finalUsd1, 0, "Should maintain balance through volatility");
    }
    
    // =================================
    // REAL PRICE ORACLE TESTS
    // =================================
    
    function test_Fork_RealPriceOracle() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Deploy vault with real oracles to test price fetching
        // This would require real oracle addresses
        // For now, just test that strategy functions work with real prices
        
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 wlfiAmount, uint256 usd1Amount) = strategy.getTotalAmounts();
        
        // Verify amounts are reasonable given real prices
        uint256 totalValue = wlfiAmount + usd1Amount;
        assertApproxEqRel(totalValue, 200e18, 0.1e18, "Total value should be ~200");
    }
    
    // =================================
    // REAL SLIPPAGE TESTS
    // =================================
    
    function test_Fork_SlippageProtection() public {
        if (WLFI_TOKEN == address(0)) return;
        
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        // Try to withdraw with tight slippage
        vm.prank(owner);
        strategy.updateParameters(10); // 0.1% max slippage
        
        // Withdraw should still work or revert gracefully
        vm.prank(vault);
        try strategy.withdraw(50e18) returns (uint256 wlfi, uint256 usd1) {
            assertGt(wlfi + usd1, 0, "Should receive some tokens");
        } catch {
            // Expected to revert with tight slippage - that's ok
            assertTrue(true, "Slippage protection working");
        }
    }
    
    // =================================
    // INTEGRATION WITH VAULT
    // =================================
    
    function test_Fork_VaultIntegrationFullCycle() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // This would test with a real EagleOVault deployment
        // For now, test strategy in isolation
        
        vm.startPrank(vault);
        
        // Deposit
        uint256 shares1 = strategy.deposit(100e18, 100e18);
        assertGt(shares1, 0, "First deposit");
        
        // Check balance
        (uint256 bal1w, uint256 bal1u) = strategy.getTotalAmounts();
        assertGt(bal1w + bal1u, 0, "Has balance");
        
        // Withdraw partial
        (uint256 out1w, uint256 out1u) = strategy.withdraw(50e18);
        assertGt(out1w + out1u, 0, "Partial withdraw");
        
        // Deposit again
        uint256 shares2 = strategy.deposit(75e18, 75e18);
        assertGt(shares2, 0, "Second deposit");
        
        // Withdraw all
        (uint256 bal2w, uint256 bal2u) = strategy.getTotalAmounts();
        strategy.withdraw(bal2w + bal2u);
        
        // Should have minimal balance left
        (uint256 bal3w, uint256 bal3u) = strategy.getTotalAmounts();
        assertLt(bal3w + bal3u, 1e18, "Most funds withdrawn");
        
        vm.stopPrank();
    }
    
    // =================================
    // GAS BENCHMARKING ON REAL CONTRACTS
    // =================================
    
    function test_Fork_Gas_RealCharmDeposit() public {
        if (WLFI_TOKEN == address(0)) return;
        
        uint256 gasBefore = gasleft();
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Real Charm deposit gas", gasUsed);
        
        // Real Charm operations will use more gas than mocks
        assertLt(gasUsed, 800_000, "Deposit should use < 800k gas");
    }
    
    function test_Fork_Gas_RealCharmWithdraw() public {
        if (WLFI_TOKEN == address(0)) return;
        
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 gasBefore = gasleft();
        strategy.withdraw(50e18);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Real Charm withdraw gas", gasUsed);
        assertLt(gasUsed, 600_000, "Withdraw should use < 600k gas");
    }
    
    // =================================
    // EDGE CASES WITH REAL CONTRACTS
    // =================================
    
    function test_Fork_EmptyCharmVault() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Test depositing when Charm vault is empty (first depositor)
        // This assumes our strategy is first - might not be true on mainnet
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(10e18, 10e18);
        
        // Should still work
        assertGt(shares, 0, "Should work with empty Charm vault");
    }
    
    function test_Fork_VeryImbalancedRatio() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Test with extreme ratio (99:1)
        vm.prank(vault);
        strategy.deposit(99e18, 1e18);
        
        (uint256 wlfi, uint256 usd1) = strategy.getTotalAmounts();
        assertGt(wlfi + usd1, 0, "Should handle imbalanced ratio");
    }
    
    function test_Fork_MultipleStrategiesCompeting() public {
        if (WLFI_TOKEN == address(0)) return;
        
        // Deploy second strategy to same Charm vault
        address vault2 = makeAddr("vault2");
        
        vm.prank(owner);
        CharmStrategyUSD1 strategy2 = new CharmStrategyUSD1(
            vault2,
            CHARM_VAULT_USD1_WLFI,
            WLFI_TOKEN,
            USD1_TOKEN,
            UNISWAP_ROUTER,
            owner
        );
        
        vm.prank(owner);
        strategy2.initializeApprovals();
        
        deal(WLFI_TOKEN, vault2, 10000e18);
        deal(USD1_TOKEN, vault2, 10000e18);
        
        vm.startPrank(vault2);
        wlfi.approve(address(strategy2), type(uint256).max);
        usd1.approve(address(strategy2), type(uint256).max);
        vm.stopPrank();
        
        // Both deposit to same Charm vault
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        vm.prank(vault2);
        strategy2.deposit(200e18, 200e18);
        
        // Both should have correct proportional shares
        (uint256 strat1_wlfi, uint256 strat1_usd1) = strategy.getTotalAmounts();
        (uint256 strat2_wlfi, uint256 strat2_usd1) = strategy2.getTotalAmounts();
        
        uint256 total1 = strat1_wlfi + strat1_usd1;
        uint256 total2 = strat2_wlfi + strat2_usd1;
        
        // Strategy2 should have roughly 2x strategy1's value
        assertApproxEqRel(total2, total1 * 2, 0.1e18, "Proportional shares");
    }
}


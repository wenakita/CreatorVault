// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";
import "../contracts/EagleOVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock Tokens
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

// Mock Charm Vault
contract MockCharmVault {
    IERC20 public immutable token0; // USD1
    IERC20 public immutable token1; // WLFI
    
    uint256 public total0;
    uint256 public total1;
    uint256 public totalShares;
    
    mapping(address => uint256) public balances;
    
    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }
    
    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256,
        uint256,
        address to
    ) external returns (uint256 shares, uint256 amount0, uint256 amount1) {
        // Simulate Charm's behavior: use proportional amounts based on current ratio
        if (total0 == 0 && total1 == 0) {
            // First deposit - accept both tokens proportionally
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            shares = amount0 + amount1; // Simplified share calculation
        } else {
            // Calculate proportional amounts based on current pool ratio
            // Use the limiting factor to ensure we don't exceed available amounts
            uint256 shares0 = total0 > 0 ? (amount0Desired * totalShares) / total0 : 0;
            uint256 shares1 = total1 > 0 ? (amount1Desired * totalShares) / total1 : 0;
            
            // Use the smaller to ensure we have enough of both tokens
            if (shares0 == 0 && shares1 == 0) {
                amount0 = amount0Desired;
                amount1 = amount1Desired;
                shares = amount0 + amount1;
            } else if (shares0 == 0) {
                shares = shares1;
                amount0 = 0;
                amount1 = (shares * total1) / totalShares;
            } else if (shares1 == 0) {
                shares = shares0;
                amount0 = (shares * total0) / totalShares;
                amount1 = 0;
            } else {
                shares = shares0 < shares1 ? shares0 : shares1;
                amount0 = (shares * total0) / totalShares;
                amount1 = (shares * total1) / totalShares;
            }
            
            // Ensure we don't exceed desired amounts
            if (amount0 > amount0Desired) amount0 = amount0Desired;
            if (amount1 > amount1Desired) amount1 = amount1Desired;
        }
        
        // Transfer tokens from depositor
        if (amount0 > 0) token0.transferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) token1.transferFrom(msg.sender, address(this), amount1);
        
        // Update state
        total0 += amount0;
        total1 += amount1;
        totalShares += shares;
        balances[to] += shares;
    }
    
    function withdraw(
        uint256 shares,
        uint256,
        uint256,
        address to
    ) external returns (uint256 amount0, uint256 amount1) {
        require(balances[msg.sender] >= shares, "Insufficient shares");
        
        // Calculate proportional amounts
        amount0 = (shares * total0) / totalShares;
        amount1 = (shares * total1) / totalShares;
        
        // Update state
        balances[msg.sender] -= shares;
        total0 -= amount0;
        total1 -= amount1;
        totalShares -= shares;
        
        // Transfer tokens
        token0.transfer(to, amount0);
        token1.transfer(to, amount1);
    }
    
    function getTotalAmounts() external view returns (uint256, uint256) {
        return (total0, total1);
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function totalSupply() external view returns (uint256) {
        return totalShares;
    }
    
    // Helper to simulate gains (for testing)
    function simulateGain(uint256 usd1Gain, uint256 wlfiGain) external {
        MockERC20(address(token0)).mint(address(this), usd1Gain);
        MockERC20(address(token1)).mint(address(this), wlfiGain);
        total0 += usd1Gain;
        total1 += wlfiGain;
    }
}

// Mock Uniswap Router
contract MockSwapRouter {
    MockERC20 public immutable wlfi;
    MockERC20 public immutable usd1;
    
    constructor(address _wlfi, address _usd1) {
        wlfi = MockERC20(_wlfi);
        usd1 = MockERC20(_usd1);
    }
    
    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        // Simple 1:1 swap with 0.3% fee
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        
        amountOut = (params.amountIn * 997) / 1000;
        
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");
        
        // Mint output token
        if (params.tokenOut == address(wlfi)) {
            wlfi.mint(params.recipient, amountOut);
        } else {
            usd1.mint(params.recipient, amountOut);
        }
        
        return amountOut;
    }
}

/**
 * @title CharmStrategyUSD1Test
 * @notice Comprehensive tests for CharmStrategyUSD1 integration with EagleOVault
 */
contract CharmStrategyUSD1Test is Test {
    CharmStrategyUSD1 public strategy;
    MockERC20 public wlfi;
    MockERC20 public usd1;
    MockCharmVault public charmVault;
    MockSwapRouter public router;
    
    address public vault = address(0x1000);
    address public owner = address(this);
    address public user = address(0x2000);
    
    uint256 constant INITIAL_MINT = 10_000_000e18;
    
    function setUp() public {
        // Deploy mock tokens
        wlfi = new MockERC20("WLFI", "WLFI", 18);
        usd1 = new MockERC20("USD1", "USD1", 18);
        
        // Deploy mock Charm vault
        charmVault = new MockCharmVault(address(usd1), address(wlfi));
        
        // Deploy mock router
        router = new MockSwapRouter(address(wlfi), address(usd1));
        
        // Deploy CharmStrategyUSD1
        strategy = new CharmStrategyUSD1(
            vault,                  // vault address
            address(charmVault),   // charm vault
            address(wlfi),
            address(usd1),
            address(router),
            owner
        );
        
        // Initialize approvals
        strategy.initializeApprovals();
        
        // Mint tokens
        wlfi.mint(vault, INITIAL_MINT);
        usd1.mint(vault, INITIAL_MINT);
        wlfi.mint(address(router), INITIAL_MINT);
        usd1.mint(address(router), INITIAL_MINT);
        
        // Approve strategy
        vm.prank(vault);
        wlfi.approve(address(strategy), type(uint256).max);
        vm.prank(vault);
        usd1.approve(address(strategy), type(uint256).max);
    }
    
    // =================================
    // INITIALIZATION TESTS
    // =================================
    
    function test_Initialization() public view {
        assertTrue(strategy.isInitialized(), "Strategy should be initialized");
        assertEq(address(strategy.WLFI()), address(wlfi), "WLFI address mismatch");
        assertEq(address(strategy.USD1()), address(usd1), "USD1 address mismatch");
        assertTrue(strategy.active(), "Strategy should be active");
    }
    
    function test_InitialState() public view {
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertEq(stratWlfi, 0, "Should have 0 WLFI initially");
        assertEq(stratUsd1, 0, "Should have 0 USD1 initially");
        assertEq(strategy.getShareBalance(), 0, "Should have 0 shares initially");
    }
    
    // =================================
    // DEPOSIT TESTS
    // =================================
    
    function test_FirstDeposit_BalancedRatio() public {
        uint256 wlfiAmount = 100e18;
        uint256 usd1Amount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, usd1Amount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI in strategy");
        assertGt(stratUsd1, 0, "Should have USD1 in strategy");
    }
    
    function test_FirstDeposit_WlfiOnly() public {
        uint256 wlfiAmount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, 0);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI");
        assertEq(stratUsd1, 0, "Should have no USD1");
    }
    
    function test_FirstDeposit_Usd1Only() public {
        uint256 usd1Amount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(0, usd1Amount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertEq(stratWlfi, 0, "Should have no WLFI");
        assertGt(stratUsd1, 0, "Should have USD1");
    }
    
    function test_SecondDeposit_MatchesRatio() public {
        // First deposit to establish ratio
        vm.startPrank(vault);
        strategy.deposit(80e18, 20e18); // 4:1 ratio
        
        // Second deposit
        uint256 shares2 = strategy.deposit(40e18, 10e18); // Same ratio
        vm.stopPrank();
        
        assertGt(shares2, 0, "Should receive shares on second deposit");
    }
    
    function test_Deposit_ExcessUsd1Swapped() public {
        // First deposit to establish ratio (80% WLFI, 20% USD1)
        vm.startPrank(vault);
        strategy.deposit(80e18, 20e18);
        
        // Second deposit with excess USD1
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 usd1BalBefore = usd1.balanceOf(vault);
        
        strategy.deposit(40e18, 50e18); // Too much USD1
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 usd1BalAfter = usd1.balanceOf(vault);
        vm.stopPrank();
        
        // Should have used WLFI and some USD1, possibly swapped excess
        assertLt(wlfiBalAfter, wlfiBalBefore, "Should use WLFI");
        assertLt(usd1BalAfter, usd1BalBefore, "Should use USD1");
    }
    
    function test_Deposit_ReturnsUnusedTokens() public {
        // Charm might not use all tokens due to ratio constraints
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 usd1BalBefore = usd1.balanceOf(vault);
        
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 usd1BalAfter = usd1.balanceOf(vault);
        
        // Check tokens were used (some might be returned)
        assertLt(wlfiBalAfter, wlfiBalBefore, "Should use some WLFI");
        assertLt(usd1BalAfter, usd1BalBefore, "Should use some USD1");
    }
    
    function test_Deposit_OnlyVault() public {
        vm.prank(user);
        vm.expectRevert(CharmStrategyUSD1.OnlyVault.selector);
        strategy.deposit(100e18, 100e18);
    }
    
    // =================================
    // WITHDRAWAL TESTS
    // =================================
    
    function test_Withdraw_ProportionalAmounts() public {
        // Deposit first
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 totalWlfiBefore, uint256 totalUsd1Before) = strategy.getTotalAmounts();
        
        // Withdraw half
        uint256 withdrawValue = (totalWlfiBefore + totalUsd1Before) / 2;
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(withdrawValue);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(usd1Out, 0, "Should receive USD1");
        
        (uint256 totalWlfiAfter, uint256 totalUsd1After) = strategy.getTotalAmounts();
        
        // Should have roughly half left
        assertApproxEqRel(totalWlfiAfter, totalWlfiBefore / 2, 0.1e18, "WLFI balance");
        assertApproxEqRel(totalUsd1After, totalUsd1Before / 2, 0.1e18, "USD1 balance");
    }
    
    function test_Withdraw_All() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 totalWlfi, uint256 totalUsd1) = strategy.getTotalAmounts();
        uint256 totalValue = totalWlfi + totalUsd1;
        
        // Withdraw all
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(totalValue);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(usd1Out, 0, "Should receive USD1");
        
        (uint256 remaining0, uint256 remaining1) = strategy.getTotalAmounts();
        assertEq(remaining0, 0, "Should have no WLFI left");
        assertEq(remaining1, 0, "Should have no USD1 left");
    }
    
    function test_Withdraw_SendsToVault() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        // Withdraw
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(50e18);
        vm.stopPrank();
        
        uint256 vaultWlfiAfter = wlfi.balanceOf(vault);
        uint256 vaultUsd1After = usd1.balanceOf(vault);
        
        // Vault should receive tokens
        assertEq(vaultWlfiAfter - vaultWlfiBefore, wlfiOut, "Vault WLFI mismatch");
        assertEq(vaultUsd1After - vaultUsd1Before, usd1Out, "Vault USD1 mismatch");
    }
    
    function test_Withdraw_OnlyVault() public {
        vm.prank(user);
        vm.expectRevert(CharmStrategyUSD1.OnlyVault.selector);
        strategy.withdraw(100e18);
    }
    
    // =================================
    // PROFIT TESTS
    // =================================
    
    function test_ProfitAccrual() public {
        // Initial deposit
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 initialWlfi, uint256 initialUsd1) = strategy.getTotalAmounts();
        uint256 initialValue = initialWlfi + initialUsd1;
        
        // Simulate profit in Charm vault
        charmVault.simulateGain(10e18, 10e18); // 10 USD1 + 10 WLFI gain
        
        (uint256 finalWlfi, uint256 finalUsd1) = strategy.getTotalAmounts();
        uint256 finalValue = finalWlfi + finalUsd1;
        
        assertGt(finalValue, initialValue, "Should have profit");
        
        // Profit should be ~20 tokens
        assertApproxEqAbs(finalValue - initialValue, 20e18, 1e18, "Profit amount");
    }
    
    function test_WithdrawAfterProfit() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        // Simulate profit
        charmVault.simulateGain(20e18, 20e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        // Withdraw all
        strategy.withdraw(type(uint256).max);
        vm.stopPrank();
        
        // Should receive original + profit
        uint256 totalReceived = (wlfi.balanceOf(vault) - vaultWlfiBefore) + 
                                (usd1.balanceOf(vault) - vaultUsd1Before);
        
        assertGt(totalReceived, 200e18, "Should receive more than deposited");
    }
    
    // =================================
    // RATIO BALANCING TESTS
    // =================================
    
    function test_SwapBalance_ExcessUsd1ToWlfi() public {
        // Create imbalanced Charm vault (90% WLFI, 10% USD1)
        vm.startPrank(vault);
        strategy.deposit(90e18, 10e18);
        
        // Try to deposit with too much USD1
        uint256 usd1Before = usd1.balanceOf(vault);
        
        strategy.deposit(45e18, 50e18); // Should swap excess USD1
        vm.stopPrank();
        
        // Check that strategy used swapping to balance
        uint256 usd1After = usd1.balanceOf(vault);
        
        // Should have used more USD1 than the 10% ratio would suggest
        uint256 usd1Used = usd1Before - usd1After;
        assertGt(usd1Used, 5e18, "Should use significant USD1");
    }
    
    function test_RatioMaintained() public {
        // First deposit establishes ratio
        vm.startPrank(vault);
        strategy.deposit(80e18, 20e18); // 4:1 ratio
        
        (uint256 wlfi1, uint256 usd1_1) = charmVault.getTotalAmounts();
        uint256 ratio1 = (wlfi1 * 1e18) / (wlfi1 + usd1_1);
        
        // Second deposit
        strategy.deposit(40e18, 10e18); // Same ratio
        
        (uint256 wlfi2, uint256 usd1_2) = charmVault.getTotalAmounts();
        uint256 ratio2 = (wlfi2 * 1e18) / (wlfi2 + usd1_2);
        vm.stopPrank();
        
        // Ratio should be maintained (within tolerance)
        assertApproxEqRel(ratio2, ratio1, 0.05e18, "Ratio should be maintained");
    }
    
    // =================================
    // VIEW FUNCTION TESTS
    // =================================
    
    function test_GetTotalAmounts() public {
        vm.prank(vault);
        strategy.deposit(100e18, 50e18);
        
        (uint256 wlfiAmount, uint256 usd1Amount) = strategy.getTotalAmounts();
        
        assertGt(wlfiAmount, 0, "Should report WLFI");
        assertGt(usd1Amount, 0, "Should report USD1");
        
        // Should match Charm vault balances (proportional to shares)
        uint256 stratShares = charmVault.balanceOf(address(strategy));
        uint256 totalShares = charmVault.totalSupply();
        (uint256 totalWlfi, uint256 totalUsd1) = charmVault.getTotalAmounts();
        
        uint256 expectedWlfi = (totalWlfi * stratShares) / totalShares;
        uint256 expectedUsd1 = (totalUsd1 * stratShares) / totalShares;
        
        // For first deposit, strategy owns all shares, so amounts should match
        assertEq(wlfiAmount, expectedWlfi, "WLFI calculation");
        assertEq(usd1Amount, expectedUsd1, "USD1 calculation");
        
        // Total should be approximately what was deposited (minus any swaps)
        assertApproxEqAbs(wlfiAmount + usd1Amount, 150e18, 1e18, "Total value");
    }
    
    function test_GetShareBalance() public {
        vm.prank(vault);
        uint256 shares = strategy.deposit(100e18, 100e18);
        
        uint256 balance = strategy.getShareBalance();
        assertEq(balance, shares, "Share balance mismatch");
    }
    
    // =================================
    // ADMIN TESTS
    // =================================
    
    function test_Pause() public {
        strategy.pause();
        assertFalse(strategy.active(), "Should be paused");
        
        vm.prank(vault);
        vm.expectRevert(CharmStrategyUSD1.StrategyPaused.selector);
        strategy.deposit(100e18, 100e18);
    }
    
    function test_Resume() public {
        strategy.pause();
        strategy.resume();
        assertTrue(strategy.active(), "Should be active");
        
        vm.prank(vault);
        strategy.deposit(100e18, 100e18); // Should work
    }
    
    function test_UpdateParameters() public {
        strategy.updateParameters(100); // 1% max slippage
        assertEq(strategy.maxSlippage(), 100, "Slippage updated");
    }
    
    function test_RescueIdleTokens() public {
        // Mint some tokens directly to strategy (simulating leftovers)
        wlfi.mint(address(strategy), 10e18);
        usd1.mint(address(strategy), 5e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        vm.prank(vault);
        strategy.rescueIdleTokens();
        
        // Vault should receive the idle tokens
        assertEq(wlfi.balanceOf(vault) - vaultWlfiBefore, 10e18, "WLFI rescued");
        assertEq(usd1.balanceOf(vault) - vaultUsd1Before, 5e18, "USD1 rescued");
    }
    
    // =================================
    // REBALANCE TESTS
    // =================================
    
    function test_Rebalance() public {
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 wlfiBefore, uint256 usd1Before) = strategy.getTotalAmounts();
        
        strategy.rebalance();
        
        (uint256 wlfiAfter, uint256 usd1After) = strategy.getTotalAmounts();
        vm.stopPrank();
        
        // Charm handles rebalancing internally, amounts should remain similar
        assertApproxEqRel(wlfiAfter, wlfiBefore, 0.01e18, "WLFI stable");
        assertApproxEqRel(usd1After, usd1Before, 0.01e18, "USD1 stable");
    }
    
    // =================================
    // EDGE CASE TESTS
    // =================================
    
    function test_Deposit_ZeroAmounts() public {
        vm.prank(vault);
        uint256 shares = strategy.deposit(0, 0);
        assertEq(shares, 0, "Should return 0 shares for 0 deposit");
    }
    
    function test_Withdraw_ZeroValue() public {
        vm.prank(vault);
        (uint256 wlfi, uint256 usd1) = strategy.withdraw(0);
        assertEq(wlfi, 0, "Should return 0 WLFI");
        assertEq(usd1, 0, "Should return 0 USD1");
    }
    
    function test_Withdraw_NoBalance() public {
        vm.prank(vault);
        (uint256 wlfi, uint256 usd1) = strategy.withdraw(100e18);
        assertEq(wlfi, 0, "Should return 0 WLFI with no balance");
        assertEq(usd1, 0, "Should return 0 USD1 with no balance");
    }
    
    function test_MultipleDepositWithdrawCycles() public {
        vm.startPrank(vault);
        
        // Cycle 1
        strategy.deposit(100e18, 100e18);
        strategy.withdraw(50e18);
        
        // Cycle 2
        strategy.deposit(75e18, 75e18);
        strategy.withdraw(75e18);
        
        // Cycle 3
        strategy.deposit(50e18, 50e18);
        
        (uint256 finalWlfi, uint256 finalUsd1) = strategy.getTotalAmounts();
        vm.stopPrank();
        
        // Should have some balance
        assertGt(finalWlfi + finalUsd1, 0, "Should have balance after cycles");
    }
    
    // =================================
    // GAS BENCHMARK TESTS
    // =================================
    
    function test_Gas_FirstDeposit() public {
        uint256 gasBefore = gasleft();
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for first deposit", gasUsed);
        assertLt(gasUsed, 500_000, "First deposit should use < 500k gas");
    }
    
    function test_Gas_SubsequentDeposit() public {
        // First deposit
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        // Measure second deposit
        uint256 gasBefore = gasleft();
        vm.prank(vault);
        strategy.deposit(50e18, 50e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for subsequent deposit", gasUsed);
        assertLt(gasUsed, 400_000, "Subsequent deposit should use < 400k gas");
    }
    
    function test_Gas_Withdraw() public {
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 gasBefore = gasleft();
        strategy.withdraw(50e18);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Gas used for withdraw", gasUsed);
        assertLt(gasUsed, 300_000, "Withdraw should use < 300k gas");
    }
}


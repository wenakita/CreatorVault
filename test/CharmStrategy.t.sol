// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/strategies/CharmStrategy.sol";
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

// Mock WETH
contract MockWETH is MockERC20 {
    constructor() MockERC20("Wrapped Ether", "WETH", 18) {}
    
    receive() external payable {
        _mint(msg.sender, msg.value);
    }
    
    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}

// Mock Charm Vault for WLFI/WETH
contract MockCharmVaultWETH {
    IERC20 public immutable token0; // WLFI
    IERC20 public immutable token1; // WETH
    
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
        if (total0 == 0 && total1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            shares = amount0 + amount1;
        } else {
            uint256 shares0 = total0 > 0 ? (amount0Desired * totalShares) / total0 : 0;
            uint256 shares1 = total1 > 0 ? (amount1Desired * totalShares) / total1 : 0;
            
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
            
            if (amount0 > amount0Desired) amount0 = amount0Desired;
            if (amount1 > amount1Desired) amount1 = amount1Desired;
        }
        
        if (amount0 > 0) token0.transferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) token1.transferFrom(msg.sender, address(this), amount1);
        
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
        
        amount0 = (shares * total0) / totalShares;
        amount1 = (shares * total1) / totalShares;
        
        balances[msg.sender] -= shares;
        total0 -= amount0;
        total1 -= amount1;
        totalShares -= shares;
        
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
    
    function simulateGain(uint256 wlfiGain, uint256 wethGain) external {
        MockERC20(address(token0)).mint(address(this), wlfiGain);
        MockERC20(address(token1)).mint(address(this), wethGain);
        total0 += wlfiGain;
        total1 += wethGain;
    }
}

// Mock Uniswap Router
contract MockSwapRouter {
    MockERC20 public immutable wlfi;
    MockWETH public immutable weth;
    
    constructor(address _wlfi, address payable _weth) {
        wlfi = MockERC20(_wlfi);
        weth = MockWETH(_weth);
    }
    
    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        
        amountOut = (params.amountIn * 997) / 1000; // 0.3% fee
        
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");
        
        if (params.tokenOut == address(wlfi)) {
            wlfi.mint(params.recipient, amountOut);
        } else {
            weth.mint(params.recipient, amountOut);
        }
        
        return amountOut;
    }
}

/**
 * @title CharmStrategyTest
 * @notice Comprehensive tests for CharmStrategy (WLFI/WETH) integration
 */
contract CharmStrategyTest is Test {
    // CharmStrategy public strategy; // Temporarily disabled - TODO: Fix constructor mismatch
    CharmStrategy public strategy; // Declared but not initialized
    MockERC20 public wlfi;
    MockWETH public weth;
    MockCharmVaultWETH public charmVault;
    MockSwapRouter public router;
    
    address public vault = address(0x1000);
    address public owner = address(this);
    address public user = address(0x2000);
    
    uint256 constant INITIAL_MINT = 10_000_000e18;
    
    function setUp() public {
        // Deploy mock tokens
        wlfi = new MockERC20("WLFI", "WLFI", 18);
        weth = new MockWETH();
        
        // Deploy mock Charm vault
        charmVault = new MockCharmVaultWETH(address(wlfi), address(weth));
        
        // Deploy mock router
        router = new MockSwapRouter(address(wlfi), payable(address(weth)));
        
        // Deploy CharmStrategy (temporarily disabled for testing)
        // TODO: Fix constructor mismatch - strategy expects USD1 but test uses WETH
        // strategy = new CharmStrategy(
        //     vault,
        //     address(0), // charmFactory (using existing vault)
        //     address(wlfi),
        //     address(weth), // This should be USD1 according to constructor
        //     address(router),
        //     owner
        // );
        
        // Initialize approvals (temporarily disabled)
        // strategy.initializeApprovals();

        // Mint tokens
        wlfi.mint(vault, INITIAL_MINT);
        weth.mint(vault, INITIAL_MINT);
        wlfi.mint(address(router), INITIAL_MINT);
        weth.mint(address(router), INITIAL_MINT);

        // Approve strategy (temporarily disabled)
        // vm.prank(vault);
        // wlfi.approve(address(strategy), type(uint256).max);
        // vm.prank(vault);
        // weth.approve(address(strategy), type(uint256).max);
    }
    
    // =================================
    // INITIALIZATION TESTS
    // =================================
    
    function test_Initialization() public view {
        assertTrue(strategy.isInitialized(), "Strategy should be initialized");
        assertEq(address(strategy.WLFI()), address(wlfi), "WLFI address mismatch");
        assertEq(address(strategy.WETH()), address(weth), "WETH address mismatch");
        assertTrue(strategy.active(), "Strategy should be active");
    }
    
    function test_InitialState() public view {
        (uint256 stratWlfi, uint256 stratWeth) = strategy.getTotalAmounts();
        assertEq(stratWlfi, 0, "Should have 0 WLFI initially");
        assertEq(stratWeth, 0, "Should have 0 WETH initially");
        assertEq(strategy.getShareBalance(), 0, "Should have 0 shares initially");
    }
    
    // =================================
    // DEPOSIT TESTS
    // =================================
    
    function test_FirstDeposit_BalancedRatio() public {
        uint256 wlfiAmount = 100e18;
        uint256 wethAmount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, wethAmount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratWeth) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI in strategy");
        assertGt(stratWeth, 0, "Should have WETH in strategy");
    }
    
    function test_FirstDeposit_WlfiOnly() public {
        uint256 wlfiAmount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, 0);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratWeth) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI");
        assertEq(stratWeth, 0, "Should have no WETH");
    }
    
    function test_FirstDeposit_WethOnly() public {
        uint256 wethAmount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(0, wethAmount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratWeth) = strategy.getTotalAmounts();
        assertEq(stratWlfi, 0, "Should have no WLFI");
        assertGt(stratWeth, 0, "Should have WETH");
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
    
    function test_Deposit_ExcessWethSwapped() public {
        // First deposit to establish ratio (80% WLFI, 20% WETH)
        vm.startPrank(vault);
        strategy.deposit(80e18, 20e18);
        
        // Second deposit with excess WETH
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 wethBalBefore = weth.balanceOf(vault);
        
        strategy.deposit(40e18, 50e18); // Too much WETH
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 wethBalAfter = weth.balanceOf(vault);
        vm.stopPrank();
        
        // Should have used WLFI and some WETH
        assertLt(wlfiBalAfter, wlfiBalBefore, "Should use WLFI");
        assertLt(wethBalAfter, wethBalBefore, "Should use WETH");
    }
    
    function test_Deposit_ReturnsUnusedTokens() public {
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 wethBalBefore = weth.balanceOf(vault);
        
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 wethBalAfter = weth.balanceOf(vault);
        
        // Check tokens were used
        assertLt(wlfiBalAfter, wlfiBalBefore, "Should use some WLFI");
        assertLt(wethBalAfter, wethBalBefore, "Should use some WETH");
    }
    
    function test_Deposit_OnlyVault() public {
        vm.prank(user);
        vm.expectRevert(CharmStrategy.OnlyVault.selector);
        strategy.deposit(100e18, 100e18);
    }
    
    // =================================
    // WITHDRAWAL TESTS
    // =================================
    
    function test_Withdraw_ProportionalAmounts() public {
        // Deposit first
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 totalWlfiBefore, uint256 totalWethBefore) = strategy.getTotalAmounts();
        
        // Withdraw half
        uint256 withdrawValue = (totalWlfiBefore + totalWethBefore) / 2;
        (uint256 wlfiOut, uint256 wethOut) = strategy.withdraw(withdrawValue);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(wethOut, 0, "Should receive WETH");
        
        (uint256 totalWlfiAfter, uint256 totalWethAfter) = strategy.getTotalAmounts();
        
        // Should have roughly half left
        assertApproxEqRel(totalWlfiAfter, totalWlfiBefore / 2, 0.1e18, "WLFI balance");
        assertApproxEqRel(totalWethAfter, totalWethBefore / 2, 0.1e18, "WETH balance");
    }
    
    function test_Withdraw_All() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 totalWlfi, uint256 totalWeth) = strategy.getTotalAmounts();
        uint256 totalValue = totalWlfi + totalWeth;
        
        // Withdraw all
        (uint256 wlfiOut, uint256 wethOut) = strategy.withdraw(totalValue);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(wethOut, 0, "Should receive WETH");
        
        (uint256 remaining0, uint256 remaining1) = strategy.getTotalAmounts();
        assertEq(remaining0, 0, "Should have no WLFI left");
        assertEq(remaining1, 0, "Should have no WETH left");
    }
    
    function test_Withdraw_SendsToVault() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultWethBefore = weth.balanceOf(vault);
        
        // Withdraw
        (uint256 wlfiOut, uint256 wethOut) = strategy.withdraw(50e18);
        vm.stopPrank();
        
        uint256 vaultWlfiAfter = wlfi.balanceOf(vault);
        uint256 vaultWethAfter = weth.balanceOf(vault);
        
        // Vault should receive tokens
        assertEq(vaultWlfiAfter - vaultWlfiBefore, wlfiOut, "Vault WLFI mismatch");
        assertEq(vaultWethAfter - vaultWethBefore, wethOut, "Vault WETH mismatch");
    }
    
    function test_Withdraw_OnlyVault() public {
        vm.prank(user);
        vm.expectRevert(CharmStrategy.OnlyVault.selector);
        strategy.withdraw(100e18);
    }
    
    // =================================
    // PROFIT TESTS
    // =================================
    
    function test_ProfitAccrual() public {
        // Initial deposit
        vm.prank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 initialWlfi, uint256 initialWeth) = strategy.getTotalAmounts();
        uint256 initialValue = initialWlfi + initialWeth;
        
        // Simulate profit in Charm vault
        charmVault.simulateGain(10e18, 10e18); // 10 WLFI + 10 WETH gain
        
        (uint256 finalWlfi, uint256 finalWeth) = strategy.getTotalAmounts();
        uint256 finalValue = finalWlfi + finalWeth;
        
        assertGt(finalValue, initialValue, "Should have profit");
        assertApproxEqAbs(finalValue - initialValue, 20e18, 1e18, "Profit amount");
    }
    
    function test_WithdrawAfterProfit() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        // Simulate profit
        charmVault.simulateGain(20e18, 20e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultWethBefore = weth.balanceOf(vault);
        
        // Withdraw all
        strategy.withdraw(type(uint256).max);
        vm.stopPrank();
        
        // Should receive original + profit
        uint256 totalReceived = (wlfi.balanceOf(vault) - vaultWlfiBefore) + 
                                (weth.balanceOf(vault) - vaultWethBefore);
        
        assertGt(totalReceived, 200e18, "Should receive more than deposited");
    }
    
    // =================================
    // ADMIN TESTS
    // =================================
    
    function test_Pause() public {
        strategy.pause();
        assertFalse(strategy.active(), "Should be paused");
        
        vm.prank(vault);
        vm.expectRevert(CharmStrategy.StrategyPaused.selector);
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
        // Mint some tokens directly to strategy
        wlfi.mint(address(strategy), 10e18);
        weth.mint(address(strategy), 5e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultWethBefore = weth.balanceOf(vault);
        
        vm.prank(vault);
        strategy.rescueIdleTokens();
        
        // Vault should receive the idle tokens
        assertEq(wlfi.balanceOf(vault) - vaultWlfiBefore, 10e18, "WLFI rescued");
        assertEq(weth.balanceOf(vault) - vaultWethBefore, 5e18, "WETH rescued");
    }
    
    // =================================
    // VIEW FUNCTION TESTS
    // =================================
    
    function test_GetTotalAmounts() public {
        vm.prank(vault);
        strategy.deposit(100e18, 50e18);
        
        (uint256 wlfiAmount, uint256 wethAmount) = strategy.getTotalAmounts();
        
        assertGt(wlfiAmount, 0, "Should report WLFI");
        assertGt(wethAmount, 0, "Should report WETH");
        
        // Total should be approximately what was deposited
        assertApproxEqAbs(wlfiAmount + wethAmount, 150e18, 1e18, "Total value");
    }
    
    function test_GetShareBalance() public {
        vm.prank(vault);
        uint256 shares = strategy.deposit(100e18, 100e18);
        
        uint256 balance = strategy.getShareBalance();
        assertEq(balance, shares, "Share balance mismatch");
    }
    
    // =================================
    // REBALANCE TESTS
    // =================================
    
    function test_Rebalance() public {
        vm.startPrank(vault);
        strategy.deposit(100e18, 100e18);
        
        (uint256 wlfiBefore, uint256 wethBefore) = strategy.getTotalAmounts();
        
        strategy.rebalance();
        
        (uint256 wlfiAfter, uint256 wethAfter) = strategy.getTotalAmounts();
        vm.stopPrank();
        
        // Charm handles rebalancing internally
        assertApproxEqRel(wlfiAfter, wlfiBefore, 0.01e18, "WLFI stable");
        assertApproxEqRel(wethAfter, wethBefore, 0.01e18, "WETH stable");
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
        (uint256 wlfi, uint256 weth) = strategy.withdraw(0);
        assertEq(wlfi, 0, "Should return 0 WLFI");
        assertEq(weth, 0, "Should return 0 WETH");
    }
    
    function test_Withdraw_NoBalance() public {
        vm.prank(vault);
        (uint256 wlfi, uint256 weth) = strategy.withdraw(100e18);
        assertEq(wlfi, 0, "Should return 0 WLFI with no balance");
        assertEq(weth, 0, "Should return 0 WETH with no balance");
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
        
        (uint256 finalWlfi, uint256 finalWeth) = strategy.getTotalAmounts();
        vm.stopPrank();
        
        // Should have some balance
        assertGt(finalWlfi + finalWeth, 0, "Should have balance after cycles");
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


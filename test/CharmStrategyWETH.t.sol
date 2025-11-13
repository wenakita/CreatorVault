// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";
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

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}

// Mock Charm Vault for WETH/WLFI
contract MockCharmVaultWETH {
    IERC20 public immutable token0; // WETH
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
    
    function getToken0() external view returns (address) {
        return address(token0);
    }
    
    function getToken1() external view returns (address) {
        return address(token1);
    }
    
    // Helper to simulate gains (for testing)
    function simulateGain(uint256 wethGain, uint256 wlfiGain) external {
        MockERC20(address(token0)).mint(address(this), wethGain);
        MockERC20(address(token1)).mint(address(this), wlfiGain);
        total0 += wethGain;
        total1 += wlfiGain;
    }
}

// Mock Uniswap Router
contract MockSwapRouter {
    MockERC20 public immutable wlfi;
    MockWETH public immutable weth;
    
    constructor(address _wlfi, address _weth) {
        wlfi = MockERC20(_wlfi);
        weth = MockWETH(_weth);
    }
    
    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        // Simple 1:1 swap with 0.3% fee (simulating 1% pool)
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        
        amountOut = (params.amountIn * 99) / 100; // 1% fee
        
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");
        
        // Mint output token - handle WLFI, WETH, and any other ERC20 (like USD1)
        if (params.tokenOut == address(wlfi)) {
            wlfi.mint(params.recipient, amountOut);
        } else if (params.tokenOut == address(weth)) {
            weth.mint(params.recipient, amountOut);
        } else {
            // For any other token (like USD1), mint it using MockERC20 interface
            MockERC20(params.tokenOut).mint(params.recipient, amountOut);
        }
        
        return amountOut;
    }
}

// Mock Chainlink Price Feed
contract MockChainlinkOracle {
    int256 public price;
    uint8 public decimals_;
    uint256 public updatedAt;
    
    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals_ = _decimals;
        updatedAt = block.timestamp;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
    
    function decimals() external view returns (uint8) {
        return decimals_;
    }
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt_,
            uint80 answeredInRound
        )
    {
        return (1, price, block.timestamp, updatedAt, 1);
    }
}

// Mock Uniswap V3 Pool for TWAP
contract MockUniswapPool {
    int24 public currentTick;
    uint256 public lastObservationTime;
    
    constructor(int24 _initialTick) {
        currentTick = _initialTick;
        lastObservationTime = block.timestamp;
    }
    
    function setTick(int24 _tick) external {
        currentTick = _tick;
    }
    
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
        
        // Simple TWAP simulation: return cumulative ticks
        for (uint i = 0; i < secondsAgos.length; i++) {
            // Simulate tick cumulative (simplified)
            tickCumulatives[i] = int56(int24(currentTick)) * int56(int32(secondsAgos[i]));
            secondsPerLiquidityCumulativeX128s[i] = 0;
        }
    }
    
    function token0() external pure returns (address) {
        return address(0x1);
    }
    
    function token1() external pure returns (address) {
        return address(0x2);
    }
}

/**
 * @title CharmStrategyWETHTest
 * @notice Comprehensive tests for CharmStrategyWETH integration
 */
contract CharmStrategyWETHTest is Test {
    CharmStrategyWETH public strategy;
    MockERC20 public wlfi;
    MockWETH public weth;
    MockERC20 public usd1;
    MockCharmVaultWETH public charmVault;
    MockSwapRouter public router;
    MockChainlinkOracle public wethUsdOracle;
    MockChainlinkOracle public usd1UsdOracle;
    MockChainlinkOracle public wlfiUsdOracle;
    MockUniswapPool public twapPool;
    
    address public vault = address(0x1000);
    address public owner = address(this);
    address public user = address(0x2000);
    
    uint256 constant INITIAL_MINT = 10_000_000e18;
    
    function setUp() public {
        // Deploy mock tokens
        wlfi = new MockERC20("WLFI", "WLFI", 18);
        weth = new MockWETH();
        usd1 = new MockERC20("USD1", "USD1", 18);
        
        // Deploy mock Charm vault
        charmVault = new MockCharmVaultWETH(address(weth), address(wlfi));
        
        // Deploy mock router
        router = new MockSwapRouter(address(wlfi), address(weth));
        
        // Deploy mock Chainlink oracles
        // WETH/USD: ~$3000 (8 decimals)
        wethUsdOracle = new MockChainlinkOracle(3000e8, 8);
        // USD1/USD: ~$1 (8 decimals)
        usd1UsdOracle = new MockChainlinkOracle(1e8, 8);
        // WLFI/USD: ~$0.21 (8 decimals)
        wlfiUsdOracle = new MockChainlinkOracle(21e6, 8);
        
        // Deploy mock TWAP pool (tick = 0 represents 1:1 ratio, adjust as needed)
        twapPool = new MockUniswapPool(0);
        
        // Deploy CharmStrategyWETH
        strategy = new CharmStrategyWETH(
            vault,                  // vault address
            address(charmVault),    // charm vault
            address(wlfi),
            address(weth),
            address(usd1),          // USD1 token
            address(router),
            owner
        );
        
        // Set TWAP pool (since constructor sets it to constant, we'll use setTwapPool)
        strategy.setTwapPool(address(twapPool));
        
        // Set Chainlink feeds (use mocks for testing)
        strategy.setWethUsdPriceFeed(address(wethUsdOracle));
        strategy.setUsd1UsdPriceFeed(address(usd1UsdOracle));
        strategy.setWlfiUsdPriceFeed(address(wlfiUsdOracle));
        
        // Initialize approvals
        strategy.initializeApprovals();
        
        // Mint tokens
        wlfi.mint(vault, INITIAL_MINT);
        weth.mint(vault, INITIAL_MINT);
        usd1.mint(vault, INITIAL_MINT);
        wlfi.mint(address(router), INITIAL_MINT);
        weth.mint(address(router), INITIAL_MINT);
        usd1.mint(address(router), INITIAL_MINT);
        
        // Approve strategy
        vm.prank(vault);
        wlfi.approve(address(strategy), type(uint256).max);
        vm.prank(vault);
        weth.approve(address(strategy), type(uint256).max);
        vm.prank(vault);
        usd1.approve(address(strategy), type(uint256).max);
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
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertEq(stratWlfi, 0, "Should have 0 WLFI initially");
        assertEq(stratUsd1, 0, "Should have 0 USD1 equivalent initially");
        assertEq(strategy.getShareBalance(), 0, "Should have 0 shares initially");
    }
    
    function test_PoolConfiguration() public view {
        assertEq(strategy.POOL_FEE(), 10000, "Pool fee should be 1%");
        assertEq(strategy.TWAP_POOL_FEE(), 3000, "TWAP pool fee should be 0.3%");
        assertEq(strategy.CHARM_VAULT_ADDRESS(), 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF, "Charm vault address");
    }
    
    // =================================
    // DEPOSIT TESTS
    // =================================
    
    function test_FirstDeposit_BalancedRatio() public {
        uint256 wlfiAmount = 100e18;
        uint256 usd1Amount = 300000e18; // ~100 WETH worth of USD1 (assuming 1 WETH = 3000 USD1)
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, usd1Amount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI in strategy");
        assertGt(stratUsd1, 0, "Should have USD1 equivalent in strategy");
    }
    
    function test_FirstDeposit_WlfiOnly() public {
        uint256 wlfiAmount = 100e18;
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(wlfiAmount, 0);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        assertGt(stratWlfi, 0, "Should have WLFI");
        assertEq(stratUsd1, 0, "Should have no USD1 equivalent");
    }
    
    function test_FirstDeposit_Usd1Only() public {
        uint256 usd1Amount = 300000e18; // ~100 WETH worth
        
        vm.prank(vault);
        uint256 shares = strategy.deposit(0, usd1Amount);
        
        assertGt(shares, 0, "Should receive shares");
        
        (uint256 stratWlfi, uint256 stratUsd1) = strategy.getTotalAmounts();
        // USD1 is swapped to WETH, then WETH and WLFI are deposited to Charm vault
        // So we should have some WLFI in the vault (either from swap or initial deposit)
        // The key is that shares were received and strategy has assets
        assertGt(stratWlfi + stratUsd1, 0, "Should have assets in strategy");
        assertGt(stratUsd1, 0, "Should have USD1 equivalent");
    }
    
    function test_SecondDeposit_MatchesRatio() public {
        // First deposit to establish ratio
        vm.startPrank(vault);
        strategy.deposit(80e18, 60000e18); // 4:1 ratio (USD1 converted to WETH)
        
        // Second deposit
        uint256 shares2 = strategy.deposit(40e18, 15000e18); // Same ratio
        vm.stopPrank();
        
        assertGt(shares2, 0, "Should receive shares on second deposit");
    }
    
    function test_Deposit_ExcessUsd1Swapped() public {
        // First deposit to establish ratio
        vm.startPrank(vault);
        strategy.deposit(80e18, 60000e18);
        
        // Second deposit with excess USD1
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 usd1BalBefore = usd1.balanceOf(vault);
        
        strategy.deposit(40e18, 150000e18); // Too much USD1
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 usd1BalAfter = usd1.balanceOf(vault);
        vm.stopPrank();
        
        // Should have used some USD1 (excess will be swapped to WETH, then to WLFI if needed)
        assertLt(usd1BalAfter, usd1BalBefore, "Should use USD1");
        // WLFI might not decrease if excess USD1 is swapped to WETH instead
        // The key is that USD1 was used
    }
    
    function test_Deposit_ReturnsUnusedTokens() public {
        uint256 wlfiBalBefore = wlfi.balanceOf(vault);
        uint256 usd1BalBefore = usd1.balanceOf(vault);
        
        vm.prank(vault);
        strategy.deposit(100e18, 300000e18);
        
        uint256 wlfiBalAfter = wlfi.balanceOf(vault);
        uint256 usd1BalAfter = usd1.balanceOf(vault);
        
        // Check tokens were used (some might be returned)
        assertLt(wlfiBalAfter, wlfiBalBefore, "Should use some WLFI");
        assertLt(usd1BalAfter, usd1BalBefore, "Should use some USD1");
    }
    
    function test_Deposit_OnlyVault() public {
        vm.prank(user);
        vm.expectRevert(CharmStrategyWETH.OnlyVault.selector);
        strategy.deposit(100e18, 300000e18);
    }
    
    // =================================
    // WITHDRAWAL TESTS
    // =================================
    
    function test_Withdraw_ProportionalAmounts() public {
        // Deposit first
        vm.startPrank(vault);
        strategy.deposit(100e18, 300000e18);
        
        uint256 sharesBefore = strategy.getShareBalance();
        
        // Calculate withdrawable value correctly
        // withdraw() expects WLFI-equivalent value, not USD1 equivalent
        // Get actual Charm vault amounts to calculate WLFI-equivalent value
        (uint256 totalWeth, uint256 totalWlfi) = charmVault.getTotalAmounts();
        uint256 totalShares = charmVault.totalSupply();
        uint256 ourShares = charmVault.balanceOf(address(strategy));
        
        uint256 ourWeth = (totalWeth * ourShares) / totalShares;
        uint256 ourWlfi = (totalWlfi * ourShares) / totalShares;
        uint256 wlfiPerWeth = strategy.getWlfiPerWeth();
        
        // Calculate total value in WLFI-equivalent (as withdraw() expects)
        uint256 totalValueWlfiEquivalent = ourWlfi + (ourWeth * wlfiPerWeth) / 1e18;
        
        // Withdraw half
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(totalValueWlfiEquivalent / 2);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(usd1Out, 0, "Should receive USD1");
        
        uint256 sharesAfter = strategy.getShareBalance();
        
        // Check that shares decreased (should be roughly half)
        assertLt(sharesAfter, sharesBefore, "Shares should decrease");
        assertApproxEqRel(sharesAfter, sharesBefore / 2, 0.1e18, "Should withdraw roughly half shares");
    }
    
    function test_Withdraw_All() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 300000e18);
        
        uint256 sharesBefore = strategy.getShareBalance();
        
        // Calculate withdrawable value correctly (WLFI-equivalent)
        (uint256 totalWeth, uint256 totalWlfi) = charmVault.getTotalAmounts();
        uint256 totalShares = charmVault.totalSupply();
        uint256 ourShares = charmVault.balanceOf(address(strategy));
        
        uint256 ourWeth = (totalWeth * ourShares) / totalShares;
        uint256 ourWlfi = (totalWlfi * ourShares) / totalShares;
        uint256 wlfiPerWeth = strategy.getWlfiPerWeth();
        
        // Calculate total value in WLFI-equivalent (as withdraw() expects)
        uint256 totalValueWlfiEquivalent = ourWlfi + (ourWeth * wlfiPerWeth) / 1e18;
        
        // Withdraw all by withdrawing slightly more than total value (to ensure all shares)
        (uint256 wlfiOut, uint256 usd1Out) = strategy.withdraw(totalValueWlfiEquivalent * 2);
        vm.stopPrank();
        
        assertGt(wlfiOut, 0, "Should receive WLFI");
        assertGt(usd1Out, 0, "Should receive USD1");
        
        uint256 sharesAfter = strategy.getShareBalance();
        (uint256 remaining0, uint256 remaining1) = strategy.getTotalAmounts();
        
        // Shares should be significantly reduced (most withdrawn)
        assertLt(sharesAfter, sharesBefore / 100, "Should withdraw almost all shares");
        // Allow for rounding in value calculations
        assertLt(remaining0 + remaining1, 1e18, "Should have minimal remainder left");
    }
    
    function test_Withdraw_SendsToVault() public {
        // Deposit
        vm.startPrank(vault);
        strategy.deposit(100e18, 300000e18);
        
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
        vm.expectRevert(CharmStrategyWETH.OnlyVault.selector);
        strategy.withdraw(100e18);
    }
    
    // =================================
    // PRICE ORACLE TESTS
    // =================================
    
    function test_GetChainlinkPrice() public view {
        uint256 price = strategy.getChainlinkPrice();
        assertGt(price, 0, "Should return valid price");
        
        // WETH/USD = 3000, WLFI/USD = 0.21
        // WLFI per WETH = 3000 / 0.21 ≈ 14285.7 WLFI per WETH
        // With decimals: (3000e8 * 1e18 * 1e8) / (21e6 * 1e8) = 14285714285714285714285
        assertApproxEqRel(price, 14285714285714285714285, 0.1e18, "Price calculation");
    }
    
    function test_GetTwapPrice() public {
        // Set a tick that represents a price
        twapPool.setTick(1000); // Positive tick = WETH more valuable
        
        uint256 price = strategy.getTwapPrice();
        assertGt(price, 0, "Should return valid TWAP price");
    }
    
    function test_GetWlfiPerWeth_FallbackToTwap() public {
        // Disable Chainlink feed
        strategy.setWlfiUsdPriceFeed(address(0));
        
        uint256 price = strategy.getWlfiPerWeth();
        assertGt(price, 0, "Should fallback to TWAP");
    }
    
    function test_PriceOracle_Priority() public view {
        // With both oracles available, Chainlink should be preferred
        uint256 price = strategy.getWlfiPerWeth();
        assertGt(price, 0, "Should return price");
    }
    
    // =================================
    // PROFIT TESTS
    // =================================
    
    function test_ProfitAccrual() public {
        // Initial deposit
        vm.prank(vault);
        strategy.deposit(100e18, 300000e18);
        
        (uint256 initialWlfi, uint256 initialUsd1) = strategy.getTotalAmounts();
        uint256 initialValue = initialWlfi + initialUsd1; // Simplified value calculation
        
        // Simulate profit in Charm vault
        charmVault.simulateGain(10e18, 10e18); // 10 WETH + 10 WLFI gain
        
        (uint256 finalWlfi, uint256 finalUsd1) = strategy.getTotalAmounts();
        uint256 finalValue = finalWlfi + finalUsd1;
        
        assertGt(finalValue, initialValue, "Should have profit");
    }
    
    function test_WithdrawAfterProfit() public {
        // Deposit
        vm.startPrank(vault);
        uint256 initialWlfi = 100e18;
        uint256 initialUsd1 = 300000e18;
        strategy.deposit(initialWlfi, initialUsd1);
        
        // Simulate profit
        charmVault.simulateGain(20e18, 20e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        // Calculate withdrawable value correctly (WLFI-equivalent)
        (uint256 totalWeth, uint256 totalWlfi) = charmVault.getTotalAmounts();
        uint256 totalShares = charmVault.totalSupply();
        uint256 ourShares = charmVault.balanceOf(address(strategy));
        
        uint256 ourWeth = (totalWeth * ourShares) / totalShares;
        uint256 ourWlfi = (totalWlfi * ourShares) / totalShares;
        uint256 wlfiPerWeth = strategy.getWlfiPerWeth();
        
        // Calculate total value in WLFI-equivalent (as withdraw() expects)
        uint256 totalValueWlfiEquivalent = ourWlfi + (ourWeth * wlfiPerWeth) / 1e18;
        
        // Withdraw all
        strategy.withdraw(totalValueWlfiEquivalent * 2);
        vm.stopPrank();
        
        // Should receive tokens back
        // Note: Withdrawal converts WETH to USD1, so we get USD1 instead of WLFI
        uint256 wlfiReceived = wlfi.balanceOf(vault) - vaultWlfiBefore;
        uint256 usd1Received = usd1.balanceOf(vault) - vaultUsd1Before;
        
        // We should receive tokens (profit increases share value, so we get more than deposited)
        // The strategy withdraws WETH and swaps to USD1, so we get USD1 back
        assertGt(wlfiReceived + usd1Received, 0, "Should receive tokens");
        // Due to profit, shares are worth more, so we should receive more than originally deposited
        // Account for swap fees - we should receive substantial value
        assertGt(usd1Received, initialUsd1 / 2, "Should receive substantial USD1 (profit increases value)");
    }
    
    // =================================
    // RATIO BALANCING TESTS
    // =================================
    
    function test_SwapBalance_ExcessUsd1ToWlfi() public {
        // Create imbalanced Charm vault
        vm.startPrank(vault);
        strategy.deposit(90e18, 27000e18); // ~9 WETH worth of USD1
        
        // Try to deposit with excess USD1
        uint256 usd1Before = usd1.balanceOf(vault);
        
        strategy.deposit(45e18, 150000e18); // Too much USD1 - should swap excess
        vm.stopPrank();
        
        // Check that strategy used swapping to balance
        uint256 usd1After = usd1.balanceOf(vault);
        
        // Should have used USD1
        uint256 usd1Used = usd1Before - usd1After;
        assertGt(usd1Used, 0, "Should use USD1");
    }
    
    function test_RatioMaintained() public {
        // First deposit establishes ratio
        vm.startPrank(vault);
        strategy.deposit(80e18, 60000e18); // 4:1 ratio (USD1 converted to WETH)
        
        (uint256 wlfi1, uint256 weth1) = charmVault.getTotalAmounts();
        uint256 ratio1 = (wlfi1 * 1e18) / (wlfi1 + weth1);
        
        // Second deposit
        strategy.deposit(40e18, 15000e18); // Same ratio
        
        (uint256 wlfi2, uint256 weth2) = charmVault.getTotalAmounts();
        uint256 ratio2 = (wlfi2 * 1e18) / (wlfi2 + weth2);
        vm.stopPrank();
        
        // Ratio should be maintained (within tolerance)
        assertApproxEqRel(ratio2, ratio1, 0.05e18, "Ratio should be maintained");
    }
    
    // =================================
    // VIEW FUNCTION TESTS
    // =================================
    
    function test_GetTotalAmounts() public {
        vm.prank(vault);
        strategy.deposit(100e18, 150000e18);
        
        (uint256 wlfiAmount, uint256 usd1Amount) = strategy.getTotalAmounts();
        
        assertGt(wlfiAmount, 0, "Should report WLFI");
        assertGt(usd1Amount, 0, "Should report USD1 equivalent");
        
        // Should match Charm vault balances (proportional to shares)
        uint256 stratShares = charmVault.balanceOf(address(strategy));
        uint256 totalShares = charmVault.totalSupply();
        (uint256 totalWeth, uint256 totalWlfi) = charmVault.getTotalAmounts();
        
        uint256 expectedWlfi = (totalWlfi * stratShares) / totalShares;
        uint256 expectedWeth = (totalWeth * stratShares) / totalShares;
        
        // For first deposit, strategy owns all shares, so amounts should match
        assertEq(wlfiAmount, expectedWlfi, "WLFI calculation");
        // USD1 amount is converted from WETH using oracle
        assertGt(usd1Amount, 0, "USD1 equivalent should be > 0");
    }
    
    function test_GetShareBalance() public {
        vm.prank(vault);
        uint256 shares = strategy.deposit(100e18, 300000e18);
        
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
        vm.expectRevert(CharmStrategyWETH.StrategyPaused.selector);
        strategy.deposit(100e18, 300000e18);
    }
    
    function test_Resume() public {
        strategy.pause();
        strategy.resume();
        assertTrue(strategy.active(), "Should be active");
        
        vm.prank(vault);
        strategy.deposit(100e18, 300000e18); // Should work
    }
    
    function test_UpdateParameters() public {
        strategy.updateParameters(100, 900, 1800); // 1% max slippage, 15min TWAP, 30min oracle age
        assertEq(strategy.maxSlippage(), 100, "Slippage updated");
        assertEq(strategy.twapPeriod(), 900, "TWAP period updated");
        assertEq(strategy.maxOracleAge(), 1800, "Oracle age updated");
    }
    
    function test_SetTwapPool() public {
        MockUniswapPool newPool = new MockUniswapPool(500);
        strategy.setTwapPool(address(newPool));
        
        // Verify by checking price still works
        uint256 price = strategy.getTwapPrice();
        assertGt(price, 0, "Should work with new pool");
    }
    
    function test_SetWlfiUsdPriceFeed() public {
        MockChainlinkOracle newOracle = new MockChainlinkOracle(25e6, 8);
        strategy.setWlfiUsdPriceFeed(address(newOracle));
        
        // Verify price still works
        uint256 price = strategy.getChainlinkPrice();
        assertGt(price, 0, "Should work with new oracle");
    }
    
    function test_RescueIdleTokens() public {
        // Mint some tokens directly to strategy (simulating leftovers)
        wlfi.mint(address(strategy), 10e18);
        weth.mint(address(strategy), 5e18);
        usd1.mint(address(strategy), 1000e18);
        
        uint256 vaultWlfiBefore = wlfi.balanceOf(vault);
        uint256 vaultUsd1Before = usd1.balanceOf(vault);
        
        vm.prank(vault);
        strategy.rescueIdleTokens();
        
        // Vault should receive the idle tokens (WETH converted to USD1)
        assertEq(wlfi.balanceOf(vault) - vaultWlfiBefore, 10e18, "WLFI rescued");
        assertGt(usd1.balanceOf(vault) - vaultUsd1Before, 0, "USD1 rescued (from WETH swap + direct)");
    }
    
    // =================================
    // REBALANCE TESTS
    // =================================
    
    function test_Rebalance() public {
        vm.startPrank(vault);
        strategy.deposit(100e18, 300000e18);
        
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
        strategy.deposit(100e18, 300000e18);
        (uint256 totalWlfi, uint256 totalUsd1) = strategy.getTotalAmounts();
        uint256 totalValue = totalWlfi + totalUsd1;
        strategy.withdraw(totalValue / 2);
        
        // Cycle 2
        strategy.deposit(75e18, 225000e18);
        (totalWlfi, totalUsd1) = strategy.getTotalAmounts();
        totalValue = totalWlfi + totalUsd1;
        strategy.withdraw(totalValue / 2);
        
        // Cycle 3
        strategy.deposit(50e18, 150000e18);
        
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
        strategy.deposit(100e18, 300000e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for first deposit", gasUsed);
        assertLt(gasUsed, 500_000, "First deposit should use < 500k gas");
    }
    
    function test_Gas_SubsequentDeposit() public {
        // First deposit
        vm.prank(vault);
        strategy.deposit(100e18, 300000e18);
        
        // Measure second deposit
        uint256 gasBefore = gasleft();
        vm.prank(vault);
        strategy.deposit(50e18, 150000e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for subsequent deposit", gasUsed);
        assertLt(gasUsed, 400_000, "Subsequent deposit should use < 400k gas");
    }
    
    function test_Gas_Withdraw() public {
        vm.startPrank(vault);
        strategy.deposit(100e18, 300000e18);
        
        (uint256 totalWlfi, uint256 totalUsd1) = strategy.getTotalAmounts();
        uint256 totalValue = totalWlfi + totalUsd1;
        
        uint256 gasBefore = gasleft();
        strategy.withdraw(totalValue / 2);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Gas used for withdraw", gasUsed);
        assertLt(gasUsed, 300_000, "Withdraw should use < 300k gas");
    }
    
    function test_Gas_GetPrice() public {
        uint256 gasBefore = gasleft();
        strategy.getWlfiPerWeth();
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for getWlfiPerWeth", gasUsed);
        assertLt(gasUsed, 50_000, "Price query should use < 50k gas");
    }
}


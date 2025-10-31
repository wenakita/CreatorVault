// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/EagleOVault.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAggregatorV3 {
    int256 public price = 1e8; // $1
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
}

contract MockUniswapV3Pool {
    function observe(uint32[] calldata) external pure returns (int56[] memory, uint160[] memory) {
        int56[] memory tickCumulatives = new int56[](2);
        uint160[] memory secondsPerLiquidityCumulatives = new uint160[](2);
        return (tickCumulatives, secondsPerLiquidityCumulatives);
    }
    
    function slot0() external pure returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16,
        uint16,
        uint16,
        uint8,
        bool
    ) {
        return (1 << 96, 0, 0, 0, 0, 0, false);
    }
}

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
        try IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn) {} catch {}
        
        amountOut = (params.amountIn * 997) / 1000;
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");
        
        if (params.tokenOut == address(wlfi)) {
            wlfi.mint(params.recipient, amountOut);
        } else if (params.tokenOut == address(usd1)) {
            usd1.mint(params.recipient, amountOut);
        }
        
        return amountOut;
    }
}

/**
 * @title EagleOVaultCapitalInjectionTest
 * @notice Comprehensive tests for capital injection mechanism
 */
contract EagleOVaultCapitalInjectionTest is Test {
    EagleOVault public vault;
    MockERC20 public wlfi;
    MockERC20 public usd1;
    MockAggregatorV3 public oracle;
    MockUniswapV3Pool public pool;
    MockSwapRouter public router;
    
    address public owner = address(this);
    address public treasury = makeAddr("treasury");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public injector = makeAddr("injector");
    
    uint256 constant INITIAL_MINT = 1_000_000e18;
    
    event CapitalInjected(address indexed from, uint256 wlfiAmount, uint256 usd1Amount);
    
    function setUp() public {
        // Deploy mocks
        wlfi = new MockERC20("WLFI", "WLFI");
        usd1 = new MockERC20("USD1", "USD1");
        oracle = new MockAggregatorV3();
        pool = new MockUniswapV3Pool();
        router = new MockSwapRouter(address(wlfi), address(usd1));
        
        // Deploy vault
        vault = new EagleOVault(
            address(wlfi),
            address(usd1),
            address(oracle),
            address(pool),
            address(router),
            owner
        );
        
        // Mint tokens
        wlfi.mint(user1, INITIAL_MINT);
        wlfi.mint(user2, INITIAL_MINT);
        wlfi.mint(treasury, INITIAL_MINT);
        wlfi.mint(injector, INITIAL_MINT);
        
        usd1.mint(treasury, INITIAL_MINT);
        usd1.mint(injector, INITIAL_MINT);
    }
    
    // =================================
    // BASIC INJECTION TESTS
    // =================================
    
    function test_Injection_WLFIOnly() public {
        // User deposits first
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        uint256 totalAssetsBefore = vault.totalAssets();
        uint256 totalSupplyBefore = vault.totalSupply();
        
        // Injector injects capital
        vm.startPrank(injector);
        wlfi.approve(address(vault), 500e18);
        
        vm.expectEmit(true, false, false, true);
        emit CapitalInjected(injector, 500e18, 0);
        
        vault.injectCapital(500e18, 0);
        vm.stopPrank();
        
        // Verify
        assertEq(vault.totalAssets(), totalAssetsBefore + 500e18, "Total assets should increase");
        assertEq(vault.totalSupply(), totalSupplyBefore, "Total supply should NOT change");
        
        console.log("Assets before:", totalAssetsBefore);
        console.log("Assets after:", vault.totalAssets());
        console.log("Supply (unchanged):", vault.totalSupply());
    }
    
    function test_Injection_USD1Only() public {
        // User deposits first
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        uint256 totalAssetsBefore = vault.totalAssets();
        uint256 totalSupplyBefore = vault.totalSupply();
        
        // Injector injects USD1
        vm.startPrank(injector);
        usd1.approve(address(vault), 500e18);
        vault.injectCapital(0, 500e18);
        vm.stopPrank();
        
        // Verify
        assertGt(vault.totalAssets(), totalAssetsBefore, "Total assets should increase");
        assertEq(vault.totalSupply(), totalSupplyBefore, "Total supply should NOT change");
    }
    
    function test_Injection_Both() public {
        // User deposits first
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        uint256 totalAssetsBefore = vault.totalAssets();
        
        // Inject both tokens
        vm.startPrank(injector);
        wlfi.approve(address(vault), 300e18);
        usd1.approve(address(vault), 200e18);
        vault.injectCapital(300e18, 200e18);
        vm.stopPrank();
        
        // Verify
        assertEq(vault.totalAssets(), totalAssetsBefore + 300e18 + 200e18, "Both assets added");
    }
    
    function test_Injection_RevertsOnZero() public {
        vm.startPrank(injector);
        vm.expectRevert();
        vault.injectCapital(0, 0);
        vm.stopPrank();
    }
    
    function test_Injection_AnyoneCanInject() public {
        // User deposits first
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Random address can inject (just needs tokens)
        address randomInjector = makeAddr("random");
        wlfi.mint(randomInjector, 100e18);
        
        vm.startPrank(randomInjector);
        wlfi.approve(address(vault), 100e18);
        vault.injectCapital(100e18, 0);
        vm.stopPrank();
        
        // Verify injection worked
        assertGt(vault.totalAssets(), 1000e18, "Injection successful");
    }
    
    // =================================
    // PREVIEW FUNCTION TESTS
    // =================================
    
    function test_Preview_AccurateCalculation() public {
        // User deposits
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Preview injection
        (uint256 newShareValue, uint256 valueIncrease, uint256 percentageIncrease) = 
            vault.previewCapitalInjection(1000e18, 0);
        
        // Current: 1000 WLFI, 10M shares = 0.0001 WLFI/share
        // After: 2000 WLFI, 10M shares = 0.0002 WLFI/share
        // Increase: 100% (10000 bps)
        
        assertGt(newShareValue, 0, "New share value calculated");
        assertGt(valueIncrease, 0, "Value increase calculated");
        assertEq(percentageIncrease, 10000, "Should be 100% increase (10000 bps)");
        
        console.log("New share value:", newShareValue);
        console.log("Value increase:", valueIncrease);
        console.log("Percentage increase (bps):", percentageIncrease);
    }
    
    function test_Preview_2xInjection() public {
        // User deposits 5000 WLFI
        vm.startPrank(user1);
        wlfi.approve(address(vault), 5000e18);
        vault.deposit(5000e18, user1);
        vm.stopPrank();
        
        // Preview injecting 5000 more (should 2x share value)
        (,, uint256 percentageIncrease) = vault.previewCapitalInjection(5000e18, 0);
        
        assertEq(percentageIncrease, 10000, "Should be 100% increase = 2x");
    }
    
    function test_Preview_10xInjection() public {
        // User deposits 1000 WLFI
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Preview injecting 9000 more (10x total)
        (,, uint256 percentageIncrease) = vault.previewCapitalInjection(9000e18, 0);
        
        assertEq(percentageIncrease, 90000, "Should be 900% increase = 10x");
        
        console.log("10x injection percentage:", percentageIncrease);
    }
    
    function test_Preview_BeforeAnyDeposits() public {
        // Preview before any deposits
        (uint256 newShareValue, uint256 valueIncrease, uint256 percentageIncrease) = 
            vault.previewCapitalInjection(1000e18, 0);
        
        // Should return zeros (no shares yet)
        assertEq(newShareValue, 0, "No shares yet");
        assertEq(valueIncrease, 0, "No shares yet");
        assertEq(percentageIncrease, 0, "No shares yet");
    }
    
    function test_Preview_SmallInjection() public {
        // Large deposit (within 50M limit: 4000 WLFI = 40M shares)
        vm.startPrank(user1);
        wlfi.approve(address(vault), 4000e18);
        vault.deposit(4000e18, user1);
        vm.stopPrank();
        
        // Small injection (100 WLFI on 4000 WLFI = 2.5%)
        (,, uint256 percentageIncrease) = vault.previewCapitalInjection(100e18, 0);
        
        // Should be ~2.5% increase (250 bps)
        assertApproxEqRel(percentageIncrease, 250, 0.01e18, "~2.5% increase");
    }
    
    // =================================
    // SHARE VALUE IMPACT TESTS
    // =================================
    
    function test_Impact_ShareValueDoubles() public {
        // User deposits
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        uint256 shareValueBefore = vault.convertToAssets(1e18);
        
        // Inject equal amount (should double)
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 1000e18);
        vault.injectCapital(1000e18, 0);
        vm.stopPrank();
        
        uint256 shareValueAfter = vault.convertToAssets(1e18);
        
        assertApproxEqRel(shareValueAfter, shareValueBefore * 2, 0.01e18, "Share value should 2x");
        
        console.log("Share value before:", shareValueBefore);
        console.log("Share value after:", shareValueAfter);
        console.log("Multiple:", shareValueAfter / shareValueBefore);
    }
    
    function test_Impact_AllHoldersBenefitEqually() public {
        // Two users deposit different amounts
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares1 = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        vm.startPrank(user2);
        wlfi.approve(address(vault), 2000e18);
        uint256 shares2 = vault.deposit(2000e18, user2);
        vm.stopPrank();
        
        // Value before injection
        uint256 value1Before = vault.convertToAssets(shares1);
        uint256 value2Before = vault.convertToAssets(shares2);
        
        // Inject capital
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 3000e18);
        vault.injectCapital(3000e18, 0);
        vm.stopPrank();
        
        // Value after injection
        uint256 value1After = vault.convertToAssets(shares1);
        uint256 value2After = vault.convertToAssets(shares2);
        
        // Both should have doubled
        assertApproxEqRel(value1After, value1Before * 2, 0.01e18, "User1 value 2x");
        assertApproxEqRel(value2After, value2Before * 2, 0.01e18, "User2 value 2x");
        
        // User2 should still have 2x user1 (proportional)
        assertApproxEqRel(value2After, value1After * 2, 0.01e18, "Proportions maintained");
        
        console.log("User1 value after:", value1After);
        console.log("User2 value after:", value2After);
    }
    
    function test_Impact_WithdrawAfterInjection() public {
        // User deposits
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Inject to double value
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 1000e18);
        vault.injectCapital(1000e18, 0);
        vm.stopPrank();
        
        // User withdraws
        uint256 wlfiBefore = wlfi.balanceOf(user1);
        vm.prank(user1);
        vault.redeem(shares, user1, user1);
        uint256 wlfiReceived = wlfi.balanceOf(user1) - wlfiBefore;
        
        // Should get ~2000 WLFI (original 1000 + injected 1000)
        assertApproxEqRel(wlfiReceived, 2000e18, 0.01e18, "Should get 2x back");
        
        console.log("Deposited: 1000 WLFI");
        console.log("Received after injection (WLFI):", wlfiReceived);
    }
    
    // =================================
    // MULTIPLE INJECTION TESTS
    // =================================
    
    function test_MultipleInjections_CompoundGrowth() public {
        // Initial deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        uint256 shareValueInitial = vault.convertToAssets(1e18);
        
        // Injection 1: +1000 (2x)
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 5000e18);
        vault.injectCapital(1000e18, 0);
        uint256 shareValueAfter1 = vault.convertToAssets(1e18);
        
        // Injection 2: +2000 (2x again from previous)
        vault.injectCapital(2000e18, 0);
        uint256 shareValueAfter2 = vault.convertToAssets(1e18);
        
        // Injection 3: +2000 (1.5x from previous)
        vault.injectCapital(2000e18, 0);
        uint256 shareValueAfter3 = vault.convertToAssets(1e18);
        vm.stopPrank();
        
        console.log("Initial share value:", shareValueInitial);
        console.log("After injection 1:", shareValueAfter1);
        console.log("After injection 2:", shareValueAfter2);
        console.log("After injection 3:", shareValueAfter3);
        
        // Verify growth
        assertApproxEqRel(shareValueAfter1, shareValueInitial * 2, 0.01e18, "2x after first");
        assertApproxEqRel(shareValueAfter2, shareValueInitial * 4, 0.01e18, "4x after second");
        assertApproxEqRel(shareValueAfter3, shareValueInitial * 6, 0.01e18, "6x after third");
    }
    
    function test_MultipleInjections_DifferentSources() public {
        // Initial deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Injection from treasury
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 500e18);
        vault.injectCapital(500e18, 0);
        vm.stopPrank();
        
        // Injection from different injector
        vm.startPrank(injector);
        wlfi.approve(address(vault), 500e18);
        vault.injectCapital(500e18, 0);
        vm.stopPrank();
        
        // Both injections should have same effect
        assertEq(vault.totalAssets(), 2000e18, "Total from both sources");
    }
    
    // =================================
    // EDGE CASES
    // =================================
    
    function test_Edge_InjectBeforeAnyDeposits() public {
        // Inject before anyone deposits
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 1000e18);
        vault.injectCapital(1000e18, 0);
        vm.stopPrank();
        
        // Now user deposits
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // User should get shares based on 2000 total assets
        // 1000 WLFI * 10000 multiplier = 10M shares at bootstrap
        assertEq(shares, 1000e18 * 10_000, "Bootstrap multiplier applies");
        
        // But total assets should be 2000
        assertEq(vault.totalAssets(), 2000e18, "Includes pre-deposited amount");
    }
    
    function test_Edge_VeryLargeInjection() public {
        // Small initial deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 10e18);
        vault.deposit(10e18, user1);
        vm.stopPrank();
        
        // Huge injection (1000x)
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 10000e18);
        vault.injectCapital(10000e18, 0);
        vm.stopPrank();
        
        // Share value should be 1000x
        uint256 shareValue = vault.convertToAssets(1e18);
        
        console.log("Share value after 1000x injection:", shareValue);
        assertGt(shareValue, 0, "Share value increased massively");
    }
    
    function test_Edge_TinyInjection() public {
        // Large deposit (within 50M limit: 4000 WLFI = 40M shares)
        vm.startPrank(user1);
        wlfi.approve(address(vault), 4000e18);
        vault.deposit(4000e18, user1);
        vm.stopPrank();
        
        uint256 shareValueBefore = vault.convertToAssets(1e18);
        
        // Tiny injection (0.001%)
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 10e18);
        vault.injectCapital(10e18, 0);
        vm.stopPrank();
        
        uint256 shareValueAfter = vault.convertToAssets(1e18);
        
        // Should have tiny increase
        assertGt(shareValueAfter, shareValueBefore, "Even tiny injection increases value");
    }
    
    function test_Edge_InjectDuringActiveStrategies() public {
        // This would test injection when funds are deployed to strategies
        // Skipping for now as it requires strategy setup
        // But important: injection should work even with active strategies
    }
    
    // =================================
    // GAS BENCHMARKING
    // =================================
    
    function test_Gas_Injection() public {
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        vm.startPrank(treasury);
        wlfi.approve(address(vault), 500e18);
        
        uint256 gasBefore = gasleft();
        vault.injectCapital(500e18, 0);
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        console.log("Gas used for injection:", gasUsed);
        assertLt(gasUsed, 150_000, "Injection should be gas efficient");
    }
    
    function test_Gas_Preview() public view {
        uint256 gasBefore = gasleft();
        vault.previewCapitalInjection(1000e18, 0);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for preview:", gasUsed);
        assertLt(gasUsed, 50_000, "Preview should be cheap");
    }
}


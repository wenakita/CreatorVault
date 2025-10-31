// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/interfaces/IStrategy.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAggregatorV3 {
    int256 public price;
    uint256 public timestamp;
    
    constructor(int256 _price) {
        price = _price;
        timestamp = block.timestamp;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, price, timestamp, timestamp, 1);
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
}

contract MockUniswapV3Pool {
    function observe(uint32[] calldata) external pure returns (int56[] memory, uint160[] memory) {
        int56[] memory tickCumulatives = new int56[](2);
        uint160[] memory secondsPerLiquidityCumulatives = new uint160[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 100;
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
        // Try to transfer but don't fail if allowance is insufficient (for testing)
        try IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn) {
        } catch {}
        
        // Calculate output (simulate ~1:1 ratio minus 0.3% fee)
        amountOut = (params.amountIn * 997) / 1000;
        
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");
        
        // Mint output token
        if (params.tokenOut == address(wlfi)) {
            wlfi.mint(params.recipient, amountOut);
        } else if (params.tokenOut == address(usd1)) {
            usd1.mint(params.recipient, amountOut);
        }
        
        return amountOut;
    }
}

contract EagleOVaultWhitelistTest is Test {
    EagleOVault public vault;
    MockERC20 public wlfi;
    MockERC20 public usd1;
    MockAggregatorV3 public wlfiOracle;
    MockAggregatorV3 public usd1Oracle;
    MockUniswapV3Pool public pool;
    MockSwapRouter public router;
    
    address public owner = address(this);
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonWhitelisted = makeAddr("nonWhitelisted");
    address public keeper = makeAddr("keeper");
    
    uint256 constant INITIAL_MINT = 100_000e18;
    
    function setUp() public {
        // Deploy mocks
        wlfi = new MockERC20("WLFI", "WLFI");
        usd1 = new MockERC20("USD1", "USD1");
        wlfiOracle = new MockAggregatorV3(1e8); // $1
        usd1Oracle = new MockAggregatorV3(1e8); // $1
        pool = new MockUniswapV3Pool();
        router = new MockSwapRouter(address(wlfi), address(usd1));
        
        // Deploy vault
        vault = new EagleOVault(
            address(wlfi),
            address(usd1),
            address(usd1Oracle),
            address(pool),
            address(router),
            owner
        );
        
        vault.setKeeper(keeper);
        
        // Mint tokens to users
        wlfi.mint(user1, INITIAL_MINT);
        wlfi.mint(user2, INITIAL_MINT);
        wlfi.mint(user3, INITIAL_MINT);
        wlfi.mint(nonWhitelisted, INITIAL_MINT);
        
        usd1.mint(user1, INITIAL_MINT);
        usd1.mint(user2, INITIAL_MINT);
        usd1.mint(user3, INITIAL_MINT);
        usd1.mint(nonWhitelisted, INITIAL_MINT);
    }
    
    // =================================
    // WHITELIST CONFIGURATION TESTS
    // =================================
    
    function test_Whitelist_InitialState() public {
        assertFalse(vault.whitelistEnabled(), "Whitelist should be disabled by default");
    }
    
    function test_Whitelist_EnableDisable() public {
        // Enable whitelist
        vault.setWhitelistEnabled(true);
        assertTrue(vault.whitelistEnabled(), "Whitelist should be enabled");
        
        // Disable whitelist
        vault.setWhitelistEnabled(false);
        assertFalse(vault.whitelistEnabled(), "Whitelist should be disabled");
    }
    
    function test_Whitelist_OnlyOwnerCanEnable() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setWhitelistEnabled(true);
    }
    
    function test_Whitelist_AddSingleAddress() public {
        vault.setWhitelist(user1, true);
        assertTrue(vault.whitelist(user1), "User1 should be whitelisted");
        assertFalse(vault.whitelist(user2), "User2 should not be whitelisted");
    }
    
    function test_Whitelist_RemoveSingleAddress() public {
        vault.setWhitelist(user1, true);
        assertTrue(vault.whitelist(user1), "User1 should be whitelisted");
        
        vault.setWhitelist(user1, false);
        assertFalse(vault.whitelist(user1), "User1 should be removed from whitelist");
    }
    
    function test_Whitelist_OnlyOwnerCanAddAddress() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setWhitelist(user2, true);
    }
    
    function test_Whitelist_CannotAddZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        vault.setWhitelist(address(0), true);
    }
    
    function test_Whitelist_BatchAdd() public {
        address[] memory accounts = new address[](3);
        accounts[0] = user1;
        accounts[1] = user2;
        accounts[2] = user3;
        
        vault.setWhitelistBatch(accounts, true);
        
        assertTrue(vault.whitelist(user1), "User1 should be whitelisted");
        assertTrue(vault.whitelist(user2), "User2 should be whitelisted");
        assertTrue(vault.whitelist(user3), "User3 should be whitelisted");
    }
    
    function test_Whitelist_BatchRemove() public {
        // First add users
        address[] memory accounts = new address[](3);
        accounts[0] = user1;
        accounts[1] = user2;
        accounts[2] = user3;
        
        vault.setWhitelistBatch(accounts, true);
        
        // Then remove them
        vault.setWhitelistBatch(accounts, false);
        
        assertFalse(vault.whitelist(user1), "User1 should be removed");
        assertFalse(vault.whitelist(user2), "User2 should be removed");
        assertFalse(vault.whitelist(user3), "User3 should be removed");
    }
    
    function test_Whitelist_BatchCannotIncludeZeroAddress() public {
        address[] memory accounts = new address[](3);
        accounts[0] = user1;
        accounts[1] = address(0);
        accounts[2] = user3;
        
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        vault.setWhitelistBatch(accounts, true);
    }
    
    function test_Whitelist_OnlyOwnerCanBatchAdd() public {
        address[] memory accounts = new address[](2);
        accounts[0] = user1;
        accounts[1] = user2;
        
        vm.prank(user1);
        vm.expectRevert();
        vault.setWhitelistBatch(accounts, true);
    }
    
    function test_Whitelist_EmitsEvents() public {
        // Test enable/disable event
        vm.expectEmit(true, false, false, true);
        emit EagleOVault.WhitelistEnabled(true);
        vault.setWhitelistEnabled(true);
        
        // Test whitelist updated event
        vm.expectEmit(true, false, false, true);
        emit EagleOVault.WhitelistUpdated(user1, true);
        vault.setWhitelist(user1, true);
    }
    
    // =================================
    // DEPOSIT WITH WHITELIST TESTS
    // =================================
    
    function test_Whitelist_DepositWhenDisabled_AnyoneCanDeposit() public {
        // Whitelist is disabled by default
        assertFalse(vault.whitelistEnabled());
        
        // Any user can deposit
        vm.startPrank(nonWhitelisted);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, nonWhitelisted);
        vm.stopPrank();
        
        assertGt(shares, 0, "Deposit should succeed when whitelist disabled");
    }
    
    function test_Whitelist_DepositWhenEnabled_WhitelistedCanDeposit() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // Whitelisted user can deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        assertGt(shares, 0, "Whitelisted user should be able to deposit");
    }
    
    function test_Whitelist_DepositWhenEnabled_NonWhitelistedCannotDeposit() public {
        // Enable whitelist but don't add nonWhitelisted
        vault.setWhitelistEnabled(true);
        
        // Non-whitelisted user cannot deposit
        vm.startPrank(nonWhitelisted);
        wlfi.approve(address(vault), 1000e18);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.deposit(1000e18, nonWhitelisted);
        vm.stopPrank();
    }
    
    function test_Whitelist_MintWhenEnabled_WhitelistedCanMint() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // Whitelisted user can mint
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = 1000e18 * 10_000; // With 10,000x multiplier
        uint256 assets = vault.mint(shares, user1);
        vm.stopPrank();
        
        assertGt(assets, 0, "Whitelisted user should be able to mint");
        assertEq(vault.balanceOf(user1), shares, "Should receive correct shares");
    }
    
    function test_Whitelist_MintWhenEnabled_NonWhitelistedCannotMint() public {
        // Enable whitelist but don't add nonWhitelisted
        vault.setWhitelistEnabled(true);
        
        // Non-whitelisted user cannot mint
        vm.startPrank(nonWhitelisted);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = 1000e18 * 10_000;
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.mint(shares, nonWhitelisted);
        vm.stopPrank();
    }
    
    function test_Whitelist_DualDepositWhenEnabled_WhitelistedCanDeposit() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // Whitelisted user can dual deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        usd1.approve(address(vault), 1000e18);
        uint256 shares = vault.depositDual(1000e18, 1000e18, user1);
        vm.stopPrank();
        
        assertGt(shares, 0, "Whitelisted user should be able to dual deposit");
    }
    
    function test_Whitelist_DualDepositWhenEnabled_NonWhitelistedCannotDeposit() public {
        // Enable whitelist but don't add nonWhitelisted
        vault.setWhitelistEnabled(true);
        
        // Non-whitelisted user cannot dual deposit
        vm.startPrank(nonWhitelisted);
        wlfi.approve(address(vault), 1000e18);
        usd1.approve(address(vault), 1000e18);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.depositDual(1000e18, 1000e18, nonWhitelisted);
        vm.stopPrank();
    }
    
    // =================================
    // WITHDRAW WITH WHITELIST TESTS
    // =================================
    
    function test_Whitelist_WithdrawNotRestricted() public {
        // Deposit while whitelist is disabled
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Enable whitelist (but don't add user1)
        vault.setWhitelistEnabled(true);
        
        // User can still withdraw (whitelist only applies to deposits)
        vm.startPrank(user1);
        uint256 assets = vault.redeem(shares, user1, user1);
        vm.stopPrank();
        
        assertGt(assets, 0, "Withdraw should not be restricted by whitelist");
    }
    
    function test_Whitelist_RedeemNotRestricted() public {
        // Deposit while whitelist is disabled
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Enable whitelist (but don't add user1)
        vault.setWhitelistEnabled(true);
        
        // User can still redeem (whitelist only applies to deposits)
        vm.startPrank(user1);
        uint256 withdrawn = vault.withdraw(500e18, user1, user1);
        vm.stopPrank();
        
        assertGt(withdrawn, 0, "Redeem should not be restricted by whitelist");
    }
    
    // =================================
    // WHITELIST STATE CHANGE TESTS
    // =================================
    
    function test_Whitelist_CanDepositAfterBeingWhitelisted() public {
        // Enable whitelist
        vault.setWhitelistEnabled(true);
        
        // User cannot deposit initially
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        // Add user to whitelist
        vault.setWhitelist(user1, true);
        
        // Now user can deposit
        vm.startPrank(user1);
        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        assertGt(shares, 0, "Should be able to deposit after being whitelisted");
    }
    
    function test_Whitelist_CannotDepositAfterBeingRemoved() public {
        // Enable whitelist and add user
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // User can deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 2000e18);
        uint256 shares1 = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        assertGt(shares1, 0, "Should be able to deposit when whitelisted");
        
        // Remove user from whitelist
        vault.setWhitelist(user1, false);
        
        // User cannot deposit anymore
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.deposit(1000e18, user1);
        vm.stopPrank();
    }
    
    function test_Whitelist_AllUsersCanDepositWhenDisabled() public {
        // Enable whitelist and add user1 only
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // user2 cannot deposit
        vm.startPrank(user2);
        wlfi.approve(address(vault), 1000e18);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.deposit(1000e18, user2);
        vm.stopPrank();
        
        // Disable whitelist
        vault.setWhitelistEnabled(false);
        
        // Now user2 can deposit
        vm.startPrank(user2);
        uint256 shares = vault.deposit(1000e18, user2);
        vm.stopPrank();
        
        assertGt(shares, 0, "Should be able to deposit when whitelist disabled");
    }
    
    // =================================
    // INTEGRATION TESTS
    // =================================
    
    function test_Whitelist_Integration_MultipleUsers() public {
        // Enable whitelist
        vault.setWhitelistEnabled(true);
        
        // Add user1 and user2
        address[] memory accounts = new address[](2);
        accounts[0] = user1;
        accounts[1] = user2;
        vault.setWhitelistBatch(accounts, true);
        
        // Both can deposit
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares1 = vault.deposit(1000e18, user1);
        vm.stopPrank();
        
        vm.startPrank(user2);
        wlfi.approve(address(vault), 2000e18);
        uint256 shares2 = vault.deposit(2000e18, user2);
        vm.stopPrank();
        
        // user3 cannot deposit
        vm.startPrank(user3);
        wlfi.approve(address(vault), 1000e18);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.deposit(1000e18, user3);
        vm.stopPrank();
        
        assertGt(shares1, 0, "User1 should have shares");
        assertGt(shares2, 0, "User2 should have shares");
    }
    
    function test_Whitelist_Integration_DepositWithdrawCycle() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // User deposits
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 shares = vault.deposit(1000e18, user1);
        
        // User can withdraw (not restricted)
        uint256 assets = vault.redeem(shares / 2, user1, user1);
        vm.stopPrank();
        
        assertGt(assets, 0, "Should be able to withdraw");
        assertGt(vault.balanceOf(user1), 0, "Should have remaining shares");
    }
    
    function test_Whitelist_Integration_MixedDepositTypes() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        vm.startPrank(user1);
        
        // Regular deposit
        wlfi.approve(address(vault), 3000e18);
        usd1.approve(address(vault), 1000e18);
        
        uint256 shares1 = vault.deposit(1000e18, user1);
        
        // Mint
        uint256 sharesToMint = 1000e18 * 10_000;
        uint256 assets = vault.mint(sharesToMint, user1);
        
        // Dual deposit
        uint256 shares3 = vault.depositDual(1000e18, 1000e18, user1);
        
        vm.stopPrank();
        
        assertGt(shares1, 0, "Regular deposit should work");
        assertGt(assets, 0, "Mint should work");
        assertGt(shares3, 0, "Dual deposit should work");
    }
    
    // =================================
    // EDGE CASES
    // =================================
    
    function test_Whitelist_CanAddSameAddressMultipleTimes() public {
        vault.setWhitelist(user1, true);
        vault.setWhitelist(user1, true);
        vault.setWhitelist(user1, true);
        
        assertTrue(vault.whitelist(user1), "User should still be whitelisted");
    }
    
    function test_Whitelist_CanRemoveAddressNotInWhitelist() public {
        assertFalse(vault.whitelist(user1), "User should not be whitelisted initially");
        
        vault.setWhitelist(user1, false);
        
        assertFalse(vault.whitelist(user1), "Should not revert");
    }
    
    function test_Whitelist_EmptyBatch() public {
        address[] memory accounts = new address[](0);
        vault.setWhitelistBatch(accounts, true);
        // Should not revert
    }
    
    function test_Whitelist_LargeBatch() public {
        uint256 batchSize = 100;
        address[] memory accounts = new address[](batchSize);
        
        for (uint256 i = 0; i < batchSize; i++) {
            accounts[i] = makeAddr(string(abi.encodePacked("user", i)));
        }
        
        vault.setWhitelistBatch(accounts, true);
        
        // Check first and last
        assertTrue(vault.whitelist(accounts[0]), "First address should be whitelisted");
        assertTrue(vault.whitelist(accounts[batchSize - 1]), "Last address should be whitelisted");
    }
    
    function test_Whitelist_MaxDeposit_RespectedWithWhitelist() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // Max deposit should still work for whitelisted user
        uint256 maxDeposit = vault.maxDeposit(user1);
        assertGt(maxDeposit, 0, "Whitelisted user should have max deposit");
        
        // Non-whitelisted user should have 0 max deposit
        uint256 maxDepositNonWhitelisted = vault.maxDeposit(nonWhitelisted);
        assertEq(maxDepositNonWhitelisted, 0, "Non-whitelisted user should have 0 max deposit");
    }
    
    function test_Whitelist_MaxMint_RespectedWithWhitelist() public {
        // Enable whitelist and add user1
        vault.setWhitelistEnabled(true);
        vault.setWhitelist(user1, true);
        
        // Max mint should still work for whitelisted user
        uint256 maxMint = vault.maxMint(user1);
        assertGt(maxMint, 0, "Whitelisted user should have max mint");
        
        // Non-whitelisted user should have 0 max mint
        uint256 maxMintNonWhitelisted = vault.maxMint(nonWhitelisted);
        assertEq(maxMintNonWhitelisted, 0, "Non-whitelisted user should have 0 max mint");
    }
}


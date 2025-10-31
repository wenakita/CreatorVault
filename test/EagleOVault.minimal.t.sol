// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/EagleOVault.sol";

// Minimal test that avoids problematic dependencies
contract EagleOVaultMinimalTest is Test {
    EagleOVault public vault;
    MockERC20 public wlfi;
    MockERC20 public usd1;
    MockAggregatorV3 public priceFeed;

    address public owner = address(this);
    address public user1 = address(0x1000);

    function setUp() public {
        // Deploy minimal mock tokens
        wlfi = new MockERC20("WLFI", "WLFI", 18);
        usd1 = new MockERC20("USD1", "USD1", 18);

        // Deploy mock oracle
        priceFeed = new MockAggregatorV3();
        priceFeed.setPrice(1e8); // Set $1 price

        // Deploy mock pool and router (required, cannot be address(0))
        MockUniswapV3Pool pool = new MockUniswapV3Pool();
        MockSwapRouter router = new MockSwapRouter();

        // Deploy vault with minimal dependencies
        vault = new EagleOVault(
            address(wlfi),
            address(usd1),
            address(priceFeed),
            address(pool),
            address(router),
            owner
        );

        // Max supply is 50M (absolute hardcoded limit)

        // Fund user
        wlfi.mint(user1, 10000e18);
        usd1.mint(user1, 10000e18);
    }

    function test_MinimalDeposit() public {
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);

        uint256 shares = vault.deposit(1000e18, user1);
        vm.stopPrank();

        assertEq(shares, 1000e18 * 10_000, "Should receive 10,000x deposit amount");
        assertEq(vault.balanceOf(user1), 1000e18 * 10_000, "User should have 10,000x shares");
    }

    function test_MinimalWithdrawal() public {
        // Deposit first - user gets 10,000x shares
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        uint256 sharesReceived = vault.deposit(1000e18, user1);
        // sharesReceived = 10,000,000e18

        // Withdraw half the shares
        uint256 sharesToRedeem = sharesReceived / 2;
        uint256 assets = vault.redeem(sharesToRedeem, user1, user1);
        vm.stopPrank();

        assertEq(assets, 500e18, "Should receive half the assets back");
        assertEq(vault.balanceOf(user1), sharesReceived / 2, "Should have half shares remaining");
    }

    function test_MinimalTotalAssets() public {
        vm.startPrank(user1);
        wlfi.approve(address(vault), 1000e18);
        vault.deposit(1000e18, user1);
        vm.stopPrank();

        uint256 totalAssets = vault.totalAssets();
        assertEq(totalAssets, 1000e18, "Total assets should match deposit");
    }
}

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

// Mock Chainlink price feed for minimal test
contract MockAggregatorV3 {
    int256 private _price;
    uint8 private _decimals;

    constructor() {
        _price = 1e8; // $1 with 8 decimals
        _decimals = 8;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }

    function setPrice(int256 price) external {
        _price = price;
    }
}

// Mock Uniswap V3 Pool for minimal test
contract MockUniswapV3Pool {
    function slot0() external pure returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    ) {
        // Return mock values for a $1 price
        return (79228162514264337593543950336, 0, 0, 1, 1, 0, true);
    }
    
    function token0() external pure returns (address) {
        return address(1);
    }
    
    function token1() external pure returns (address) {
        return address(2);
    }
}

// Mock Swap Router for minimal test
contract MockSwapRouter {
    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams calldata
    ) external pure returns (uint256) {
        return 0;
    }
}

// Import ISwapRouter for type reference
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

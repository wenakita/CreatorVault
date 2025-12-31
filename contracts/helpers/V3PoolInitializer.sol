// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/v3/IUniswapV3Factory.sol";
import "../interfaces/v3/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title V3PoolInitializer
 * @notice Creates and initializes Uniswap V3 pools with initial liquidity
 * @dev Used during vault activation to bootstrap LP pools
 */
contract V3PoolInitializer {
    using SafeERC20 for IERC20;

    IUniswapV3Factory public immutable factory;
    address public immutable weth;
    address public immutable usdc;

    event PoolCreated(
        address indexed token,
        address indexed quoteToken,
        uint24 fee,
        address pool
    );

    event LiquidityAdded(
        address indexed pool,
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint128 liquidity
    );

    constructor(
        address _factory,
        address _weth,
        address _usdc
    ) {
        factory = IUniswapV3Factory(_factory);
        weth = _weth;
        usdc = _usdc;
    }

    /**
     * @notice Creates a V3 pool if it doesn't exist
     * @param token Creator token address
     * @param quoteToken Quote token (WETH or USDC)
     * @param fee Fee tier (500, 3000, 10000)
     * @return pool The pool address
     */
    function createPoolIfNeeded(
        address token,
        address quoteToken,
        uint24 fee
    ) external returns (address pool) {
        // Check if pool already exists
        pool = factory.getPool(token, quoteToken, fee);
        
        if (pool == address(0)) {
            // Create pool
            pool = factory.createPool(token, quoteToken, fee);
            emit PoolCreated(token, quoteToken, fee, pool);
        }
        
        return pool;
    }

    /**
     * @notice Initializes pool with a starting price
     * @param pool The pool to initialize
     * @param sqrtPriceX96 The initial sqrt price (Q64.96 format)
     * @dev sqrtPriceX96 = sqrt(price) * 2^96
     * @dev For AKITA/USDC at $0.0001: sqrtPriceX96 ≈ 250541448375047931186413801569
     */
    function initializePool(
        address pool,
        uint160 sqrtPriceX96
    ) external {
        IUniswapV3Pool(pool).initialize(sqrtPriceX96);
    }

    /**
     * @notice Creates pool and initializes in one call
     * @param token Creator token
     * @param quoteToken Quote token (WETH/USDC)
     * @param fee Fee tier
     * @param sqrtPriceX96 Initial price
     * @return pool The pool address
     */
    function createAndInitialize(
        address token,
        address quoteToken,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external returns (address pool) {
        // Create pool if needed
        pool = this.createPoolIfNeeded(token, quoteToken, fee);
        
        // Initialize if not already initialized
        try IUniswapV3Pool(pool).initialize(sqrtPriceX96) {
            // Success
        } catch {
            // Already initialized, that's fine
        }
        
        return pool;
    }

    /**
     * @notice Calculate sqrt price from token amounts
     * @dev Helper to calculate sqrtPriceX96 from desired amounts
     * @dev sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96 * sqrt(10^(decimals0 - decimals1))
     */
    function getSqrtPriceX96(
        uint256 amount0,
        uint256 amount1,
        uint8 decimals0,
        uint8 decimals1
    ) external pure returns (uint160) {
        // Calculate price ratio
        uint256 price = (amount1 * (10 ** decimals0)) / (amount0 * (10 ** decimals1));
        
        // Calculate sqrt(price) * 2^96
        uint256 sqrtPrice = sqrt(price * (2 ** 192));
        
        return uint160(sqrtPrice);
    }

    /**
     * @notice Square root using Babylonian method
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}

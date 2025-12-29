// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IUniswapV3Factory } from "../interfaces/v3/IUniswapV3Factory.sol";
import { IUniswapV3Pool } from "../interfaces/v3/IUniswapV3Pool.sol";
import "../interfaces/strategies/IStrategy.sol";

/**
 * @title CreatorCharmStrategyV2
 * @notice Production-ready Charm vault strategy for CREATOR/USDC with 99/1 initial ratio
 * 
 * @dev IMPROVEMENTS:
 *      1. ✅ Uses POOL PRICE for swap calculations (not oracle) - prevents bad swap rates
 *      2. ✅ Slippage protection on all swaps (configurable, default 3%)
 *      3. ✅ Try/catch on Charm deposits (graceful failure, returns tokens)
 *      4. ✅ Pre-deposit range check (skips if Charm vault out of range)
 *      5. ✅ Single atomic deposit (no batching - simpler & cheaper)
 *      6. ✅ Max swap percentage limits (prevents excessive swaps)
 *      7. ✅ Configurable parameters without redeployment
 *      8. ✅ zRouter support for gas-efficient swaps (8-18% gas savings)
 *      9. ✅ Auto fee tier discovery (finds best liquidity pool)
 * 
 * @dev CREATOR/USDC SPECIFIC:
 *      - Initial ratio: 99% CREATOR / 1% USDC
 *      - Max swap: 5% CREATOR → USDC (configurable)
 *      - Handles single-sided CREATOR deposits gracefully
 *      - Auto-balances to maintain Charm vault ratio
 *      - Dollar-denominated for easy valuation
 *      - Lower impermanent loss vs volatile pairs
 */

interface ICharmVault {
    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 shares, uint256 amount0, uint256 amount1);
    
    function withdraw(
        uint256 shares,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1);
    
    function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    
    // Tick range functions
    function baseLower() external view returns (int24);
    function baseUpper() external view returns (int24);
    function pool() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice zRouter - gas-efficient multi-AMM DEX aggregator
/// @dev Base: 0x... (will be deployed)
interface IzRouter {
    function swapV3(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external payable returns (uint256 amountOut);
}

// Interfaces imported from v3-core and interfaces/strategies/IStrategy.sol

contract CreatorCharmStrategyV2 is IStrategy, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================

    address public immutable vault;           // CreatorOVault address
    IERC20 public immutable CREATOR;          // Creator token
    IERC20 public immutable USDC;             // USDC (quote token)
    ISwapRouter public immutable UNISWAP_ROUTER;

    ICharmVault public charmVault;
    IUniswapV3Pool public swapPool;           // CREATOR/USDC pool for pricing

    /// @notice zRouter for gas-efficient swaps (optional)
    /// @dev Base: TBD
    IzRouter public zRouter;
    bool public useZRouter = false;

    /// @notice Uniswap V3 Factory for auto fee tier discovery
    /// @dev Base: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
    IUniswapV3Factory public uniFactory;
    bool public autoFeeTier = false;

    /// @notice Configurable parameters
    uint256 public maxSwapPercent = 5;            // Max 5% CREATOR → USDC (99/1 ratio)
    uint256 public swapSlippageBps = 300;         // 3% max swap slippage
    uint256 public depositSlippageBps = 500;      // 5% deposit slippage
    uint24 public swapPoolFee = 3000;             // 0.3% fee tier (default)

    bool public active = true;

    // Track for harvest calculations
    uint256 private lastTotalAssets;

    // =================================
    // EVENTS (Standard events from IStrategy.sol)
    // =================================
    // Standard events inherited from IStrategy interface:
    // - event StrategyDeposit(address indexed from, uint256 amount, uint256 deposited);
    // - event StrategyWithdraw(address indexed to, uint256 amount, uint256 withdrawn);
    // - event StrategyHarvest(uint256 profit);
    // - event StrategyRebalanced(uint256 newTotalAssets);
    // - event EmergencyWithdraw(address indexed to, uint256 amount);
    
    // Additional strategy-specific events:
    event TokensSwapped(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event DepositFailed(string reason);
    event UnusedTokensReturned(uint256 creatorAmount, uint256 usdcAmount);
    event ParametersUpdated(uint256 maxSwapPercent, uint256 swapSlippageBps);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotActive();
    error ZeroAddress();
    error SlippageExceeded(uint256 expected, uint256 actual);

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier whenActive() {
        if (!active) revert NotActive();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _vault,
        address _creator,
        address _usdc,
        address _uniswapRouter,
        address _charmVault,
        address _swapPool,
        address _owner
    ) Ownable(_owner) {
        if (_vault == address(0) || _creator == address(0) || 
            _usdc == address(0) || _uniswapRouter == address(0)) {
            revert ZeroAddress();
        }

        vault = _vault;
        CREATOR = IERC20(_creator);
        USDC = IERC20(_usdc);
        UNISWAP_ROUTER = ISwapRouter(_uniswapRouter);

        if (_charmVault != address(0)) {
            charmVault = ICharmVault(_charmVault);
        }
        if (_swapPool != address(0)) {
            swapPool = IUniswapV3Pool(_swapPool);
        }
    }

    // =================================
    // CONFIGURATION
    // =================================

    function setCharmVault(address _charmVault) external onlyOwner {
        charmVault = ICharmVault(_charmVault);
    }

    function setSwapPool(address _swapPool) external onlyOwner {
        swapPool = IUniswapV3Pool(_swapPool);
    }

    /// @notice Set zRouter address for gas-efficient swaps
    function setZRouter(address _zRouter) external onlyOwner {
        zRouter = IzRouter(_zRouter);
    }

    /// @notice Toggle between zRouter (gas-efficient) and Uniswap Router
    function setUseZRouter(bool _useZRouter) external onlyOwner {
        useZRouter = _useZRouter;
    }

    /// @notice Set Uniswap V3 Factory for auto fee tier discovery
    /// @param _factory Factory address (0x33128a8fC17869897dcE68Ed026d694621f6FDfD on Base)
    function setUniFactory(address _factory) external onlyOwner {
        uniFactory = IUniswapV3Factory(_factory);
    }

    /// @notice Toggle automatic fee tier discovery
    function setAutoFeeTier(bool _autoFeeTier) external onlyOwner {
        autoFeeTier = _autoFeeTier;
    }

    /// @notice Find best fee tier for a token pair (checks liquidity)
    /// @dev Checks 0.01%, 0.05%, 0.3%, 1% fee tiers
    function _findBestFeeTier(address tokenIn, address tokenOut) internal view returns (uint24 bestFee) {
        if (address(uniFactory) == address(0) || !autoFeeTier) {
            return swapPoolFee; // Return default
        }

        uint24[4] memory fees = [uint24(100), uint24(500), uint24(3000), uint24(10000)];
        uint128 bestLiquidity = 0;
        bestFee = swapPoolFee; // Default fallback

        for (uint256 i = 0; i < fees.length; i++) {
            address pool = uniFactory.getPool(tokenIn, tokenOut, fees[i]);
            if (pool != address(0)) {
                try IUniswapV3Pool(pool).liquidity() returns (uint128 liq) {
                    if (liq > bestLiquidity) {
                        bestLiquidity = liq;
                        bestFee = fees[i];
                    }
                } catch {
                    continue;
                }
            }
        }
    }

    function setParameters(
        uint256 _maxSwapPercent,
        uint256 _swapSlippageBps,
        uint256 _depositSlippageBps,
        uint24 _swapPoolFee
    ) external onlyOwner {
        maxSwapPercent = _maxSwapPercent;
        swapSlippageBps = _swapSlippageBps;
        depositSlippageBps = _depositSlippageBps;
        swapPoolFee = _swapPoolFee;
        
        emit ParametersUpdated(_maxSwapPercent, _swapSlippageBps);
    }

    function setActive(bool _active) external onlyOwner {
        active = _active;
    }

    function initializeApprovals() external onlyOwner {
        CREATOR.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        USDC.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        if (address(charmVault) != address(0)) {
            CREATOR.forceApprove(address(charmVault), type(uint256).max);
            USDC.forceApprove(address(charmVault), type(uint256).max);
        }
        if (address(zRouter) != address(0)) {
            CREATOR.forceApprove(address(zRouter), type(uint256).max);
            USDC.forceApprove(address(zRouter), type(uint256).max);
        }
    }

    // =================================
    // ISTRATEGY INTERFACE
    // =================================

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(CREATOR);
    }

    function getTotalAssets() public view override returns (uint256) {
        if (address(charmVault) == address(0)) {
            return CREATOR.balanceOf(address(this));
        }

        uint256 ourShares = charmVault.balanceOf(address(this));
        uint256 totalShares = charmVault.totalSupply();
        
        if (totalShares == 0 || ourShares == 0) {
            return CREATOR.balanceOf(address(this));
        }

        (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
        
        // Determine which token is CREATOR
        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);
        
        uint256 ourCreator = creatorIsToken0 
            ? (total0 * ourShares) / totalShares
            : (total1 * ourShares) / totalShares;
            
        uint256 ourUsdc = creatorIsToken0
            ? (total1 * ourShares) / totalShares
            : (total0 * ourShares) / totalShares;

        // Convert USDC to CREATOR equivalent for total value
        uint256 creatorPerUsdc = _getPoolPrice();
        uint256 usdcInCreator = (ourUsdc * creatorPerUsdc) / 1e6; // USDC has 6 decimals

        return ourCreator + usdcInCreator + CREATOR.balanceOf(address(this));
    }

    // =================================
    // DEPOSIT WITH SLIPPAGE PROTECTION
    // =================================

    /**
     * @notice Deposit CREATOR tokens (single-sided deposit)
     * @dev Automatically swaps portion to USDC to maintain Charm vault ratio
     * @param amount Amount of CREATOR tokens to deposit
     * @return deposited Actual amount deployed (in CREATOR value)
     */
    function deposit(uint256 amount) 
        external
        override
        onlyVault
        whenActive
        nonReentrant
        returns (uint256 deposited) 
    {
        if (address(charmVault) == address(0)) {
            _returnAllTokens();
            return 0;
        }

        // Pull CREATOR tokens
        if (amount > 0) {
            try CREATOR.transferFrom(vault, address(this), amount) {} catch {
                return 0;
            }
        }

        uint256 totalCreator = CREATOR.balanceOf(address(this));
        uint256 totalUsdc = USDC.balanceOf(address(this));

        if (totalCreator == 0 && totalUsdc == 0) return 0;

        // Get Charm vault ratio (total0 could be CREATOR or USDC depending on token order)
        (uint256 charm0, uint256 charm1) = charmVault.getTotalAmounts();
        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);
        
        uint256 charmCreator = creatorIsToken0 ? charm0 : charm1;
        uint256 charmUsdc = creatorIsToken0 ? charm1 : charm0;

        uint256 finalCreator;
        uint256 finalUsdc;

        if (charmCreator > 0 && charmUsdc > 0) {
            // Charm has liquidity - calculate required USDC for our CREATOR
            uint256 usdcNeeded = (totalCreator * charmUsdc) / charmCreator;

            if (totalUsdc >= usdcNeeded) {
                // Have enough USDC - use all CREATOR
                finalCreator = totalCreator;
                finalUsdc = usdcNeeded;
            } else {
                // Need more USDC - swap some CREATOR → USDC
                uint256 usdcDeficit = usdcNeeded - totalUsdc;
                
                // Limit swap to maxSwapPercent of CREATOR
                uint256 maxSwapCreator = (totalCreator * maxSwapPercent) / 100;
                uint256 creatorToSwap = _calculateCreatorToSwap(usdcDeficit, maxSwapCreator);
                
                if (creatorToSwap > 0) {
                    uint256 moreUsdc = _swapCreatorToUsdcSafe(creatorToSwap);
                    totalUsdc = totalUsdc + moreUsdc;
                    totalCreator = totalCreator - creatorToSwap;
                    
                    // Recalculate with new balances
                    usdcNeeded = (totalCreator * charmUsdc) / charmCreator;
                    finalCreator = totalCreator;
                    finalUsdc = totalUsdc > usdcNeeded ? usdcNeeded : totalUsdc;
                } else {
                    // Can't swap enough - deposit what we can
                    uint256 creatorUsable = (totalUsdc * charmCreator) / charmUsdc;
                    finalCreator = creatorUsable > totalCreator ? totalCreator : creatorUsable;
                    finalUsdc = totalUsdc;
                }
            }
        } else {
            // Charm empty - deposit 99% CREATOR, 1% USDC
            // Need to swap ~1% CREATOR → USDC
            uint256 creatorToSwap = totalCreator / 100; // 1%
            
            if (creatorToSwap > 0) {
                uint256 usdcReceived = _swapCreatorToUsdcSafe(creatorToSwap);
                totalUsdc = totalUsdc + usdcReceived;
                totalCreator = totalCreator - creatorToSwap;
            }
            
            finalCreator = totalCreator;
            finalUsdc = totalUsdc;
        }

        // Deposit to Charm with safety checks
        _depositToCharmSafe(finalCreator, finalUsdc, creatorIsToken0);

        // Return unused tokens to vault
        _returnUnusedTokens();

        // Calculate total deposited value in CREATOR terms
        uint256 creatorPerUsdc = _getPoolPrice();
        uint256 usdcInCreator = (finalUsdc * creatorPerUsdc) / 1e6; // USDC has 6 decimals
        deposited = finalCreator + usdcInCreator;

        // Update for harvest tracking
        lastTotalAssets = getTotalAssets();

        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    /**
     * @notice Calculate how much CREATOR to swap for needed USDC
     */
    function _calculateCreatorToSwap(uint256 usdcNeeded, uint256 maxCreator) internal view returns (uint256) {
        if (usdcNeeded == 0) return 0;
        
        // Get price: how much CREATOR per USDC
        uint256 creatorPerUsdc = _getPoolPrice();
        uint256 creatorNeeded = (usdcNeeded * creatorPerUsdc) / 1e6; // USDC has 6 decimals
        
        // Add slippage buffer (3%)
        creatorNeeded = (creatorNeeded * 10300) / 10000;
        
        return creatorNeeded > maxCreator ? maxCreator : creatorNeeded;
    }

    /**
     * @notice Check if Charm vault is in range for deposits
     */
    function isCharmInRange() public view returns (bool inRange, int24 currentTick, int24 lower, int24 upper) {
        if (address(charmVault) == address(0)) return (false, 0, 0, 0);
        
        try charmVault.pool() returns (address poolAddr) {
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddr);
            (, currentTick,,,,,) = pool.slot0();
            
            try charmVault.baseLower() returns (int24 _lower) {
                lower = _lower;
            } catch {
                lower = -887200;
            }
            
            try charmVault.baseUpper() returns (int24 _upper) {
                upper = _upper;
            } catch {
                upper = 887200;
            }
            
            inRange = currentTick >= lower && currentTick <= upper;
        } catch {
            inRange = true;
        }
    }

    /**
     * @notice Safe Charm deposit - SINGLE ATOMIC
     */
    function _depositToCharmSafe(
        uint256 creatorAmount, 
        uint256 usdcAmount,
        bool creatorIsToken0
    ) internal returns (uint256 shares) {
        if (creatorAmount == 0 && usdcAmount == 0) return 0;

        // PRE-CHECK: Is Charm vault in range?
        (bool inRange,,,) = isCharmInRange();
        if (!inRange) {
            emit DepositFailed("Charm vault out of range");
            return 0;
        }

        // Calculate min amounts with slippage
        uint256 minCreator = (creatorAmount * (10000 - depositSlippageBps)) / 10000;
        uint256 minUsdc = (usdcAmount * (10000 - depositSlippageBps)) / 10000;

        // Prepare amounts based on token order
        uint256 amount0 = creatorIsToken0 ? creatorAmount : usdcAmount;
        uint256 amount1 = creatorIsToken0 ? usdcAmount : creatorAmount;
        uint256 min0 = creatorIsToken0 ? minCreator : minUsdc;
        uint256 min1 = creatorIsToken0 ? minUsdc : minCreator;

        // SINGLE ATOMIC DEPOSIT
        try charmVault.deposit(amount0, amount1, min0, min1, address(this)) 
            returns (uint256 _shares, uint256, uint256) 
        {
            shares = _shares;
        } catch Error(string memory reason) {
            emit DepositFailed(reason);
        } catch {
            emit DepositFailed("Deposit failed");
        }
    }

    /**
     * @notice Swap CREATOR → USDC with slippage protection
     * @dev Uses zRouter if enabled, auto fee tier if enabled
     */
    function _swapCreatorToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        // Auto-discover best fee tier if enabled
        uint24 fee = _findBestFeeTier(address(CREATOR), address(USDC));

        // Calculate expected based on pool price
        uint256 creatorPerUsdc = _getPoolPrice();
        uint256 expectedOut = (amountIn * 1e6) / creatorPerUsdc; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        // Try zRouter first if enabled (8-18% gas savings)
        if (useZRouter && address(zRouter) != address(0)) {
            try zRouter.swapV3(
                address(CREATOR),
                address(USDC),
                fee,
                amountIn,
                minOut,
                block.timestamp
            ) returns (uint256 out) {
                amountOut = out;
                emit TokensSwapped(address(CREATOR), address(USDC), amountIn, amountOut);
                return amountOut;
            } catch {
                // Fall through to Uniswap Router
            }
        }

        // Fallback to Uniswap Router
        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(CREATOR),
                tokenOut: address(USDC),
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 out) {
            amountOut = out;
            emit TokensSwapped(address(CREATOR), address(USDC), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    /**
     * @notice Get pool price (CREATOR per USDC)
     */
    function _getPoolPrice() internal view returns (uint256 creatorPerUsdc) {
        if (address(swapPool) == address(0)) {
            return 100e18; // Fallback ~100 CREATOR per USDC (99/1 ratio)
        }

        (uint160 sqrtPriceX96,,,,,,) = swapPool.slot0();
        
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        
        // Adjust for token order and decimals
        // CREATOR has 18 decimals, USDC has 6 decimals
        if (swapPool.token0() == address(USDC)) {
            // USDC is token0, price is CREATOR per USDC
            creatorPerUsdc = price * 1e18 * 1e12; // Adjust for USDC 6 decimals
        } else {
            // CREATOR is token0, need inverse
            if (price > 0) {
                creatorPerUsdc = (1e18 * 1e18) / (price * 1e12); // Adjust for USDC 6 decimals
            } else {
                creatorPerUsdc = 100e18;
            }
        }

        // Sanity check
        if (creatorPerUsdc == 0) creatorPerUsdc = 100e18;
    }

    // =================================
    // WITHDRAW
    // =================================

    function withdraw(uint256 amount) 
        external
        override
        onlyVault
        nonReentrant
        returns (uint256 withdrawn) 
    {
        if (address(charmVault) == address(0)) return 0;

        uint256 totalValue = getTotalAssets();
        if (totalValue == 0) return 0;

        uint256 ourShares = charmVault.balanceOf(address(this));
        uint256 sharesToWithdraw = (ourShares * amount) / totalValue;
        if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;

        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);

        try charmVault.withdraw(sharesToWithdraw, 0, 0, address(this)) 
            returns (uint256 amount0, uint256 amount1) 
        {
            uint256 creatorReceived = creatorIsToken0 ? amount0 : amount1;
            uint256 usdcReceived = creatorIsToken0 ? amount1 : amount0;

            // Convert any USDC back to CREATOR before returning
            if (usdcReceived > 0) {
                uint256 moreCreator = _swapUsdcToCreatorSafe(usdcReceived);
                creatorReceived += moreCreator;
            }

            withdrawn = creatorReceived;
            if (withdrawn > 0) {
                CREATOR.safeTransfer(vault, withdrawn);
            }
        } catch {}

        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    /**
     * @notice Swap USDC → CREATOR with slippage protection
     */
    function _swapUsdcToCreatorSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        uint24 fee = _findBestFeeTier(address(USDC), address(CREATOR));

        uint256 creatorPerUsdc = _getPoolPrice();
        uint256 expectedOut = (amountIn * creatorPerUsdc) / 1e6; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        if (useZRouter && address(zRouter) != address(0)) {
            try zRouter.swapV3(
                address(USDC),
                address(CREATOR),
                fee,
                amountIn,
                minOut,
                block.timestamp
            ) returns (uint256 out) {
                amountOut = out;
                emit TokensSwapped(address(USDC), address(CREATOR), amountIn, amountOut);
                return amountOut;
            } catch {}
        }

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(USDC),
                tokenOut: address(CREATOR),
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 out) {
            amountOut = out;
            emit TokensSwapped(address(USDC), address(CREATOR), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    // =================================
    // HARVEST & REBALANCE
    // =================================

    function harvest() external override onlyVault returns (uint256 profit) {
        uint256 currentTotal = getTotalAssets();
        
        if (currentTotal > lastTotalAssets) {
            profit = currentTotal - lastTotalAssets;
        }
        
        lastTotalAssets = currentTotal;
        emit StrategyHarvest(profit);
    }

    function rebalance() external override {
        require(msg.sender == owner() || msg.sender == vault, "Only owner or vault");
        
        // Charm strategy handles its own rebalancing
        uint256 totalAssets = getTotalAssets();
        emit StrategyRebalanced(totalAssets);
    }

    // =================================
    // EMERGENCY
    // =================================

    function emergencyWithdraw() external override onlyVault returns (uint256 withdrawn) {
        if (address(charmVault) == address(0)) {
            withdrawn = CREATOR.balanceOf(address(this));
            if (withdrawn > 0) {
                CREATOR.safeTransfer(vault, withdrawn);
            }
            emit EmergencyWithdraw(vault, withdrawn);
            return withdrawn;
        }

        uint256 ourShares = charmVault.balanceOf(address(this));
        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);
        
        if (ourShares > 0) {
            try charmVault.withdraw(ourShares, 0, 0, address(this)) 
                returns (uint256 amount0, uint256 amount1) 
            {
                uint256 creatorReceived = creatorIsToken0 ? amount0 : amount1;
                uint256 usdcReceived = creatorIsToken0 ? amount1 : amount0;

                // Swap USDC to CREATOR
                if (usdcReceived > 0) {
                    uint256 moreCreator = _swapUsdcToCreatorSafe(usdcReceived);
                    creatorReceived += moreCreator;
                }

                withdrawn = creatorReceived;
            } catch {}
        }

        // Send all CREATOR to vault
        uint256 totalCreator = CREATOR.balanceOf(address(this));
        if (totalCreator > 0) {
            CREATOR.safeTransfer(vault, totalCreator);
            withdrawn = totalCreator;
        }

        emit EmergencyWithdraw(vault, withdrawn);
    }

    // =================================
    // HELPERS
    // =================================

    function _returnAllTokens() internal {
        uint256 creatorBal = CREATOR.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));
        
        if (creatorBal > 0) CREATOR.safeTransfer(vault, creatorBal);
        if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
    }

    function _returnUnusedTokens() internal {
        uint256 creatorBal = CREATOR.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));
        
        if (creatorBal > 0 || usdcBal > 0) {
            if (creatorBal > 0) CREATOR.safeTransfer(vault, creatorBal);
            if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
            emit UnusedTokensReturned(creatorBal, usdcBal);
        }
    }

    // =================================
    // OWNER EMERGENCY
    // =================================

    function ownerEmergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function ownerEmergencyWithdrawFromCharm() external onlyOwner returns (uint256 amount0, uint256 amount1) {
        if (address(charmVault) == address(0)) return (0, 0);
        
        uint256 ourShares = charmVault.balanceOf(address(this));
        if (ourShares > 0) {
            (amount0, amount1) = charmVault.withdraw(ourShares, 0, 0, address(this));
        }
    }
}



import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IUniswapV3Factory } from "../interfaces/v3/IUniswapV3Factory.sol";
import { IUniswapV3Pool } from "../interfaces/v3/IUniswapV3Pool.sol";
import "../interfaces/strategies/IStrategy.sol";

/**
 * @title CreatorCharmStrategyV2
 * @notice Production-ready Charm vault strategy for CREATOR/USDC with 99/1 initial ratio
 * 
 * @dev IMPROVEMENTS:
 *      1. ✅ Uses POOL PRICE for swap calculations (not oracle) - prevents bad swap rates
 *      2. ✅ Slippage protection on all swaps (configurable, default 3%)
 *      3. ✅ Try/catch on Charm deposits (graceful failure, returns tokens)
 *      4. ✅ Pre-deposit range check (skips if Charm vault out of range)
 *      5. ✅ Single atomic deposit (no batching - simpler & cheaper)
 *      6. ✅ Max swap percentage limits (prevents excessive swaps)
 *      7. ✅ Configurable parameters without redeployment
 *      8. ✅ zRouter support for gas-efficient swaps (8-18% gas savings)
 *      9. ✅ Auto fee tier discovery (finds best liquidity pool)
 * 
 * @dev CREATOR/USDC SPECIFIC:
 *      - Initial ratio: 99% CREATOR / 1% USDC
 *      - Max swap: 5% CREATOR → USDC (configurable)
 *      - Handles single-sided CREATOR deposits gracefully
 *      - Auto-balances to maintain Charm vault ratio
 *      - Dollar-denominated for easy valuation
 *      - Lower impermanent loss vs volatile pairs
 */

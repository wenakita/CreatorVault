// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStrategy} from "../interfaces/strategies/IStrategy.sol";

/**
 * @title CreatorCharmStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Charm vault strategy for the ORIGINAL Creator Coin / WETH pairs
 * 
 * @dev PURPOSE:
 *      This strategy manages liquidity for the ORIGINAL CREATOR COIN (e.g., AKITA)
 *      on Uniswap V3 via Charm Finance Alpha Vaults.
 * 
 *      NOT for CreatorShareOFT (wsAKITA) - that uses CreatorLPManager on V4.
 * 
 * @dev TOKEN DISTINCTION:
 *      ┌────────────────────────────────────────────────────────────┐
 *      │ AKITA (Creator Coin)  →  CreatorCharmStrategy  →  V3 Pool │
 *      │ wsAKITA (ShareOFT)    →  CreatorLPManager      →  V4 Pool │
 *      └────────────────────────────────────────────────────────────┘
 * 
 * @dev USES CHARM FINANCE (V3):
 *      - Charm handles automatic rebalancing via keepers
 *      - Passive concentrated liquidity management
 *      - Battle-tested and audited
 *      - We just deposit/withdraw, Charm does the rest
 *      - No fee hooks (V3 doesn't support hooks)
 * 
 * @dev SINGLE TOKEN INTERFACE:
 *      - CreatorOVault deposits Creator Coin
 *      - We swap half to WETH and deposit to Charm
 *      - On withdraw, we swap back and return Creator Coin
 * 
 * @dev WHY V3 FOR CREATOR COIN:
 *      - The original Creator Coin doesn't need the 6.9% fee hook
 *      - Charm Alpha Vaults are proven and audited
 *      - Passive management = lower operational overhead
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
    function token0() external view returns (address);
    function token1() external view returns (address);
    
    // Range checks
    function baseLower() external view returns (int24);
    function baseUpper() external view returns (int24);
    function pool() external view returns (address);
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

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract CreatorCharmStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE
    // =================================

    /// @notice The CreatorOVault this strategy serves
    address public vault;
    
    /// @notice Creator Coin token
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice Paired token (WETH)
    IERC20 public immutable WETH;
    
    /// @notice Uniswap router for swaps
    ISwapRouter public immutable SWAP_ROUTER;
    
    /// @notice Charm vault for LP management
    ICharmVault public charmVault;
    
    /// @notice Uniswap pool for price reference
    IUniswapV3Pool public swapPool;
    
    /// @notice Strategy name
    string public strategyName;
    
    /// @notice Configurable parameters
    uint256 public maxSwapPercent = 50;           // Max 50% swapped (need both tokens)
    uint256 public swapSlippageBps = 300;         // 3% swap slippage
    uint256 public depositSlippageBps = 500;      // 5% deposit slippage
    uint24 public swapPoolFee = 3000;             // 0.3% fee tier
    
    /// @notice State flags
    bool public isActive_ = true;
    bool public isEmergencyMode;
    
    /// @notice Accounting
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public lastDeposit;

    // =================================
    // EVENTS
    // =================================

    event CharmDeposit(uint256 creatorCoinIn, uint256 wethSwapped, uint256 sharesReceived);
    event CharmWithdraw(uint256 sharesWithdrawn, uint256 creatorCoinOut);
    event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event DepositFailed(string reason);
    event ParametersUpdated(uint256 maxSwapPercent, uint256 swapSlippageBps, uint256 depositSlippageBps);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotActive();
    error EmergencyMode();
    error ZeroAddress();
    error ZeroAmount();
    error CharmNotConfigured();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVault() {
        if (msg.sender != vault && msg.sender != owner()) revert NotVault();
        _;
    }

    modifier whenActive() {
        if (!isActive_) revert NotActive();
        _;
    }

    modifier whenNotEmergency() {
        if (isEmergencyMode) revert EmergencyMode();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    /**
     * @notice Initialize Creator Charm Strategy
     * @param _creatorCoin Creator Coin token address
     * @param _weth WETH address
     * @param _swapRouter Uniswap router address
     * @param _vault CreatorOVault address
     * @param _owner Owner address
     */
    constructor(
        address _creatorCoin,
        address _weth,
        address _swapRouter,
        address _vault,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_weth == address(0)) revert ZeroAddress();
        if (_swapRouter == address(0)) revert ZeroAddress();
        if (_vault == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        WETH = IERC20(_weth);
        SWAP_ROUTER = ISwapRouter(_swapRouter);
        vault = _vault;
        strategyName = "Creator Charm Strategy";
    }

    // =================================
    // CONFIGURATION
    // =================================

    /**
     * @notice Set Charm vault address
     * @dev Must be a Charm vault with Creator Coin / WETH pair
     */
    function setCharmVault(address _charmVault) external onlyOwner {
        charmVault = ICharmVault(_charmVault);
        
        // Approve Charm vault
        CREATOR_COIN.forceApprove(_charmVault, type(uint256).max);
        WETH.forceApprove(_charmVault, type(uint256).max);
    }

    /**
     * @notice Set swap pool for price reference
     */
    function setSwapPool(address _swapPool) external onlyOwner {
        swapPool = IUniswapV3Pool(_swapPool);
    }

    /**
     * @notice Initialize token approvals
     */
    function initializeApprovals() external onlyOwner {
        CREATOR_COIN.forceApprove(address(SWAP_ROUTER), type(uint256).max);
        WETH.forceApprove(address(SWAP_ROUTER), type(uint256).max);
        
        if (address(charmVault) != address(0)) {
            CREATOR_COIN.forceApprove(address(charmVault), type(uint256).max);
            WETH.forceApprove(address(charmVault), type(uint256).max);
        }
    }

    /**
     * @notice Set strategy parameters
     */
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
        
        emit ParametersUpdated(_maxSwapPercent, _swapSlippageBps, _depositSlippageBps);
    }

    // =================================
    // IStrategy IMPLEMENTATION
    // =================================

    function isActive() external view override returns (bool) {
        return isActive_ && !isEmergencyMode;
    }

    function asset() external view override returns (address) {
        return address(CREATOR_COIN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return _getTotalInCreatorCoin();
    }

    /**
     * @notice Deposit Creator Coin into Charm vault
     * @dev Swaps portion to WETH, deposits both to Charm
     */
    function deposit(uint256 amount) 
        external 
        override 
        nonReentrant 
        onlyVault 
        whenActive 
        whenNotEmergency 
        returns (uint256 deposited) 
    {
        if (amount == 0) revert ZeroAmount();
        if (address(charmVault) == address(0)) revert CharmNotConfigured();
        
        // Pull Creator Coin from vault
        CREATOR_COIN.safeTransferFrom(vault, address(this), amount);
        
        uint256 creatorCoinBalance = CREATOR_COIN.balanceOf(address(this));
        uint256 wethBalance = WETH.balanceOf(address(this));
        
        // Get Charm vault's current ratio
        (uint256 charmToken0, uint256 charmToken1) = charmVault.getTotalAmounts();
        
        // Determine which token is which
        address token0 = charmVault.token0();
        bool creatorIsToken0 = token0 == address(CREATOR_COIN);
        
        uint256 charmCreator = creatorIsToken0 ? charmToken0 : charmToken1;
        uint256 charmWeth = creatorIsToken0 ? charmToken1 : charmToken0;
        
        // Calculate how much to swap
        uint256 creatorToSwap = _calculateSwapAmount(creatorCoinBalance, wethBalance, charmCreator, charmWeth);
        
        // Execute swap if needed
        if (creatorToSwap > 0) {
            uint256 wethReceived = _swapCreatorToWeth(creatorToSwap);
            wethBalance += wethReceived;
            creatorCoinBalance -= creatorToSwap;
        }
        
        // Deposit to Charm
        deposited = _depositToCharm(creatorCoinBalance, wethBalance, creatorIsToken0);
        
        totalDeposited += deposited;
        lastDeposit = block.timestamp;
        
        // Return any unused tokens
        _returnUnusedTokens();
        
        emit CharmDeposit(amount, creatorToSwap, deposited);
    }

    /**
     * @notice Withdraw from Charm and return Creator Coin
     */
    function withdraw(uint256 amount) 
        external 
        override 
        nonReentrant 
        onlyVault 
        returns (uint256 withdrawn) 
    {
        if (amount == 0) revert ZeroAmount();
        if (address(charmVault) == address(0)) {
            // No Charm vault - return local balance
            withdrawn = CREATOR_COIN.balanceOf(address(this));
            if (withdrawn > amount) withdrawn = amount;
            if (withdrawn > 0) {
                CREATOR_COIN.safeTransfer(vault, withdrawn);
            }
            return withdrawn;
        }
        
        // Calculate shares to withdraw
        uint256 totalValue = _getTotalInCreatorCoin();
        if (totalValue == 0) return 0;
        
        uint256 ourShares = charmVault.balanceOf(address(this));
        uint256 sharesToWithdraw = (ourShares * amount) / totalValue;
        if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;
        
        if (sharesToWithdraw > 0) {
            // Withdraw from Charm
            try charmVault.withdraw(sharesToWithdraw, 0, 0, address(this)) 
                returns (uint256 amount0Out, uint256 amount1Out) 
            {
                // Determine which is which
                address token0 = charmVault.token0();
                bool creatorIsToken0 = token0 == address(CREATOR_COIN);
                
                uint256 creatorOut = creatorIsToken0 ? amount0Out : amount1Out;
                uint256 wethOut = creatorIsToken0 ? amount1Out : amount0Out;
                
                // Swap WETH back to Creator Coin
                if (wethOut > 0) {
                    uint256 moreCreator = _swapWethToCreator(wethOut);
                    creatorOut += moreCreator;
                }
                
                withdrawn = creatorOut;
            } catch {}
        }
        
        // Add any local balance
        uint256 localBalance = CREATOR_COIN.balanceOf(address(this));
        if (localBalance > 0 && withdrawn < amount) {
            uint256 fromLocal = amount - withdrawn;
            if (fromLocal > localBalance) fromLocal = localBalance;
            withdrawn += fromLocal;
        }
        
        // Transfer to vault
        if (withdrawn > 0) {
            CREATOR_COIN.safeTransfer(vault, withdrawn);
        }
        
        totalWithdrawn += withdrawn;
        
        emit CharmWithdraw(sharesToWithdraw, withdrawn);
    }

    /**
     * @notice Emergency withdraw all funds
     */
    function emergencyWithdraw() 
        external 
        override 
        nonReentrant 
        onlyVault 
        returns (uint256 withdrawn) 
    {
        // Withdraw all from Charm
        if (address(charmVault) != address(0)) {
            uint256 ourShares = charmVault.balanceOf(address(this));
            if (ourShares > 0) {
                try charmVault.withdraw(ourShares, 0, 0, address(this)) {} catch {}
            }
        }
        
        // Swap all WETH to Creator Coin
        uint256 wethBalance = WETH.balanceOf(address(this));
        if (wethBalance > 0) {
            _swapWethToCreator(wethBalance);
        }
        
        // Transfer all Creator Coin to vault
        withdrawn = CREATOR_COIN.balanceOf(address(this));
        if (withdrawn > 0) {
            CREATOR_COIN.safeTransfer(vault, withdrawn);
        }
        
        isEmergencyMode = true;
    }

    /**
     * @notice Harvest is no-op for Charm (fees auto-compound)
     */
    function harvest() external override onlyVault returns (uint256 profit) {
        // Charm auto-compounds, nothing to harvest
        return 0;
    }

    /**
     * @notice Rebalance is handled by Charm keepers
     */
    function rebalance() external override onlyVault {
        // Charm handles rebalancing automatically
    }

    // =================================
    // INTERNAL
    // =================================

    /**
     * @notice Calculate optimal swap amount to match Charm ratio
     */
    function _calculateSwapAmount(
        uint256 creatorBalance,
        uint256 wethBalance,
        uint256 charmCreator,
        uint256 charmWeth
    ) internal view returns (uint256 toSwap) {
        if (charmCreator == 0 || charmWeth == 0) {
            // Charm empty - swap half
            return (creatorBalance * maxSwapPercent) / 100;
        }
        
        // Calculate WETH needed for our Creator Coin
        uint256 wethNeeded = (creatorBalance * charmWeth) / charmCreator;
        
        if (wethBalance >= wethNeeded) {
            // Already have enough WETH
            return 0;
        }
        
        // Need to swap some Creator Coin to WETH
        uint256 wethShortfall = wethNeeded - wethBalance;
        
        // Get pool price
        uint256 creatorPerWeth = _getPoolPrice();
        toSwap = (wethShortfall * creatorPerWeth) / 1e18;
        
        // Cap at max swap percent
        uint256 maxSwap = (creatorBalance * maxSwapPercent) / 100;
        if (toSwap > maxSwap) {
            toSwap = maxSwap;
        }
    }

    /**
     * @notice Swap Creator Coin to WETH with slippage protection
     */
    function _swapCreatorToWeth(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        // Calculate expected output
        uint256 creatorPerWeth = _getPoolPrice();
        uint256 expectedOut = (amountIn * 1e18) / creatorPerWeth;
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;
        
        try SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(CREATOR_COIN),
                tokenOut: address(WETH),
                fee: swapPoolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 out) {
            amountOut = out;
            emit SwapExecuted(address(CREATOR_COIN), address(WETH), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    /**
     * @notice Swap WETH to Creator Coin with slippage protection
     */
    function _swapWethToCreator(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        uint256 creatorPerWeth = _getPoolPrice();
        uint256 expectedOut = (amountIn * creatorPerWeth) / 1e18;
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;
        
        try SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(WETH),
                tokenOut: address(CREATOR_COIN),
                fee: swapPoolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 out) {
            amountOut = out;
            emit SwapExecuted(address(WETH), address(CREATOR_COIN), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    /**
     * @notice Deposit to Charm vault
     */
    function _depositToCharm(
        uint256 creatorAmount,
        uint256 wethAmount,
        bool creatorIsToken0
    ) internal returns (uint256 shares) {
        if (creatorAmount == 0 && wethAmount == 0) return 0;
        
        // Check if Charm is in range
        (bool inRange,,,) = isCharmInRange();
        if (!inRange) {
            emit DepositFailed("Charm vault out of range");
            return 0;
        }
        
        // Order amounts correctly
        uint256 amount0 = creatorIsToken0 ? creatorAmount : wethAmount;
        uint256 amount1 = creatorIsToken0 ? wethAmount : creatorAmount;
        
        // Calculate min amounts
        uint256 min0 = (amount0 * (10000 - depositSlippageBps)) / 10000;
        uint256 min1 = (amount1 * (10000 - depositSlippageBps)) / 10000;
        
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
     * @notice Check if Charm vault is in range
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
     * @notice Get pool price (Creator Coin per WETH)
     */
    function _getPoolPrice() internal view returns (uint256 creatorPerWeth) {
        if (address(swapPool) == address(0)) {
            return 1000e18; // Fallback
        }
        
        (uint160 sqrtPriceX96,,,,,,) = swapPool.slot0();
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        
        if (swapPool.token0() == address(WETH)) {
            creatorPerWeth = price * 1e18;
        } else {
            creatorPerWeth = price > 0 ? (1e18 * 1e18) / price : 1000e18;
        }
        
        if (creatorPerWeth == 0) creatorPerWeth = 1000e18;
    }

    /**
     * @notice Get total value in Creator Coin terms
     */
    function _getTotalInCreatorCoin() internal view returns (uint256) {
        uint256 localCreator = CREATOR_COIN.balanceOf(address(this));
        uint256 localWeth = WETH.balanceOf(address(this));
        
        if (address(charmVault) == address(0)) {
            return localCreator + _wethToCreator(localWeth);
        }
        
        uint256 ourShares = charmVault.balanceOf(address(this));
        uint256 totalShares = charmVault.totalSupply();
        
        if (totalShares == 0 || ourShares == 0) {
            return localCreator + _wethToCreator(localWeth);
        }
        
        (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
        
        uint256 our0 = (total0 * ourShares) / totalShares;
        uint256 our1 = (total1 * ourShares) / totalShares;
        
        // Convert to Creator Coin terms
        address token0 = charmVault.token0();
        bool creatorIsToken0 = token0 == address(CREATOR_COIN);
        
        uint256 ourCreator = creatorIsToken0 ? our0 : our1;
        uint256 ourWeth = creatorIsToken0 ? our1 : our0;
        
        return localCreator + ourCreator + _wethToCreator(localWeth + ourWeth);
    }

    function _wethToCreator(uint256 wethAmount) internal view returns (uint256) {
        if (wethAmount == 0) return 0;
        uint256 creatorPerWeth = _getPoolPrice();
        return (wethAmount * creatorPerWeth) / 1e18;
    }

    function _returnUnusedTokens() internal {
        // Keep small buffer, return rest
        uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
        uint256 buffer = 1e15;
        
        if (creatorBal > buffer) {
            CREATOR_COIN.safeTransfer(vault, creatorBal - buffer);
        }
    }

    // =================================
    // ADMIN
    // =================================

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
    }

    function setActive(bool _active) external onlyOwner {
        isActive_ = _active;
    }

    function disableEmergencyMode() external onlyOwner {
        isEmergencyMode = false;
    }

    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}



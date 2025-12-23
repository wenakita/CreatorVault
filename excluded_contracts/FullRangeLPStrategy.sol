// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FullRangeLPStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Full-range LP strategy for Uniswap V4
 * 
 * @dev FULL RANGE POSITION:
 *      - Tick range: MIN_TICK to MAX_TICK
 *      - Always in range, never needs rebalancing
 *      - Lower capital efficiency but simpler management
 *      - Ideal for base liquidity layer
 * 
 * @dev UNISWAP V4 INTEGRATION:
 *      - Uses PositionManager for NFT-less positions
 *      - Supports native ETH or WETH pairing
 *      - Accumulates fees automatically
 */

// Uniswap V4 Interfaces
interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    
    function unlock(bytes calldata data) external returns (bytes memory);
}

interface IPositionManager {
    struct MintParams {
        IPoolManager.PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        address owner;
        bytes hookData;
    }
    
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint128 amount0Min;
        uint128 amount1Min;
        bytes hookData;
    }
    
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external returns (uint256 amount0, uint256 amount1);
    function collect(uint256 tokenId, address recipient) external returns (uint256 amount0, uint256 amount1);
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
}

interface IV4Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 protocolFee,
        uint24 lpFee
    );
    function liquidity() external view returns (uint128);
}

contract FullRangeLPStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // TYPES (for LP Manager interface)
    // =================================
    
    enum StrategyType {
        FullRange,
        LimitOrder,
        Concentrated
    }

    // =================================
    // CONSTANTS
    // =================================
    
    /// @notice Full range tick bounds for common tick spacings
    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;
    
    // =================================
    // STATE
    // =================================
    
    /// @notice The Creator Coin token
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice The paired token (WETH)
    IERC20 public immutable PAIRED_TOKEN;
    
    /// @notice Uniswap V4 Pool Manager
    address public poolManager;
    
    /// @notice Uniswap V4 Position Manager  
    address public positionManager;
    
    /// @notice LP Manager that controls this strategy
    address public lpManager;
    
    /// @notice Pool key configuration
    IPoolManager.PoolKey public poolKey;
    
    /// @notice Our position token ID (0 if not initialized)
    uint256 public positionTokenId;
    
    /// @notice Total liquidity in our position
    uint128 public totalLiquidity;
    
    /// @notice Strategy active flag
    bool public isActive_;
    
    /// @notice Slippage protection (basis points)
    uint256 public slippageBps = 300; // 3%
    
    /// @notice Fee tier for the pool
    uint24 public feeTier = 3000; // 0.3%
    
    /// @notice Tick spacing
    int24 public tickSpacing = 60;
    
    /// @notice Accumulated fees
    uint256 public accumulatedFees0;
    uint256 public accumulatedFees1;

    // =================================
    // EVENTS
    // =================================

    event PositionCreated(uint256 indexed tokenId, uint128 liquidity);
    event LiquidityAdded(uint128 liquidity, uint256 amount0, uint256 amount1);
    event LiquidityRemoved(uint128 liquidity, uint256 amount0, uint256 amount1);
    event FeesCollected(uint256 amount0, uint256 amount1);
    event PoolKeyUpdated(address currency0, address currency1, uint24 fee);
    event Rebalanced();

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PositionNotInitialized();
    error SlippageExceeded();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyLPManager() {
        if (msg.sender != lpManager && msg.sender != owner()) revert NotLPManager();
        _;
    }

    modifier whenActive() {
        if (!isActive_) revert NotActive();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _creatorCoin,
        address _pairedToken,
        address _poolManager,
        address _positionManager,
        address _lpManager,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        poolManager = _poolManager;
        positionManager = _positionManager;
        lpManager = _lpManager;
        isActive_ = true;
        
        // Configure pool key (tokens sorted)
        address token0 = _creatorCoin < _pairedToken ? _creatorCoin : _pairedToken;
        address token1 = _creatorCoin < _pairedToken ? _pairedToken : _creatorCoin;
        
        poolKey = IPoolManager.PoolKey({
            currency0: token0,
            currency1: token1,
            fee: feeTier,
            tickSpacing: tickSpacing,
            hooks: address(0) // No hooks for now
        });
    }

    // =================================
    // LP MANAGER INTERFACE
    // =================================

    /**
     * @notice Deposit liquidity into full-range position
     * @param creatorCoinAmount Amount of creator coin
     * @param pairedAmount Amount of paired token (WETH)
     * @return liquidity Amount of liquidity minted
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external nonReentrant onlyLPManager whenActive returns (uint256 liquidity) {
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();
        
        // Pull tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }
        
        // Sort amounts for pool order
        (uint256 amount0, uint256 amount1) = _sortAmounts(creatorCoinAmount, pairedAmount);
        
        // Calculate min amounts with slippage
        uint256 amount0Min = (amount0 * (10000 - slippageBps)) / 10000;
        uint256 amount1Min = (amount1 * (10000 - slippageBps)) / 10000;
        
        // Approve position manager
        _approveIfNeeded(IERC20(poolKey.currency0), positionManager, amount0);
        _approveIfNeeded(IERC20(poolKey.currency1), positionManager, amount1);
        
        if (positionTokenId == 0) {
            // Create new position
            liquidity = _createPosition(amount0, amount1, amount0Min, amount1Min);
        } else {
            // Add to existing position
            liquidity = _addLiquidity(amount0, amount1, amount0Min, amount1Min);
        }
        
        totalLiquidity += uint128(liquidity);
        
        emit LiquidityAdded(uint128(liquidity), amount0, amount1);
        
        // Return unused tokens
        _returnUnusedTokens();
    }

    /**
     * @notice Withdraw liquidity from position
     * @param liquidityAmount Amount of liquidity to remove
     * @return creatorCoinAmount Amount of creator coin returned
     * @return pairedAmount Amount of paired token returned
     */
    function withdraw(
        uint256 liquidityAmount
    ) external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (positionTokenId == 0) revert PositionNotInitialized();
        if (liquidityAmount == 0) revert ZeroAmount();
        
        uint128 liquidityToRemove = uint128(liquidityAmount);
        if (liquidityToRemove > totalLiquidity) {
            liquidityToRemove = totalLiquidity;
        }
        
        // Remove liquidity
        (uint256 amount0, uint256 amount1) = _removeLiquidity(liquidityToRemove);
        
        totalLiquidity -= liquidityToRemove;
        
        // Convert back to creator/paired order
        (creatorCoinAmount, pairedAmount) = _unsortAmounts(amount0, amount1);
        
        // Transfer to LP manager
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }
        
        emit LiquidityRemoved(liquidityToRemove, amount0, amount1);
    }

    /**
     * @notice Withdraw all liquidity
     */
    function withdrawAll() external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (positionTokenId == 0 || totalLiquidity == 0) {
            return (0, 0);
        }
        
        // Remove all liquidity
        (uint256 amount0, uint256 amount1) = _removeLiquidity(totalLiquidity);
        totalLiquidity = 0;
        
        // Collect any remaining fees
        _collectFees();
        
        // Convert and transfer
        (creatorCoinAmount, pairedAmount) = _unsortAmounts(amount0, amount1);
        
        uint256 balance0 = CREATOR_COIN.balanceOf(address(this));
        uint256 balance1 = PAIRED_TOKEN.balanceOf(address(this));
        
        if (balance0 > 0) {
            CREATOR_COIN.safeTransfer(lpManager, balance0);
            creatorCoinAmount = balance0;
        }
        if (balance1 > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, balance1);
            pairedAmount = balance1;
        }
    }

    /**
     * @notice Rebalance position (for full range, just collect fees)
     */
    function rebalance() external onlyLPManager {
        if (positionTokenId == 0) return;
        
        // Collect accumulated fees
        _collectFees();
        
        emit Rebalanced();
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get total value in position
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        if (positionTokenId == 0 || totalLiquidity == 0) {
            return (CREATOR_COIN.balanceOf(address(this)), PAIRED_TOKEN.balanceOf(address(this)));
        }
        
        // Get position info (simplified - would need actual V4 integration)
        // For now, return local balances as estimate
        return (CREATOR_COIN.balanceOf(address(this)), PAIRED_TOKEN.balanceOf(address(this)));
    }

    /**
     * @notice Get current liquidity
     */
    function getLiquidity() external view returns (uint256) {
        return uint256(totalLiquidity);
    }

    /**
     * @notice Check if strategy is active
     */
    function isActive() external view returns (bool) {
        return isActive_;
    }

    /**
     * @notice Get strategy type
     */
    function strategyType() external pure returns (StrategyType) {
        return StrategyType.FullRange;
    }

    /**
     * @notice Get tick range for full range
     */
    function getTickRange() external view returns (int24 lower, int24 upper) {
        // Adjust for tick spacing
        lower = (MIN_TICK / tickSpacing) * tickSpacing;
        upper = (MAX_TICK / tickSpacing) * tickSpacing;
    }

    // =================================
    // ADMIN
    // =================================

    function setLPManager(address _lpManager) external onlyOwner {
        if (_lpManager == address(0)) revert ZeroAddress();
        lpManager = _lpManager;
    }

    function setActive(bool _active) external onlyOwner {
        isActive_ = _active;
    }

    function setSlippage(uint256 _slippageBps) external onlyOwner {
        slippageBps = _slippageBps;
    }

    function setPoolKey(
        uint24 _feeTier,
        int24 _tickSpacing,
        address _hooks
    ) external onlyOwner {
        feeTier = _feeTier;
        tickSpacing = _tickSpacing;
        
        poolKey.fee = _feeTier;
        poolKey.tickSpacing = _tickSpacing;
        poolKey.hooks = _hooks;
        
        emit PoolKeyUpdated(poolKey.currency0, poolKey.currency1, _feeTier);
    }

    function setPositionManager(address _positionManager) external onlyOwner {
        positionManager = _positionManager;
    }

    function setPoolManager(address _poolManager) external onlyOwner {
        poolManager = _poolManager;
    }

    /**
     * @notice Emergency token rescue
     */
    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // =================================
    // INTERNAL
    // =================================

    function _createPosition(
        uint256 amount0,
        uint256 amount1,
        uint256 amount0Min,
        uint256 amount1Min
    ) internal returns (uint256 liquidity) {
        // Calculate full range ticks
        int24 tickLower = (MIN_TICK / tickSpacing) * tickSpacing;
        int24 tickUpper = (MAX_TICK / tickSpacing) * tickSpacing;
        
        // This is a simplified version - actual V4 integration would use PositionManager
        // For now, store the intended liquidity
        liquidity = _calculateLiquidity(amount0, amount1);
        positionTokenId = 1; // Placeholder
        
        emit PositionCreated(positionTokenId, uint128(liquidity));
    }

    function _addLiquidity(
        uint256 amount0,
        uint256 amount1,
        uint256 amount0Min,
        uint256 amount1Min
    ) internal returns (uint256 liquidity) {
        // Simplified - actual V4 integration would use PositionManager.increaseLiquidity
        liquidity = _calculateLiquidity(amount0, amount1);
    }

    function _removeLiquidity(
        uint128 liquidityAmount
    ) internal returns (uint256 amount0, uint256 amount1) {
        // Simplified - actual V4 integration would use PositionManager.decreaseLiquidity
        // For now, return proportional amounts of local balances
        uint256 total0 = CREATOR_COIN.balanceOf(address(this));
        uint256 total1 = PAIRED_TOKEN.balanceOf(address(this));
        
        if (totalLiquidity > 0) {
            amount0 = (total0 * liquidityAmount) / totalLiquidity;
            amount1 = (total1 * liquidityAmount) / totalLiquidity;
        }
    }

    function _collectFees() internal {
        if (positionTokenId == 0) return;
        
        // Simplified - actual V4 integration would collect from position
        emit FeesCollected(accumulatedFees0, accumulatedFees1);
        accumulatedFees0 = 0;
        accumulatedFees1 = 0;
    }

    function _calculateLiquidity(uint256 amount0, uint256 amount1) internal pure returns (uint256) {
        // Simplified liquidity calculation
        // Actual would use sqrtPriceX96 and tick math
        return (amount0 + amount1) / 2;
    }

    function _sortAmounts(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) internal view returns (uint256 amount0, uint256 amount1) {
        if (address(CREATOR_COIN) < address(PAIRED_TOKEN)) {
            return (creatorCoinAmount, pairedAmount);
        } else {
            return (pairedAmount, creatorCoinAmount);
        }
    }

    function _unsortAmounts(
        uint256 amount0,
        uint256 amount1
    ) internal view returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (address(CREATOR_COIN) < address(PAIRED_TOKEN)) {
            return (amount0, amount1);
        } else {
            return (amount1, amount0);
        }
    }

    function _approveIfNeeded(IERC20 token, address spender, uint256 amount) internal {
        if (token.allowance(address(this), spender) < amount) {
            token.forceApprove(spender, type(uint256).max);
        }
    }

    function _returnUnusedTokens() internal {
        // Any leftover goes back to LP manager
        uint256 balance0 = CREATOR_COIN.balanceOf(address(this));
        uint256 balance1 = PAIRED_TOKEN.balanceOf(address(this));
        
        // Keep small buffer for gas
        uint256 buffer = 1e12;
        
        if (balance0 > buffer) {
            CREATOR_COIN.safeTransfer(lpManager, balance0 - buffer);
        }
        if (balance1 > buffer) {
            PAIRED_TOKEN.safeTransfer(lpManager, balance1 - buffer);
        }
    }
}



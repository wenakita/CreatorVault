// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LimitOrderLPStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Single-tick LP strategy acting as a limit order for Creator Coins
 * 
 * @dev LIMIT ORDER MECHANISM:
 *      - Positions liquidity 1 tick above OR below current price
 *      - Acts as a price support (below) or resistance (above) level
 *      - Single-sided liquidity that converts when price crosses
 *      - Auto-rebalances to maintain 1-tick offset
 * 
 * @dev USE CASES:
 *      - Price support: Place creator coin 1 tick below to buy dips
 *      - Take profit: Place paired token 1 tick above to sell rallies
 *      - Market making: Tight spread for active trading
 * 
 * @dev REBALANCING:
 *      - Monitors current tick vs position tick
 *      - Repositions when price moves away from our tick
 *      - Configurable tick offset (default: 1 tick spacing)
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
}

interface IV4Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 protocolFee,
        uint24 lpFee
    );
}

contract LimitOrderLPStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // TYPES
    // =================================
    
    enum StrategyType {
        FullRange,
        LimitOrder,
        Concentrated
    }
    
    enum OrderSide {
        BuySupport,   // Place below current price (buy dips)
        SellResistance // Place above current price (sell rallies)
    }

    struct Position {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 createdAt;
        OrderSide side;
    }

    // =================================
    // STATE
    // =================================
    
    /// @notice The Creator Coin token
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice The paired token (WETH)
    IERC20 public immutable PAIRED_TOKEN;
    
    /// @notice Uniswap V4 Pool address
    address public pool;
    
    /// @notice LP Manager that controls this strategy
    address public lpManager;
    
    /// @notice Pool configuration
    IPoolManager.PoolKey public poolKey;
    
    /// @notice Current position
    Position public position;
    
    /// @notice Order side (buy support or sell resistance)
    OrderSide public orderSide = OrderSide.BuySupport;
    
    /// @notice Number of tick spacings to offset from current price
    int24 public tickOffset = 1;
    
    /// @notice Strategy active flag
    bool public isActive_;
    
    /// @notice Slippage protection (basis points)
    uint256 public slippageBps = 100; // 1% for tight positions
    
    /// @notice Fee tier for the pool
    uint24 public feeTier = 3000; // 0.3%
    
    /// @notice Tick spacing
    int24 public tickSpacing = 60;
    
    /// @notice Auto-rebalance when price moves X ticks away
    int24 public rebalanceThreshold = 2;
    
    /// @notice Last rebalance timestamp
    uint256 public lastRebalance;
    
    /// @notice Minimum time between rebalances
    uint256 public rebalanceCooldown = 5 minutes;

    // =================================
    // EVENTS
    // =================================

    event PositionCreated(int24 tickLower, int24 tickUpper, uint128 liquidity, OrderSide side);
    event PositionClosed(int24 tickLower, int24 tickUpper, uint128 liquidity);
    event PositionRebalanced(int24 oldTickLower, int24 oldTickUpper, int24 newTickLower, int24 newTickUpper);
    event LimitOrderFilled(uint256 amount0In, uint256 amount1Out);
    event OrderSideChanged(OrderSide oldSide, OrderSide newSide);
    event TickOffsetUpdated(int24 oldOffset, int24 newOffset);

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PositionNotInitialized();
    error CooldownNotElapsed();
    error InvalidTickOffset();

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
        address _pool,
        address _lpManager,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        pool = _pool;
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
            hooks: address(0)
        });
    }

    // =================================
    // LP MANAGER INTERFACE
    // =================================

    /**
     * @notice Deposit and create limit order position
     * @param creatorCoinAmount Amount of creator coin
     * @param pairedAmount Amount of paired token (WETH)
     * @return liquidity Amount of liquidity in position
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
        
        // Get current tick
        int24 currentTick = _getCurrentTick();
        
        // Calculate limit order tick range (1 tick spacing wide)
        (int24 tickLower, int24 tickUpper) = _calculateLimitOrderTicks(currentTick);
        
        // Close existing position if any
        if (position.liquidity > 0) {
            _closePosition();
        }
        
        // For limit orders, we use single-sided liquidity
        // BuySupport: Only PAIRED_TOKEN (buy creator coin when price drops)
        // SellResistance: Only CREATOR_COIN (sell when price rises)
        uint256 depositAmount;
        if (orderSide == OrderSide.BuySupport) {
            depositAmount = pairedAmount > 0 ? pairedAmount : _swapCreatorToPaired(creatorCoinAmount);
        } else {
            depositAmount = creatorCoinAmount > 0 ? creatorCoinAmount : _swapPairedToCreator(pairedAmount);
        }
        
        // Create new position at calculated ticks
        liquidity = _createLimitOrder(tickLower, tickUpper, depositAmount);
        
        position = Position({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: uint128(liquidity),
            createdAt: block.timestamp,
            side: orderSide
        });
        
        emit PositionCreated(tickLower, tickUpper, uint128(liquidity), orderSide);
        
        // Return unused tokens
        _returnUnusedTokens();
    }

    /**
     * @notice Withdraw from limit order position
     * @param liquidityAmount Amount of liquidity to remove
     * @return creatorCoinAmount Amount of creator coin returned
     * @return pairedAmount Amount of paired token returned
     */
    function withdraw(
        uint256 liquidityAmount
    ) external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (position.liquidity == 0) revert PositionNotInitialized();
        if (liquidityAmount == 0) revert ZeroAmount();
        
        uint128 liquidityToRemove = uint128(liquidityAmount);
        if (liquidityToRemove > position.liquidity) {
            liquidityToRemove = position.liquidity;
        }
        
        // Remove liquidity
        (uint256 amount0, uint256 amount1) = _removeLiquidity(liquidityToRemove);
        
        position.liquidity -= liquidityToRemove;
        
        // Convert to creator/paired order
        (creatorCoinAmount, pairedAmount) = _unsortAmounts(amount0, amount1);
        
        // Transfer to LP manager
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }
    }

    /**
     * @notice Withdraw all liquidity
     */
    function withdrawAll() external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (position.liquidity == 0) {
            return (0, 0);
        }
        
        _closePosition();
        
        // Transfer all balances
        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this));
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this));
        
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }
    }

    /**
     * @notice Rebalance position to maintain tick offset from current price
     * @dev Called when price moves away from our limit order
     */
    function rebalance() external onlyLPManager {
        if (position.liquidity == 0) return;
        if (block.timestamp < lastRebalance + rebalanceCooldown) {
            revert CooldownNotElapsed();
        }
        
        int24 currentTick = _getCurrentTick();
        
        // Check if rebalance is needed
        int24 tickDiff;
        if (orderSide == OrderSide.BuySupport) {
            // For buy support, our position should be below current price
            tickDiff = currentTick - position.tickUpper;
        } else {
            // For sell resistance, our position should be above current price
            tickDiff = position.tickLower - currentTick;
        }
        
        // Only rebalance if price moved significantly away
        if (tickDiff < rebalanceThreshold * tickSpacing) {
            return; // No rebalance needed
        }
        
        // Check if order was filled (price crossed our position)
        bool wasFilled = _checkIfFilled(currentTick);
        
        if (wasFilled) {
            emit LimitOrderFilled(0, 0); // Would include actual amounts
        }
        
        // Calculate new tick range
        (int24 newTickLower, int24 newTickUpper) = _calculateLimitOrderTicks(currentTick);
        
        // Store old ticks for event
        int24 oldTickLower = position.tickLower;
        int24 oldTickUpper = position.tickUpper;
        
        // Close old position
        _closePosition();
        
        // Get available balance for new position
        uint256 availableAmount;
        if (orderSide == OrderSide.BuySupport) {
            availableAmount = PAIRED_TOKEN.balanceOf(address(this));
        } else {
            availableAmount = CREATOR_COIN.balanceOf(address(this));
        }
        
        if (availableAmount > 0) {
            // Create new position at new ticks
            uint256 newLiquidity = _createLimitOrder(newTickLower, newTickUpper, availableAmount);
            
            position = Position({
                tickLower: newTickLower,
                tickUpper: newTickUpper,
                liquidity: uint128(newLiquidity),
                createdAt: block.timestamp,
                side: orderSide
            });
        }
        
        lastRebalance = block.timestamp;
        
        emit PositionRebalanced(oldTickLower, oldTickUpper, newTickLower, newTickUpper);
    }

    // =================================
    // ORDER CONFIGURATION
    // =================================

    /**
     * @notice Set order side (buy support or sell resistance)
     */
    function setOrderSide(OrderSide _side) external onlyOwner {
        OrderSide oldSide = orderSide;
        orderSide = _side;
        emit OrderSideChanged(oldSide, _side);
    }

    /**
     * @notice Set tick offset from current price
     * @param _offset Number of tick spacings to offset (1 = adjacent tick)
     */
    function setTickOffset(int24 _offset) external onlyOwner {
        if (_offset < 1) revert InvalidTickOffset();
        int24 oldOffset = tickOffset;
        tickOffset = _offset;
        emit TickOffsetUpdated(oldOffset, _offset);
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get total value in position
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        // Return local balances as value
        creatorCoinValue = CREATOR_COIN.balanceOf(address(this));
        pairedValue = PAIRED_TOKEN.balanceOf(address(this));
    }

    /**
     * @notice Get current liquidity
     */
    function getLiquidity() external view returns (uint256) {
        return uint256(position.liquidity);
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
        return StrategyType.LimitOrder;
    }

    /**
     * @notice Get current position info
     */
    function getPositionInfo() external view returns (
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 createdAt,
        OrderSide side
    ) {
        return (
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            position.createdAt,
            position.side
        );
    }

    /**
     * @notice Check if rebalance is needed
     */
    function needsRebalance() external view returns (bool) {
        if (position.liquidity == 0) return false;
        
        int24 currentTick = _getCurrentTick();
        int24 tickDiff;
        
        if (orderSide == OrderSide.BuySupport) {
            tickDiff = currentTick - position.tickUpper;
        } else {
            tickDiff = position.tickLower - currentTick;
        }
        
        return tickDiff >= rebalanceThreshold * tickSpacing;
    }

    /**
     * @notice Preview limit order tick range for current price
     */
    function previewLimitOrderTicks() external view returns (int24 tickLower, int24 tickUpper) {
        int24 currentTick = _getCurrentTick();
        return _calculateLimitOrderTicks(currentTick);
    }

    // =================================
    // ADMIN
    // =================================

    function setLPManager(address _lpManager) external onlyOwner {
        if (_lpManager == address(0)) revert ZeroAddress();
        lpManager = _lpManager;
    }

    function setPool(address _pool) external onlyOwner {
        pool = _pool;
    }

    function setActive(bool _active) external onlyOwner {
        isActive_ = _active;
    }

    function setSlippage(uint256 _slippageBps) external onlyOwner {
        slippageBps = _slippageBps;
    }

    function setRebalanceThreshold(int24 _threshold) external onlyOwner {
        rebalanceThreshold = _threshold;
    }

    function setRebalanceCooldown(uint256 _cooldown) external onlyOwner {
        rebalanceCooldown = _cooldown;
    }

    function setPoolConfig(uint24 _feeTier, int24 _tickSpacing) external onlyOwner {
        feeTier = _feeTier;
        tickSpacing = _tickSpacing;
        poolKey.fee = _feeTier;
        poolKey.tickSpacing = _tickSpacing;
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // =================================
    // INTERNAL
    // =================================

    /**
     * @notice Calculate limit order tick range based on current price
     * @dev Places liquidity 1 tick spacing above or below current price
     */
    function _calculateLimitOrderTicks(
        int24 currentTick
    ) internal view returns (int24 tickLower, int24 tickUpper) {
        // Round to tick spacing
        int24 roundedTick = (currentTick / tickSpacing) * tickSpacing;
        
        if (orderSide == OrderSide.BuySupport) {
            // Place BELOW current price (buy when price drops)
            tickUpper = roundedTick - (tickOffset * tickSpacing);
            tickLower = tickUpper - tickSpacing;
        } else {
            // Place ABOVE current price (sell when price rises)
            tickLower = roundedTick + (tickOffset * tickSpacing);
            tickUpper = tickLower + tickSpacing;
        }
    }

    function _getCurrentTick() internal view returns (int24 tick) {
        if (pool == address(0)) return 0;
        
        try IV4Pool(pool).slot0() returns (
            uint160,
            int24 _tick,
            uint16,
            uint24
        ) {
            tick = _tick;
        } catch {
            tick = 0;
        }
    }

    function _checkIfFilled(int24 currentTick) internal view returns (bool) {
        if (orderSide == OrderSide.BuySupport) {
            // Filled if price dropped through our range
            return currentTick < position.tickLower;
        } else {
            // Filled if price rose through our range
            return currentTick > position.tickUpper;
        }
    }

    function _createLimitOrder(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount
    ) internal returns (uint256 liquidity) {
        // Simplified - actual V4 integration would mint position
        liquidity = amount; // 1:1 for simplicity
    }

    function _removeLiquidity(
        uint128 liquidityAmount
    ) internal returns (uint256 amount0, uint256 amount1) {
        // Simplified - actual V4 integration would remove from position
        uint256 total0 = CREATOR_COIN.balanceOf(address(this));
        uint256 total1 = PAIRED_TOKEN.balanceOf(address(this));
        
        if (position.liquidity > 0) {
            amount0 = (total0 * liquidityAmount) / position.liquidity;
            amount1 = (total1 * liquidityAmount) / position.liquidity;
        }
    }

    function _closePosition() internal {
        if (position.liquidity > 0) {
            emit PositionClosed(position.tickLower, position.tickUpper, position.liquidity);
            position.liquidity = 0;
        }
    }

    function _swapCreatorToPaired(uint256 amount) internal returns (uint256) {
        // Simplified - would use router
        return amount;
    }

    function _swapPairedToCreator(uint256 amount) internal returns (uint256) {
        // Simplified - would use router
        return amount;
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

    function _returnUnusedTokens() internal {
        uint256 balance0 = CREATOR_COIN.balanceOf(address(this));
        uint256 balance1 = PAIRED_TOKEN.balanceOf(address(this));
        
        uint256 buffer = 1e12;
        
        if (balance0 > buffer) {
            CREATOR_COIN.safeTransfer(lpManager, balance0 - buffer);
        }
        if (balance1 > buffer) {
            PAIRED_TOKEN.safeTransfer(lpManager, balance1 - buffer);
        }
    }
}



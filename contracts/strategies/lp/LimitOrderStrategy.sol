// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LimitOrderStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Single-tick liquidity positions that act as limit orders
 * 
 * @dev STRATEGY:
 *      - Places liquidity in a single tick (or very narrow range)
 *      - Acts as a limit order: gets filled when price crosses the tick
 *      - Used for price support (buy walls) or resistance (sell walls)
 *      - Higher capital efficiency within the specific tick
 * 
 * @dev USE CASES:
 *      1. BUY SUPPORT: Place below current price - buys creator coin when price drops
 *      2. SELL RESISTANCE: Place above current price - sells creator coin when price rises
 * 
 * @dev INTEGRATION:
 *      - Plugs into CreatorLPManager
 *      - Multiple limit order positions can be active simultaneously
 */

enum StrategyType {
    FullRange,
    LimitOrder,
    Concentrated
}

struct LimitOrder {
    int24 tickLower;
    int24 tickUpper;
    uint256 liquidity;
    uint256 tokenId;           // V4 position NFT
    bool isBuyOrder;           // true = support (below price), false = resistance (above price)
    uint256 createdAt;
    bool isActive;
}

contract LimitOrderStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // CONSTANTS
    // =================================

    /// @notice Maximum number of active limit orders
    uint256 public constant MAX_ORDERS = 10;

    /// @notice Tick spacing (depends on pool fee tier)
    int24 public tickSpacing = 60; // 0.3% fee tier default

    // =================================
    // STATE
    // =================================

    /// @notice Creator Coin token
    IERC20 public immutable CREATOR_COIN;

    /// @notice Paired token (WETH)
    IERC20 public immutable PAIRED_TOKEN;

    /// @notice LP Manager that controls this strategy
    address public lpManager;

    /// @notice Uniswap V4 Pool Manager
    address public poolManager;

    /// @notice Uniswap V4 Position Manager
    address public positionManager;

    /// @notice Pool ID
    bytes32 public poolId;

    /// @notice All limit orders
    LimitOrder[] public orders;

    /// @notice Total liquidity across all orders
    uint256 public totalLiquidity;

    /// @notice Whether strategy is active
    bool public isActive_ = true;

    /// @notice Emergency mode flag
    bool public isEmergencyMode;

    /// @notice Default tick offset from current price for new orders
    int24 public defaultTickOffset = 100; // ~1% from current price

    // =================================
    // EVENTS
    // =================================

    event OrderCreated(uint256 indexed orderId, int24 tickLower, int24 tickUpper, uint256 liquidity, bool isBuyOrder);
    event OrderFilled(uint256 indexed orderId, uint256 amountIn, uint256 amountOut);
    event OrderCancelled(uint256 indexed orderId, uint256 creatorCoinReturned, uint256 pairedReturned);
    event Deposited(uint256 creatorCoinAmount, uint256 pairedAmount, uint256 liquidity);
    event Withdrawn(uint256 liquidity, uint256 creatorCoinAmount, uint256 pairedAmount);
    event Rebalanced(uint256 timestamp, uint256 ordersMoved);
    event PoolConfigured(bytes32 poolId);

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
    error TooManyOrders();
    error OrderNotFound();
    error InvalidTick();
    error InsufficientLiquidity();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyLPManager() {
        if (msg.sender != lpManager && msg.sender != owner()) revert NotLPManager();
        _;
    }

    modifier whenActive() {
        if (!isActive_ || isEmergencyMode) revert NotActive();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _creatorCoin,
        address _pairedToken,
        address _lpManager,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();

        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        lpManager = _lpManager;
    }

    // =================================
    // CONFIGURATION
    // =================================

    function configurePool(
        address _poolManager,
        address _positionManager,
        bytes32 _poolId,
        int24 _tickSpacing
    ) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        positionManager = _positionManager;
        poolId = _poolId;
        tickSpacing = _tickSpacing;

        // Approve position manager
        CREATOR_COIN.forceApprove(_positionManager, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_positionManager, type(uint256).max);

        emit PoolConfigured(_poolId);
    }

    // =================================
    // ORDER MANAGEMENT
    // =================================

    /**
     * @notice Create a new limit order
     * @param tickLower Lower tick bound
     * @param tickUpper Upper tick bound (tickLower + tickSpacing for single-tick)
     * @param amount Amount of token to provide
     * @param isBuyOrder True for buy support, false for sell resistance
     */
    function createOrder(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount,
        bool isBuyOrder
    ) external onlyLPManager whenActive returns (uint256 orderId, uint256 liquidity) {
        if (poolId == bytes32(0)) revert PoolNotConfigured();
        if (_getActiveOrderCount() >= MAX_ORDERS) revert TooManyOrders();
        if (amount == 0) revert ZeroAmount();

        // Validate ticks
        if (tickLower >= tickUpper) revert InvalidTick();
        if (tickLower % tickSpacing != 0 || tickUpper % tickSpacing != 0) revert InvalidTick();

        // Pull tokens based on order type
        if (isBuyOrder) {
            // Buy order: provide paired token (WETH) to buy creator coin
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        } else {
            // Sell order: provide creator coin to sell for paired token
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), amount);
        }

        // Calculate liquidity
        liquidity = _calculateLiquidityForAmount(amount, tickLower, tickUpper);

        // Create V4 position
        // TODO: Call V4 position manager
        // uint256 tokenId = _mintPosition(tickLower, tickUpper, amount, isBuyOrder);

        orderId = orders.length;
        orders.push(LimitOrder({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            tokenId: 0, // Will be set when V4 integration is complete
            isBuyOrder: isBuyOrder,
            createdAt: block.timestamp,
            isActive: true
        }));

        totalLiquidity += liquidity;

        emit OrderCreated(orderId, tickLower, tickUpper, liquidity, isBuyOrder);
    }

    /**
     * @notice Cancel an existing order
     * @param orderId Order ID to cancel
     */
    function cancelOrder(
        uint256 orderId
    ) external onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (orderId >= orders.length) revert OrderNotFound();
        
        LimitOrder storage order = orders[orderId];
        if (!order.isActive) revert OrderNotFound();

        // Remove liquidity from V4
        // (creatorCoinAmount, pairedAmount) = _removeLiquidity(order.tokenId);

        // Simplified: return based on order type
        (creatorCoinAmount, pairedAmount) = _estimateOrderValue(order);

        totalLiquidity -= order.liquidity;
        order.isActive = false;
        order.liquidity = 0;

        // Transfer tokens back
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }

        emit OrderCancelled(orderId, creatorCoinAmount, pairedAmount);
    }

    // =================================
    // ILPStrategy INTERFACE
    // =================================

    /**
     * @notice Deposit creates a new limit order at default offset
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external nonReentrant onlyLPManager whenActive returns (uint256 liquidity) {
        if (poolId == bytes32(0)) revert PoolNotConfigured();
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

        // Create buy order (below price) with paired token
        if (pairedAmount > 0) {
            int24 buyTick = _roundDownToSpacing(currentTick - defaultTickOffset);
            uint256 buyLiquidity = _calculateLiquidityForAmount(pairedAmount, buyTick, buyTick + tickSpacing);
            
            orders.push(LimitOrder({
                tickLower: buyTick,
                tickUpper: buyTick + tickSpacing,
                liquidity: buyLiquidity,
                tokenId: 0,
                isBuyOrder: true,
                createdAt: block.timestamp,
                isActive: true
            }));
            
            liquidity += buyLiquidity;
        }

        // Create sell order (above price) with creator coin
        if (creatorCoinAmount > 0) {
            int24 sellTick = _roundDownToSpacing(currentTick + defaultTickOffset);
            uint256 sellLiquidity = _calculateLiquidityForAmount(creatorCoinAmount, sellTick, sellTick + tickSpacing);
            
            orders.push(LimitOrder({
                tickLower: sellTick,
                tickUpper: sellTick + tickSpacing,
                liquidity: sellLiquidity,
                tokenId: 0,
                isBuyOrder: false,
                createdAt: block.timestamp,
                isActive: true
            }));
            
            liquidity += sellLiquidity;
        }

        totalLiquidity += liquidity;

        emit Deposited(creatorCoinAmount, pairedAmount, liquidity);
    }

    /**
     * @notice Withdraw proportionally from all active orders
     */
    function withdraw(
        uint256 liquidity
    ) external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (liquidity == 0) revert ZeroAmount();
        if (liquidity > totalLiquidity) revert InsufficientLiquidity();

        uint256 remainingLiquidity = liquidity;

        // Cancel orders starting from oldest until we've withdrawn enough
        for (uint256 i = 0; i < orders.length && remainingLiquidity > 0; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            uint256 orderLiquidity = order.liquidity;
            uint256 toWithdraw = orderLiquidity < remainingLiquidity ? orderLiquidity : remainingLiquidity;

            (uint256 creator, uint256 paired) = _estimateOrderValue(order);
            
            // Proportional withdrawal
            uint256 creatorWithdrawn = (creator * toWithdraw) / orderLiquidity;
            uint256 pairedWithdrawn = (paired * toWithdraw) / orderLiquidity;

            creatorCoinAmount += creatorWithdrawn;
            pairedAmount += pairedWithdrawn;

            if (toWithdraw == orderLiquidity) {
                order.isActive = false;
                order.liquidity = 0;
            } else {
                order.liquidity -= toWithdraw;
            }

            remainingLiquidity -= toWithdraw;
        }

        totalLiquidity -= liquidity;

        // Transfer tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }

        emit Withdrawn(liquidity, creatorCoinAmount, pairedAmount);
    }

    /**
     * @notice Withdraw all liquidity
     */
    function withdrawAll() external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (totalLiquidity == 0) return (0, 0);

        for (uint256 i = 0; i < orders.length; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            (uint256 creator, uint256 paired) = _estimateOrderValue(order);
            creatorCoinAmount += creator;
            pairedAmount += paired;

            order.isActive = false;
            order.liquidity = 0;
        }

        uint256 withdrawn = totalLiquidity;
        totalLiquidity = 0;

        // Transfer tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }

        emit Withdrawn(withdrawn, creatorCoinAmount, pairedAmount);
    }

    /**
     * @notice Rebalance: move filled/stale orders to optimal ticks
     */
    function rebalance() external onlyLPManager whenActive {
        int24 currentTick = _getCurrentTick();
        uint256 ordersMoved = 0;

        for (uint256 i = 0; i < orders.length; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            // Check if order is filled (price has crossed through it)
            bool isFilled = _isOrderFilled(order, currentTick);
            
            if (isFilled) {
                // TODO: Collect filled order, create new order at new optimal tick
                // For now, just mark metrics
                ordersMoved++;
            }
        }

        emit Rebalanced(block.timestamp, ordersMoved);
    }

    /**
     * @notice Get total value
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        for (uint256 i = 0; i < orders.length; i++) {
            if (!orders[i].isActive) continue;
            
            (uint256 creator, uint256 paired) = _estimateOrderValue(orders[i]);
            creatorCoinValue += creator;
            pairedValue += paired;
        }

        // Add local balances
        creatorCoinValue += CREATOR_COIN.balanceOf(address(this));
        pairedValue += PAIRED_TOKEN.balanceOf(address(this));
    }

    function getLiquidity() external view returns (uint256) {
        return totalLiquidity;
    }

    function isActive() external view returns (bool) {
        return isActive_ && !isEmergencyMode;
    }

    function strategyType() external pure returns (StrategyType) {
        return StrategyType.LimitOrder;
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    function getOrder(uint256 orderId) external view returns (LimitOrder memory) {
        return orders[orderId];
    }

    function getActiveOrders() external view returns (LimitOrder[] memory activeOrders) {
        uint256 count = _getActiveOrderCount();
        activeOrders = new LimitOrder[](count);
        
        uint256 idx = 0;
        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].isActive) {
                activeOrders[idx] = orders[i];
                idx++;
            }
        }
    }

    function getOrderCount() external view returns (uint256 total, uint256 active) {
        total = orders.length;
        active = _getActiveOrderCount();
    }

    // =================================
    // INTERNAL
    // =================================

    function _getActiveOrderCount() internal view returns (uint256 count) {
        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].isActive) count++;
        }
    }

    function _getCurrentTick() internal view returns (int24) {
        // TODO: Get from V4 pool state
        // For now return 0
        return 0;
    }

    function _roundDownToSpacing(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _calculateLiquidityForAmount(
        uint256 amount,
        int24, /* tickLower */
        int24  /* tickUpper */
    ) internal pure returns (uint256) {
        // Simplified - in production use V4's math
        return amount;
    }

    function _estimateOrderValue(
        LimitOrder storage order
    ) internal view returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        // Simplified estimation based on order type
        // In production, query actual position from V4
        if (order.isBuyOrder) {
            // Buy orders hold paired token
            pairedAmount = order.liquidity;
        } else {
            // Sell orders hold creator coin
            creatorCoinAmount = order.liquidity;
        }
    }

    function _isOrderFilled(
        LimitOrder storage order,
        int24 currentTick
    ) internal view returns (bool) {
        if (order.isBuyOrder) {
            // Buy order filled if price dropped below it
            return currentTick < order.tickLower;
        } else {
            // Sell order filled if price rose above it
            return currentTick > order.tickUpper;
        }
    }

    // =================================
    // ADMIN
    // =================================

    function setLPManager(address _lpManager) external onlyOwner {
        if (_lpManager == address(0)) revert ZeroAddress();
        lpManager = _lpManager;
    }

    function setDefaultTickOffset(int24 _offset) external onlyOwner {
        defaultTickOffset = _offset;
    }

    function setActive(bool _active) external onlyOwner {
        isActive_ = _active;
    }

    function enableEmergencyMode() external onlyOwner {
        isEmergencyMode = true;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
        uint256 pairedBal = PAIRED_TOKEN.balanceOf(address(this));

        if (creatorBal > 0) {
            CREATOR_COIN.safeTransfer(owner(), creatorBal);
        }
        if (pairedBal > 0) {
            PAIRED_TOKEN.safeTransfer(owner(), pairedBal);
        }
    }
}


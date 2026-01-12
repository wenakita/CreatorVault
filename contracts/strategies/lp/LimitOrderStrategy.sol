// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {V4LiquidityAmounts} from "../../libraries/V4LiquidityAmounts.sol";

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
    using StateLibrary for IPoolManager;

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

    /// @notice Uniswap V4 PoolManager (holds all pools)
    IPoolManager public poolManager;

    /// @notice Uniswap V4 pool key (defines currencies/fee/tickSpacing/hooks)
    PoolKey public poolKey;

    /// @notice Uniswap V4 pool id (derived from poolKey)
    PoolId public poolId;

    /// @notice True if CREATOR_COIN is currency0 for poolKey
    bool public creatorIsCurrency0;

    /// @notice Uniswap V4 PositionManager (PosM)
    address public positionManager;

    /// @notice Permit2 contract used by PosM for token pulls into PoolManager
    address public permit2;

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
    event PoolConfigured(bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0);

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
    error PoolNotFullyConfigured();

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

    function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
        external
        onlyOwner
    {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();
        if (_permit2 == address(0)) revert ZeroAddress();

        // Validate poolKey currencies match our configured tokens
        address c0 = Currency.unwrap(_poolKey.currency0);
        address c1 = Currency.unwrap(_poolKey.currency1);
        bool _creatorIsCurrency0 = c0 == address(CREATOR_COIN);
        if (
            !(
                (_creatorIsCurrency0 && c1 == address(PAIRED_TOKEN)) || (c0 == address(PAIRED_TOKEN) && c1 == address(CREATOR_COIN))
            )
        ) revert PoolNotFullyConfigured();
        if (_poolKey.tickSpacing == 0) revert PoolNotFullyConfigured();

        poolManager = IPoolManager(_poolManager);
        positionManager = _positionManager;
        permit2 = _permit2;
        poolKey = _poolKey;
        poolId = _poolKey.toId();
        creatorIsCurrency0 = _creatorIsCurrency0;
        tickSpacing = _poolKey.tickSpacing;

        // Approvals for PosM: token -> Permit2, then Permit2 -> PosM
        CREATOR_COIN.forceApprove(_permit2, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2).approve(address(CREATOR_COIN), _positionManager, type(uint160).max, type(uint48).max);
        IAllowanceTransfer(_permit2).approve(address(PAIRED_TOKEN), _positionManager, type(uint160).max, type(uint48).max);

        emit PoolConfigured(PoolId.unwrap(poolId), _poolManager, _positionManager, _permit2, _creatorIsCurrency0);
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
        _requireConfigured();
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

        uint128 liq = _liquidityForSingleSidedAmount(amount, tickLower, tickUpper, isBuyOrder);
        if (liq == 0) revert ZeroAmount();

        uint256 tokenId = IPositionManager(positionManager).nextTokenId();
        _posmMint(tickLower, tickUpper, liq);

        orderId = orders.length;
        orders.push(LimitOrder({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: uint256(liq),
            tokenId: tokenId,
            isBuyOrder: isBuyOrder,
            createdAt: block.timestamp,
            isActive: true
        }));

        liquidity = uint256(liq);
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

        _requireConfigured();

        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        _posmBurn(order.tokenId);

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

        totalLiquidity -= order.liquidity;
        order.isActive = false;
        order.liquidity = 0;
        order.tokenId = 0;

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
        _requireConfigured();
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
            uint128 buyLiquidity = _liquidityForSingleSidedAmount(pairedAmount, buyTick, buyTick + tickSpacing, true);
            if (buyLiquidity > 0) {
                uint256 tokenId = IPositionManager(positionManager).nextTokenId();
                _posmMint(buyTick, buyTick + tickSpacing, buyLiquidity);
            
                orders.push(LimitOrder({
                    tickLower: buyTick,
                    tickUpper: buyTick + tickSpacing,
                    liquidity: uint256(buyLiquidity),
                    tokenId: tokenId,
                    isBuyOrder: true,
                    createdAt: block.timestamp,
                    isActive: true
                }));
            
                liquidity += uint256(buyLiquidity);
            }
        }

        // Create sell order (above price) with creator coin
        if (creatorCoinAmount > 0) {
            int24 sellTick = _roundDownToSpacing(currentTick + defaultTickOffset);
            uint128 sellLiquidity = _liquidityForSingleSidedAmount(creatorCoinAmount, sellTick, sellTick + tickSpacing, false);
            if (sellLiquidity > 0) {
                uint256 tokenId = IPositionManager(positionManager).nextTokenId();
                _posmMint(sellTick, sellTick + tickSpacing, sellLiquidity);
            
                orders.push(LimitOrder({
                    tickLower: sellTick,
                    tickUpper: sellTick + tickSpacing,
                    liquidity: uint256(sellLiquidity),
                    tokenId: tokenId,
                    isBuyOrder: false,
                    createdAt: block.timestamp,
                    isActive: true
                }));
            
                liquidity += uint256(sellLiquidity);
            }
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

        _requireConfigured();

        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        uint256 remainingLiquidity = liquidity;

        // Cancel orders starting from oldest until we've withdrawn enough
        for (uint256 i = 0; i < orders.length && remainingLiquidity > 0; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            uint256 orderLiquidity = order.liquidity;
            uint256 toWithdraw = orderLiquidity < remainingLiquidity ? orderLiquidity : remainingLiquidity;

            if (toWithdraw == orderLiquidity) {
                _posmBurn(order.tokenId);
                order.isActive = false;
                order.liquidity = 0;
                order.tokenId = 0;
            } else {
                _posmDecrease(order.tokenId, uint128(toWithdraw));
                order.liquidity -= toWithdraw;
            }

            remainingLiquidity -= toWithdraw;
        }

        totalLiquidity -= liquidity;

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

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

        _requireConfigured();
        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        for (uint256 i = 0; i < orders.length; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            _posmBurn(order.tokenId);

            order.isActive = false;
            order.liquidity = 0;
            order.tokenId = 0;
        }

        uint256 withdrawn = totalLiquidity;
        totalLiquidity = 0;

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

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
        _requireConfigured();
        int24 currentTick = _getCurrentTick();
        uint256 ordersMoved = 0;

        for (uint256 i = 0; i < orders.length; i++) {
            LimitOrder storage order = orders[i];
            if (!order.isActive) continue;

            // Check if order is filled (price has crossed through it)
            bool isFilled = _isOrderFilled(order, currentTick);
            
            if (isFilled) {
                // Conservative behavior: unwind filled orders (burn+collect), leave proceeds idle.
                if (order.tokenId != 0) {
                    _posmBurn(order.tokenId);
                }
                totalLiquidity -= order.liquidity;
                order.isActive = false;
                order.liquidity = 0;
                order.tokenId = 0;
                ordersMoved++;
            }
        }

        emit Rebalanced(block.timestamp, ordersMoved);
    }

    /**
     * @notice Get total value
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        if (address(poolManager) != address(0) && PoolId.unwrap(poolId) != bytes32(0)) {
            (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
            for (uint256 i = 0; i < orders.length; i++) {
                if (!orders[i].isActive) continue;
                uint128 liq = uint128(orders[i].liquidity);
                (uint256 amount0, uint256 amount1) = V4LiquidityAmounts.getAmountsForLiquidity(
                    sqrtPriceX96,
                    TickMath.getSqrtPriceAtTick(orders[i].tickLower),
                    TickMath.getSqrtPriceAtTick(orders[i].tickUpper),
                    liq
                );
                if (creatorIsCurrency0) {
                    creatorCoinValue += amount0;
                    pairedValue += amount1;
                } else {
                    creatorCoinValue += amount1;
                    pairedValue += amount0;
                }
            }
        } else {
        for (uint256 i = 0; i < orders.length; i++) {
            if (!orders[i].isActive) continue;
            
            (uint256 creator, uint256 paired) = _estimateOrderValue(orders[i]);
            creatorCoinValue += creator;
            pairedValue += paired;
        }
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
        _requireConfigured();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        return tick;
    }

    function _requireConfigured() internal view {
        if (address(poolManager) == address(0)) revert PoolNotConfigured();
        if (positionManager == address(0)) revert PoolNotConfigured();
        if (permit2 == address(0)) revert PoolNotConfigured();
        if (PoolId.unwrap(poolId) == bytes32(0)) revert PoolNotConfigured();
    }

    function _liquidityForSingleSidedAmount(uint256 amount, int24 tickLower, int24 tickUpper, bool isBuyOrder)
        internal
        view
        returns (uint128 liquidity)
    {
        // Buy orders supply paired token; sell orders supply creator token.
        bool supplyCreator = !isBuyOrder;
        bool supplyIsCurrency0 = supplyCreator ? creatorIsCurrency0 : !creatorIsCurrency0;

        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        if (supplyIsCurrency0) {
            liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount);
        } else {
            liquidity = LiquidityAmounts.getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount);
        }
    }

    function _posmMint(int24 tickLower, int24 tickUpper, uint128 liquidityToAdd) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(liquidityToAdd),
            type(uint128).max,
            type(uint128).max,
            address(this),
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _posmDecrease(uint256 tokenId, uint128 liquidityToRemove) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(liquidityToRemove), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _posmBurn(uint256 tokenId) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.BURN_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _roundDownToSpacing(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    // _calculateLiquidityForAmount removed in favor of LiquidityAmounts + PosM paths.

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


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ConcentratedStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Concentrated liquidity around current price for maximum capital efficiency
 * 
 * @dev STRATEGY (inspired by Charm Finance Alpha Vaults):
 *      - Provides liquidity in a tight range around current price
 *      - Higher capital efficiency = more fees per dollar of liquidity
 *      - Requires active management to stay in range
 *      - Auto-rebalances when price moves out of range
 * 
 * @dev REBALANCE GUARDS (from Charm):
 *      1. Time-based: Must wait `period` seconds between rebalances
 *      2. Price movement: Must move at least `minTickMove` ticks
 *      3. TWAP deviation: Current price must be within `maxTwapDeviation` of TWAP
 *      4. Boundary check: Price can't be too close to MIN/MAX tick
 * 
 * @dev TWAP PROTECTION:
 *      Prevents flash loan attacks by comparing spot price to time-weighted average
 * 
 * @dev INTEGRATION:
 *      - Plugs into CreatorLPManager
 *      - Most capital efficient but highest maintenance
 */

enum StrategyType {
    FullRange,
    LimitOrder,
    Concentrated
}

/// @notice Minimal interface for V4 pool state
interface IV4PoolState {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint24 protocolFee,
        uint24 lpFee
    );
    function observe(uint32[] calldata secondsAgos) external view returns (
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativeX128s
    );
}

contract ConcentratedStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // CONSTANTS
    // =================================

    uint256 public constant BASIS_POINTS = 10000;
    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;

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

    /// @notice Pool address for TWAP queries
    address public pool;

    /// @notice Pool ID
    bytes32 public poolId;

    /// @notice Tick spacing for the pool
    int24 public tickSpacing = 60;

    /// @notice Current position
    struct Position {
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint256 tokenId;
    }
    Position public position;

    // =================================
    // REBALANCE PARAMETERS (Charm-style)
    // =================================

    /// @notice Range width in ticks (half width each side)
    int24 public baseThreshold = 500; // ~5% each side

    /// @notice Minimum time between rebalances
    uint32 public period = 1 hours;

    /// @notice Minimum tick movement required to trigger rebalance
    int24 public minTickMove = 10;

    /// @notice Maximum allowed deviation from TWAP (anti-manipulation)
    int24 public maxTwapDeviation = 100;

    /// @notice TWAP duration in seconds
    uint32 public twapDuration = 60; // 1 minute

    /// @notice Last rebalance timestamp
    uint256 public lastTimestamp;

    /// @notice Last tick at rebalance
    int24 public lastTick;

    /// @notice Total liquidity
    uint256 public totalLiquidity;

    /// @notice Whether strategy is active
    bool public isActive_ = true;

    /// @notice Emergency mode flag
    bool public isEmergencyMode;

    // =================================
    // EVENTS
    // =================================

    event Deposited(uint256 creatorCoinAmount, uint256 pairedAmount, uint256 liquidity);
    event Withdrawn(uint256 liquidity, uint256 creatorCoinAmount, uint256 pairedAmount);
    event Rebalanced(int24 oldTickLower, int24 oldTickUpper, int24 newTickLower, int24 newTickUpper, int24 tick);
    event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1, uint256 totalSupply);
    event PoolConfigured(bytes32 poolId, address pool);
    event ParametersUpdated(int24 baseThreshold, uint32 period, int24 minTickMove, int24 maxTwapDeviation, uint32 twapDuration);

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
    error InsufficientLiquidity();
    error PeriodNotElapsed();           // PE - time check
    error InsufficientTickMove();       // TM - price movement check
    error TwapDeviationTooHigh();       // TP - TWAP check
    error PriceTooCloseToBoundary();    // PB - boundary check
    error InvalidParameters();

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
        address _pool,
        bytes32 _poolId,
        int24 _tickSpacing
    ) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();
        if (_pool == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        positionManager = _positionManager;
        pool = _pool;
        poolId = _poolId;
        tickSpacing = _tickSpacing;

        // Approve position manager
        CREATOR_COIN.forceApprove(_positionManager, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_positionManager, type(uint256).max);

        emit PoolConfigured(_poolId, _pool);
    }

    /**
     * @notice Set rebalance parameters (Charm-style)
     * @param _baseThreshold Half of the range width in ticks
     * @param _period Minimum time between rebalances
     * @param _minTickMove Minimum tick movement to trigger rebalance
     * @param _maxTwapDeviation Maximum allowed deviation from TWAP
     * @param _twapDuration TWAP calculation window
     */
    function setRebalanceParameters(
        int24 _baseThreshold,
        uint32 _period,
        int24 _minTickMove,
        int24 _maxTwapDeviation,
        uint32 _twapDuration
    ) external onlyOwner {
        if (_baseThreshold <= 0) revert InvalidParameters();
        if (_baseThreshold > MAX_TICK) revert InvalidParameters();
        if (_baseThreshold % tickSpacing != 0) revert InvalidParameters();
        if (_minTickMove < 0) revert InvalidParameters();
        if (_maxTwapDeviation < 0) revert InvalidParameters();
        if (_twapDuration == 0) revert InvalidParameters();

        baseThreshold = _baseThreshold;
        period = _period;
        minTickMove = _minTickMove;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        emit ParametersUpdated(_baseThreshold, _period, _minTickMove, _maxTwapDeviation, _twapDuration);
    }

    // =================================
    // ILPStrategy INTERFACE
    // =================================

    /**
     * @notice Deposit liquidity into concentrated position
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external nonReentrant onlyLPManager whenActive returns (uint256 liquidity) {
        if (pool == address(0)) revert PoolNotConfigured();
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();

        // Pull tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }

        // Calculate optimal range around current price
        int24 currentTick = _getCurrentTick();
        (int24 tickLower, int24 tickUpper) = _calculateRange(currentTick);

        // Calculate liquidity
        liquidity = _calculateLiquidity(creatorCoinAmount, pairedAmount, tickLower, tickUpper);

        if (position.liquidity == 0) {
            // Create new position
            position = Position({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: liquidity,
                tokenId: 0
            });

            lastTimestamp = block.timestamp;
            lastTick = currentTick;

            // TODO: Mint V4 position
            // position.tokenId = _mintPosition(tickLower, tickUpper, liquidity);
        } else {
            // Add to existing position
            position.liquidity += liquidity;

            // TODO: Increase V4 position liquidity
            // _increaseLiquidity(liquidity);
        }

        totalLiquidity += liquidity;

        emit Deposited(creatorCoinAmount, pairedAmount, liquidity);
    }

    /**
     * @notice Withdraw liquidity
     */
    function withdraw(
        uint256 liquidity
    ) external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        if (liquidity == 0) revert ZeroAmount();
        if (liquidity > totalLiquidity) revert InsufficientLiquidity();

        // Calculate amounts
        (creatorCoinAmount, pairedAmount) = _calculateAmountsForLiquidity(liquidity);

        // Decrease position
        position.liquidity -= liquidity;
        totalLiquidity -= liquidity;

        // TODO: Decrease V4 position
        // _decreaseLiquidity(liquidity);

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

        uint256 liquidity = totalLiquidity;

        // Calculate amounts
        (creatorCoinAmount, pairedAmount) = _calculateAmountsForLiquidity(liquidity);

        // Clear position
        position.liquidity = 0;
        totalLiquidity = 0;

        // TODO: Remove V4 position entirely
        // _burnPosition();

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
     * @notice Rebalance position (Charm-style with all guards)
     * @dev Checks: time elapsed, price movement, TWAP deviation, boundary
     */
    function rebalance() external onlyLPManager whenActive {
        if (position.liquidity == 0) return;

        // Run all rebalance checks (reverts if any fail)
        checkCanRebalance();

        int24 currentTick = _getCurrentTick();
        int24 tickFloor = _floor(currentTick);
        int24 tickCeil = tickFloor + tickSpacing;

        // Calculate new range centered on current price
        int24 newTickLower = tickFloor - baseThreshold;
        int24 newTickUpper = tickCeil + baseThreshold;

        int24 oldTickLower = position.tickLower;
        int24 oldTickUpper = position.tickUpper;

        // Emit snapshot before rebalance
        uint256 balance0 = CREATOR_COIN.balanceOf(address(this));
        uint256 balance1 = PAIRED_TOKEN.balanceOf(address(this));
        emit Snapshot(currentTick, balance0, balance1, totalLiquidity);

        // 1. Remove all liquidity from old position
        // 2. Create new position at new range
        // 3. Add liquidity to new position
        
        // TODO: V4 position management
        // _rebalancePosition(newTickLower, newTickUpper);

        position.tickLower = newTickLower;
        position.tickUpper = newTickUpper;
        lastTimestamp = block.timestamp;
        lastTick = currentTick;

        emit Rebalanced(oldTickLower, oldTickUpper, newTickLower, newTickUpper, currentTick);
    }

    /**
     * @notice Check if rebalance can be executed (Charm-style guards)
     * @dev Reverts with specific error if any check fails
     */
    function checkCanRebalance() public view {
        // 1. Check enough time has passed
        if (block.timestamp < lastTimestamp + period) {
            revert PeriodNotElapsed();
        }

        int24 currentTick = _getCurrentTick();

        // 2. Check price has moved enough
        int24 tickMove = currentTick > lastTick 
            ? currentTick - lastTick 
            : lastTick - currentTick;
        if (lastTimestamp != 0 && tickMove < minTickMove) {
            revert InsufficientTickMove();
        }

        // 3. Check price is near TWAP (anti-manipulation)
        int24 twap = getTwap();
        int24 twapDeviation = currentTick > twap 
            ? currentTick - twap 
            : twap - currentTick;
        if (twapDeviation > maxTwapDeviation) {
            revert TwapDeviationTooHigh();
        }

        // 4. Check price is not too close to boundary
        if (currentTick <= MIN_TICK + baseThreshold + tickSpacing ||
            currentTick >= MAX_TICK - baseThreshold - tickSpacing) {
            revert PriceTooCloseToBoundary();
        }
    }

    /**
     * @notice Get time-weighted average price (TWAP) in ticks
     * @dev Queries pool's oracle for historical price data
     */
    function getTwap() public view returns (int24) {
        if (pool == address(0)) return _getCurrentTick();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapDuration;
        secondsAgos[1] = 0;

        try IV4PoolState(pool).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory /* secondsPerLiquidityCumulativeX128s */
        ) {
            return int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(twapDuration)));
        } catch {
            // If observe fails, return current tick
            return _getCurrentTick();
        }
    }

    /**
     * @notice Get total value
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        if (totalLiquidity > 0) {
            (creatorCoinValue, pairedValue) = _calculateAmountsForLiquidity(totalLiquidity);
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
        return StrategyType.Concentrated;
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Check if rebalance would pass all guards
     */
    function canRebalance() external view returns (bool) {
        try this.checkCanRebalance() {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get current position details
     */
    function getPosition() external view returns (
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        uint256 tokenId
    ) {
        return (
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            position.tokenId
        );
    }

    /**
     * @notice Get rebalance status info
     */
    function getRebalanceInfo() external view returns (
        int24 currentTick,
        int24 twap,
        int24 twapDeviation,
        uint256 timeSinceLastRebalance,
        int24 tickMoveSinceLast,
        bool canRebalanceNow
    ) {
        currentTick = _getCurrentTick();
        twap = getTwap();
        twapDeviation = currentTick > twap ? currentTick - twap : twap - currentTick;
        timeSinceLastRebalance = block.timestamp - lastTimestamp;
        tickMoveSinceLast = currentTick > lastTick ? currentTick - lastTick : lastTick - currentTick;
        
        try this.checkCanRebalance() {
            canRebalanceNow = true;
        } catch {
            canRebalanceNow = false;
        }
    }

    // =================================
    // INTERNAL
    // =================================

    function _getCurrentTick() internal view returns (int24) {
        if (pool == address(0)) return 0;
        
        try IV4PoolState(pool).slot0() returns (
            uint160 /* sqrtPriceX96 */,
            int24 tick,
            uint24 /* protocolFee */,
            uint24 /* lpFee */
        ) {
            return tick;
        } catch {
            return 0;
        }
    }

    function _calculateRange(int24 currentTick) internal view returns (int24 tickLower, int24 tickUpper) {
        int24 tickFloor = _floor(currentTick);
        int24 tickCeil = tickFloor + tickSpacing;

        tickLower = tickFloor - baseThreshold;
        tickUpper = tickCeil + baseThreshold;
    }

    /// @dev Rounds tick down towards negative infinity (multiple of tickSpacing)
    function _floor(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _calculateLiquidity(
        uint256 creatorCoinAmount,
        uint256 pairedAmount,
        int24, /* tickLower */
        int24  /* tickUpper */
    ) internal pure returns (uint256) {
        // Simplified - production uses V4 LiquidityAmounts math
        if (creatorCoinAmount == 0 || pairedAmount == 0) {
            return creatorCoinAmount + pairedAmount;
        }
        return _sqrt(creatorCoinAmount * pairedAmount);
    }

    function _calculateAmountsForLiquidity(
        uint256 liquidity
    ) internal view returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        // Simplified - production queries V4 position
        creatorCoinAmount = liquidity / 2;
        pairedAmount = liquidity / 2;
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
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

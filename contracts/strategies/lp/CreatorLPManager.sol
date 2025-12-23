// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreatorLPManager
 * @author 0xakita.eth
 * @notice Manages LP liquidity for CreatorShareOFT (wsAKITA) on Uniswap V4
 * 
 * @dev PURPOSE:
 *      This strategy manages liquidity for the WRAPPED SHARE TOKEN (wsAKITA)
 *      on Uniswap V4 with 6.9% fee hooks for the lottery system.
 * 
 *      NOT for the original Creator Coin - that uses CreatorCharmStrategy on V3.
 * 
 * @dev TOKEN DISTINCTION:
 *      ┌────────────────────────────────────────────────────────────┐
 *      │ AKITA (Creator Coin)  →  CreatorCharmStrategy  →  V3 Pool  │
 *      │ wsAKITA (ShareOFT)    →  CreatorLPManager      →  V4 Pool  │
 *      │                                                  + 6.9% Hook
 *      └────────────────────────────────────────────────────────────┘
 * 
 * @dev WHY V4 FOR SHARE TOKEN:
 *      - V4 hooks enable the 6.9% fee on trades
 *      - Fees feed into the lottery jackpot via GaugeController
 *      - The ShareOFT (wsAKITA) is the primary trading token for the lottery system
 * 
 * @dev ARCHITECTURE (inspired by Charm Alpha Pro Vault):
 *      CreatorOVault → CreatorLPManager → Uniswap V4 Positions
 * 
 * @dev THREE-POSITION STRATEGY:
 *      1. Full Range: Passive liquidity across entire price range
 *      2. Base Order: Concentrated around current price (both sides)
 *      3. Limit Order: Single-sided bid or ask (excess token)
 * 
 * @dev REBALANCE FLOW:
 *      1. Withdraw all liquidity from all positions
 *      2. Place full range order (weighted %)
 *      3. Place base order with remaining liquidity
 *      4. Place limit order with excess token (bid or ask)
 * 
 * @dev REBALANCE GUARDS (from Charm):
 *      - Time: Must wait `period` seconds between rebalances
 *      - Price: Must move at least `minTickMove` ticks
 *      - TWAP: Spot price must be within `maxTwapDeviation` of TWAP
 *      - Boundary: Price can't be too close to MIN/MAX tick
 */

// =================================
// INTERFACES
// =================================

interface IV4Pool {
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
    function tickSpacing() external view returns (int24);
}

interface IV4PositionManager {
    function mint(
        address pool,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        bytes calldata data
    ) external returns (uint256 tokenId);
    
    function burn(
        uint256 tokenId,
        uint128 liquidity
    ) external returns (uint256 amount0, uint256 amount1);
    
    function collect(
        uint256 tokenId
    ) external returns (uint256 amount0, uint256 amount1);
}

contract CreatorLPManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // CONSTANTS
    // =================================

    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;
    uint256 public constant PRECISION = 1e6;

    // =================================
    // STATE - TOKENS & POOL
    // =================================

    /// @notice Creator Coin token (token0 or token1 depending on sort)
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice Paired token (WETH)
    IERC20 public immutable PAIRED_TOKEN;
    
    /// @notice Uniswap V4 Pool
    address public pool;
    
    /// @notice Uniswap V4 Position Manager
    address public positionManager;
    
    /// @notice Vault that owns this manager
    address public vault;
    
    /// @notice Tick spacing of the pool
    int24 public tickSpacing;

    // =================================
    // STATE - POSITIONS (Charm-style)
    // =================================

    /// @notice Full range position (MIN_TICK to MAX_TICK)
    struct PositionInfo {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 tokenId;
    }
    
    PositionInfo public fullRangePosition;
    PositionInfo public basePosition;
    PositionInfo public limitPosition;

    // =================================
    // STATE - PARAMETERS (Charm-style)
    // =================================

    /// @notice Proportion of liquidity in full range (multiplied by 1e6)
    uint24 public fullRangeWeight = 400000; // 40%

    /// @notice Half of the base order width in ticks
    int24 public baseThreshold = 500;

    /// @notice Limit order width in ticks
    int24 public limitThreshold = 100;

    /// @notice Minimum time between rebalances
    uint32 public period = 1 hours;

    /// @notice Minimum tick movement to trigger rebalance
    int24 public minTickMove = 10;

    /// @notice Max deviation from TWAP (anti-manipulation)
    int24 public maxTwapDeviation = 100;

    /// @notice TWAP duration in seconds
    uint32 public twapDuration = 60;

    /// @notice Last rebalance timestamp
    uint256 public lastTimestamp;

    /// @notice Last tick at rebalance
    int24 public lastTick;

    // =================================
    // STATE - FEES
    // =================================

    /// @notice Accrued protocol fees (token0)
    uint256 public accruedFees0;
    
    /// @notice Accrued protocol fees (token1)
    uint256 public accruedFees1;

    /// @notice Fee recipient
    address public feeRecipient;

    // =================================
    // STATE - ACCESS
    // =================================

    /// @notice Managers who can execute rebalance
    mapping(address => bool) public isManager;

    // =================================
    // EVENTS
    // =================================

    event Deposit(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Withdraw(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Rebalanced(int24 tick, uint256 balance0, uint256 balance1);
    event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1);
    event FeesCollected(uint256 fees0, uint256 fees1);
    event ParametersUpdated(uint24 fullRangeWeight, int24 baseThreshold, int24 limitThreshold);
    event PoolConfigured(address pool, address positionManager);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotManager();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
    error PeriodNotElapsed();
    error InsufficientTickMove();
    error TwapDeviationTooHigh();
    error PriceTooCloseToBoundary();
    error InvalidParameters();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVault() {
        if (msg.sender != vault && msg.sender != owner()) revert NotVault();
        _;
    }

    modifier onlyManager() {
        if (!isManager[msg.sender] && msg.sender != owner()) revert NotManager();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _creatorCoin,
        address _pairedToken,
        address _vault,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        vault = _vault;
        
        isManager[_owner] = true;
    }

    // =================================
    // CONFIGURATION
    // =================================

    function configurePool(
        address _pool,
        address _positionManager
    ) external onlyOwner {
        if (_pool == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();

        pool = _pool;
        positionManager = _positionManager;
        tickSpacing = IV4Pool(_pool).tickSpacing();

        // Initialize full range bounds
        fullRangePosition.tickLower = (MIN_TICK / tickSpacing) * tickSpacing;
        fullRangePosition.tickUpper = (MAX_TICK / tickSpacing) * tickSpacing;

        // Approve position manager
        CREATOR_COIN.forceApprove(_positionManager, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_positionManager, type(uint256).max);

        emit PoolConfigured(_pool, _positionManager);
    }

    /**
     * @notice Set strategy parameters (Charm-style)
     */
    function setParameters(
        uint24 _fullRangeWeight,
        int24 _baseThreshold,
        int24 _limitThreshold,
        uint32 _period,
        int24 _minTickMove,
        int24 _maxTwapDeviation,
        uint32 _twapDuration
    ) external onlyOwner {
        if (_fullRangeWeight > PRECISION) revert InvalidParameters();
        if (_baseThreshold <= 0 || _baseThreshold > MAX_TICK) revert InvalidParameters();
        if (_limitThreshold <= 0 || _limitThreshold > MAX_TICK) revert InvalidParameters();
        if (_baseThreshold % tickSpacing != 0) revert InvalidParameters();
        if (_limitThreshold % tickSpacing != 0) revert InvalidParameters();
        if (_minTickMove < 0) revert InvalidParameters();
        if (_maxTwapDeviation < 0) revert InvalidParameters();
        if (_twapDuration == 0) revert InvalidParameters();

        fullRangeWeight = _fullRangeWeight;
        baseThreshold = _baseThreshold;
        limitThreshold = _limitThreshold;
        period = _period;
        minTickMove = _minTickMove;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        emit ParametersUpdated(_fullRangeWeight, _baseThreshold, _limitThreshold);
    }

    // =================================
    // DEPOSIT / WITHDRAW
    // =================================

    /**
     * @notice Deposit tokens (held until next rebalance)
     */
    function deposit(
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant onlyVault returns (uint256 totalLiquidity) {
        if (amount0 == 0 && amount1 == 0) revert ZeroAmount();

        if (amount0 > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), amount1);
        }

        // Liquidity will be deployed on next rebalance
        totalLiquidity = _estimateLiquidity(amount0, amount1);

        emit Deposit(msg.sender, amount0, amount1, totalLiquidity);
    }

    /**
     * @notice Withdraw proportional share from all positions
     */
    function withdraw(
        uint256 shares,
        uint256 totalShares
    ) external nonReentrant onlyVault returns (uint256 amount0, uint256 amount1) {
        if (shares == 0) revert ZeroAmount();

        // Withdraw from each position proportionally
        (uint256 full0, uint256 full1) = _burnLiquidityShare(
            fullRangePosition,
            shares,
            totalShares
        );
        (uint256 base0, uint256 base1) = _burnLiquidityShare(
            basePosition,
            shares,
            totalShares
        );
        (uint256 limit0, uint256 limit1) = _burnLiquidityShare(
            limitPosition,
            shares,
            totalShares
        );

        // Add idle balances proportionally
        uint256 idle0 = (getBalance0() * shares) / totalShares;
        uint256 idle1 = (getBalance1() * shares) / totalShares;

        amount0 = full0 + base0 + limit0 + idle0;
        amount1 = full1 + base1 + limit1 + idle1;

        // Transfer to vault
        if (amount0 > 0) CREATOR_COIN.safeTransfer(vault, amount0);
        if (amount1 > 0) PAIRED_TOKEN.safeTransfer(vault, amount1);

        emit Withdraw(msg.sender, amount0, amount1, shares);
    }

    // =================================
    // REBALANCE (Charm-style)
    // =================================

    /**
     * @notice Rebalance all positions
     * @dev Three-position strategy:
     *      1. Full range (passive)
     *      2. Base order (concentrated around price)
     *      3. Limit order (single-sided with excess)
     */
    function rebalance() external nonReentrant onlyManager {
        if (pool == address(0)) revert PoolNotConfigured();
        
        // Check all rebalance guards
        checkCanRebalance();

        // Withdraw all current liquidity
        _burnAndCollect(fullRangePosition);
        _burnAndCollect(basePosition);
        _burnAndCollect(limitPosition);

        // Get current tick and calculate new ranges
        int24 tick = _getCurrentTick();
        int24 tickFloor = _floor(tick);
        int24 tickCeil = tickFloor + tickSpacing;

        // Calculate new position ranges
        int24 _baseLower = tickFloor - baseThreshold;
        int24 _baseUpper = tickCeil + baseThreshold;
        int24 _bidLower = tickFloor - limitThreshold;
        int24 _bidUpper = tickFloor;
        int24 _askLower = tickCeil;
        int24 _askUpper = tickCeil + limitThreshold;

        // Emit snapshot
        uint256 balance0 = getBalance0();
        uint256 balance1 = getBalance1();
        emit Snapshot(tick, balance0, balance1);

        // 1. Place full range order (weighted %)
        {
            uint128 maxFullLiquidity = _liquidityForAmounts(
                fullRangePosition.tickLower,
                fullRangePosition.tickUpper,
                balance0,
                balance1
            );
            uint128 fullLiquidity = uint128((uint256(maxFullLiquidity) * fullRangeWeight) / PRECISION);
            _mintLiquidity(fullRangePosition, fullLiquidity);
        }

        // 2. Place base order with remaining balance
        balance0 = getBalance0();
        balance1 = getBalance1();
        {
            uint128 baseLiquidity = _liquidityForAmounts(_baseLower, _baseUpper, balance0, balance1);
            basePosition.tickLower = _baseLower;
            basePosition.tickUpper = _baseUpper;
            _mintLiquidity(basePosition, baseLiquidity);
        }

        // 3. Place limit order (bid or ask) depending on which token is excess
        balance0 = getBalance0();
        balance1 = getBalance1();
        {
            uint128 bidLiquidity = _liquidityForAmounts(_bidLower, _bidUpper, balance0, balance1);
            uint128 askLiquidity = _liquidityForAmounts(_askLower, _askUpper, balance0, balance1);
            
            if (bidLiquidity > askLiquidity) {
                // More token1 (WETH) - place bid order below price
                limitPosition.tickLower = _bidLower;
                limitPosition.tickUpper = _bidUpper;
                _mintLiquidity(limitPosition, bidLiquidity);
            } else {
                // More token0 (Creator) - place ask order above price
                limitPosition.tickLower = _askLower;
                limitPosition.tickUpper = _askUpper;
                _mintLiquidity(limitPosition, askLiquidity);
            }
        }

        lastTimestamp = block.timestamp;
        lastTick = tick;

        emit Rebalanced(tick, getBalance0(), getBalance1());
    }

    /**
     * @notice Check if rebalance can be executed
     */
    function checkCanRebalance() public view {
        // 1. Check enough time has passed
        if (block.timestamp < lastTimestamp + period) {
            revert PeriodNotElapsed();
        }

        int24 tick = _getCurrentTick();

        // 2. Check price has moved enough
        int24 tickMove = tick > lastTick ? tick - lastTick : lastTick - tick;
        if (lastTimestamp != 0 && tickMove < minTickMove) {
            revert InsufficientTickMove();
        }

        // 3. Check price is near TWAP
        int24 twap = getTwap();
        int24 deviation = tick > twap ? tick - twap : twap - tick;
        if (deviation > maxTwapDeviation) {
            revert TwapDeviationTooHigh();
        }

        // 4. Check price not too close to boundary
        int24 maxThreshold = baseThreshold > limitThreshold ? baseThreshold : limitThreshold;
        if (tick <= MIN_TICK + maxThreshold + tickSpacing ||
            tick >= MAX_TICK - maxThreshold - tickSpacing) {
            revert PriceTooCloseToBoundary();
        }
    }

    /**
     * @notice Get TWAP price in ticks
     */
    function getTwap() public view returns (int24) {
        if (pool == address(0)) return 0;

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapDuration;
        secondsAgos[1] = 0;

        try IV4Pool(pool).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory /* secondsPerLiquidityCumulativeX128s */
        ) {
            return int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(twapDuration)));
        } catch {
            return _getCurrentTick();
        }
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get total amounts across all positions and idle
     */
    function getTotalAmounts() public view returns (uint256 total0, uint256 total1) {
        (uint256 full0, uint256 full1) = _getPositionAmounts(fullRangePosition);
        (uint256 base0, uint256 base1) = _getPositionAmounts(basePosition);
        (uint256 limit0, uint256 limit1) = _getPositionAmounts(limitPosition);
        
        total0 = getBalance0() + full0 + base0 + limit0;
        total1 = getBalance1() + full1 + base1 + limit1;
    }

    /**
     * @notice Idle balance of token0
     */
    function getBalance0() public view returns (uint256) {
        return CREATOR_COIN.balanceOf(address(this)) - accruedFees0;
    }

    /**
     * @notice Idle balance of token1
     */
    function getBalance1() public view returns (uint256) {
        return PAIRED_TOKEN.balanceOf(address(this)) - accruedFees1;
    }

    /**
     * @notice Check if rebalance is possible
     */
    function canRebalance() external view returns (bool) {
        try this.checkCanRebalance() {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get position info
     */
    function getPositions() external view returns (
        PositionInfo memory fullRange,
        PositionInfo memory base,
        PositionInfo memory limit
    ) {
        return (fullRangePosition, basePosition, limitPosition);
    }

    // =================================
    // INTERNAL - LIQUIDITY
    // =================================

    function _getCurrentTick() internal view returns (int24) {
        if (pool == address(0)) return 0;
        (, int24 tick, , ) = IV4Pool(pool).slot0();
        return tick;
    }

    function _floor(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _mintLiquidity(PositionInfo storage pos, uint128 liquidity) internal {
        if (liquidity == 0) return;
        
        // TODO: Actual V4 mint call
        // pos.tokenId = IV4PositionManager(positionManager).mint(
        //     pool, pos.tickLower, pos.tickUpper, liquidity, ""
        // );
        
        pos.liquidity = liquidity;
    }

    function _burnAndCollect(PositionInfo storage pos) internal returns (uint256 amount0, uint256 amount1) {
        if (pos.liquidity == 0) return (0, 0);

        // TODO: Actual V4 burn and collect
        // (amount0, amount1) = IV4PositionManager(positionManager).burn(pos.tokenId, pos.liquidity);
        // IV4PositionManager(positionManager).collect(pos.tokenId);

        pos.liquidity = 0;
    }

    function _burnLiquidityShare(
        PositionInfo storage pos,
        uint256 shares,
        uint256 totalShares
    ) internal returns (uint256 amount0, uint256 amount1) {
        if (pos.liquidity == 0) return (0, 0);

        uint128 liquidityToBurn = uint128((uint256(pos.liquidity) * shares) / totalShares);
        if (liquidityToBurn == 0) return (0, 0);

        // TODO: Actual V4 decrease liquidity
        // (amount0, amount1) = IV4PositionManager(positionManager).burn(pos.tokenId, liquidityToBurn);

        pos.liquidity -= liquidityToBurn;
    }

    function _getPositionAmounts(
        PositionInfo storage pos
    ) internal view returns (uint256 amount0, uint256 amount1) {
        if (pos.liquidity == 0) return (0, 0);
        
        // TODO: Actual V4 position query
        // Use LiquidityAmounts library
        
        // Simplified estimation
        amount0 = pos.liquidity / 2;
        amount1 = pos.liquidity / 2;
    }

    function _liquidityForAmounts(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) internal view returns (uint128) {
        // TODO: Use actual V4 LiquidityAmounts.getLiquidityForAmounts()
        
        // Simplified estimation
        if (amount0 == 0 && amount1 == 0) return 0;
        if (amount0 == 0) return uint128(amount1);
        if (amount1 == 0) return uint128(amount0);
        
        return uint128(_sqrt(amount0 * amount1));
    }

    function _estimateLiquidity(uint256 amount0, uint256 amount1) internal pure returns (uint256) {
        if (amount0 == 0 || amount1 == 0) return amount0 + amount1;
        return _sqrt(amount0 * amount1);
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

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
    }

    function setManager(address _manager, bool _status) external onlyOwner {
        isManager[_manager] = _status;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    function collectFees() external {
        if (feeRecipient == address(0)) return;
        
        uint256 fees0 = accruedFees0;
        uint256 fees1 = accruedFees1;
        
        accruedFees0 = 0;
        accruedFees1 = 0;
        
        if (fees0 > 0) CREATOR_COIN.safeTransfer(feeRecipient, fees0);
        if (fees1 > 0) PAIRED_TOKEN.safeTransfer(feeRecipient, fees1);
        
        emit FeesCollected(fees0, fees1);
    }

    /**
     * @notice Emergency withdraw all liquidity
     */
    function emergencyWithdraw() external onlyOwner {
        _burnAndCollect(fullRangePosition);
        _burnAndCollect(basePosition);
        _burnAndCollect(limitPosition);

        uint256 bal0 = CREATOR_COIN.balanceOf(address(this));
        uint256 bal1 = PAIRED_TOKEN.balanceOf(address(this));

        if (bal0 > 0) CREATOR_COIN.safeTransfer(vault, bal0);
        if (bal1 > 0) PAIRED_TOKEN.safeTransfer(vault, bal1);
    }
}


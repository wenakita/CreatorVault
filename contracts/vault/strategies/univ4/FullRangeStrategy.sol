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

/**
 * @title FullRangeStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Provides full-range liquidity on Uniswap V4
 * 
 * @dev STRATEGY:
 *      - Deposits liquidity across the entire price range (MIN_TICK to MAX_TICK)
 *      - Never goes out of range - always earning fees
 *      - Lower capital efficiency but zero maintenance
 *      - Ideal for long-term, passive liquidity provision
 * 
 * @dev TICK RANGE:
 *      - Uses tickLower = -887272 and tickUpper = 887272 (max range)
 *      - This covers all possible prices
 * 
 * @dev INTEGRATION:
 *      - Plugs into CreatorLPManager
 *      - Implements ILPStrategy interface
 */

enum StrategyType {
    FullRange,
    LimitOrder,
    Concentrated
}

contract FullRangeStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    // =================================
    // CONSTANTS
    // =================================

    /// @notice Full range tick bounds (Uniswap V4 max)
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

    /// @notice Current position token ID (NFT)
    uint256 public positionTokenId;

    /// @notice Total liquidity in this strategy
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
    event Rebalanced(uint256 timestamp);
    event PoolConfigured(bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0);
    event EmergencyModeEnabled();

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
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

    /**
     * @notice Initialize full range strategy
     * @param _creatorCoin Creator Coin token
     * @param _pairedToken Paired token (WETH)
     * @param _lpManager LP Manager address
     * @param _owner Owner address
     */
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

    /**
     * @notice Configure Uniswap V4 pool
     * @param _poolManager V4 Pool Manager
     * @param _positionManager V4 Position Manager (PosM)
     * @param _permit2 Permit2 contract used by PosM
     * @param _poolKey The pool key (pool id is derived from this)
     */
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

        // Approvals for PosM: token -> Permit2, then Permit2 -> PosM
        CREATOR_COIN.forceApprove(_permit2, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2).approve(address(CREATOR_COIN), _positionManager, type(uint160).max, type(uint48).max);
        IAllowanceTransfer(_permit2).approve(address(PAIRED_TOKEN), _positionManager, type(uint160).max, type(uint48).max);

        emit PoolConfigured(PoolId.unwrap(poolId), _poolManager, _positionManager, _permit2, _creatorIsCurrency0);
    }

    // =================================
    // ILPStrategy INTERFACE
    // =================================

    /**
     * @notice Deposit liquidity
     * @param creatorCoinAmount Amount of creator coin
     * @param pairedAmount Amount of paired token
     * @return liquidity Amount of liquidity minted
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external nonReentrant onlyLPManager whenActive returns (uint256 liquidity) {
        _requireConfigured();
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();

        // Pull tokens from LP Manager
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }

        // Compute full-range bounds aligned to pool tick spacing
        int24 _tickSpacing = poolKey.tickSpacing;
        int24 tickLower = (MIN_TICK / _tickSpacing) * _tickSpacing;
        int24 tickUpper = (MAX_TICK / _tickSpacing) * _tickSpacing;

        // Convert our token amounts to currency0/currency1 ordering
        (uint256 amountCurrency0, uint256 amountCurrency1) = creatorIsCurrency0
            ? (creatorCoinAmount, pairedAmount)
            : (pairedAmount, creatorCoinAmount);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint128 liquidityToAdd = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amountCurrency0,
            amountCurrency1
        );

        if (liquidityToAdd == 0) return 0;

        if (positionTokenId == 0) {
            positionTokenId = IPositionManager(positionManager).nextTokenId();
            _posmMint(tickLower, tickUpper, liquidityToAdd);
        } else {
            _posmIncrease(positionTokenId, liquidityToAdd);
        }

        liquidity = uint256(liquidityToAdd);
        totalLiquidity += liquidity;

        emit Deposited(creatorCoinAmount, pairedAmount, liquidity);
    }

    /**
     * @notice Withdraw liquidity
     * @param liquidity Amount of liquidity to withdraw
     * @return creatorCoinAmount Amount of creator coin returned
     * @return pairedAmount Amount of paired token returned
     */
    function withdraw(
        uint256 liquidity
    ) external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        _requireConfigured();
        if (liquidity == 0) revert ZeroAmount();
        if (liquidity > totalLiquidity) revert InsufficientLiquidity();

        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        _posmDecrease(positionTokenId, uint128(liquidity));

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

        totalLiquidity -= liquidity;

        // Transfer tokens to LP Manager
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
     * @return creatorCoinAmount Amount of creator coin returned
     * @return pairedAmount Amount of paired token returned
     */
    function withdrawAll() external nonReentrant onlyLPManager returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        _requireConfigured();
        if (totalLiquidity == 0) return (0, 0);

        uint256 liquidity = totalLiquidity;

        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        _posmDecrease(positionTokenId, uint128(liquidity));

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

        totalLiquidity = 0;

        if (creatorCoinAmount > 0) CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        if (pairedAmount > 0) PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);

        emit Withdrawn(liquidity, creatorCoinAmount, pairedAmount);
    }

    /**
     * @notice Rebalance position (collect fees, re-add if needed)
     * @dev Full range doesn't need tick rebalancing, just fee collection
     */
    function rebalance() external onlyLPManager whenActive {
        // Collect accrued fees
        // _collectFees();

        // For full range, no tick adjustment needed
        // Just reinvest collected fees if desired

        emit Rebalanced(block.timestamp);
    }

    /**
     * @notice Get total value in this strategy
     * @return creatorCoinValue Value in creator coin terms
     * @return pairedValue Value in paired token terms
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        // Simplified calculation - V4 position integration not yet implemented
        // Returns token balances + estimated position value
        
        creatorCoinValue = CREATOR_COIN.balanceOf(address(this));
        pairedValue = PAIRED_TOKEN.balanceOf(address(this));

        // Add position value
        if (totalLiquidity > 0) {
            (uint256 posCreator, uint256 posPaired) = _calculateAmountsForLiquidity(totalLiquidity);
            creatorCoinValue += posCreator;
            pairedValue += posPaired;
        }
    }

    /**
     * @notice Get total liquidity
     */
    function getLiquidity() external view returns (uint256) {
        return totalLiquidity;
    }

    /**
     * @notice Check if strategy is active
     */
    function isActive() external view returns (bool) {
        return isActive_ && !isEmergencyMode;
    }

    /**
     * @notice Get strategy type
     */
    function strategyType() external pure returns (StrategyType) {
        return StrategyType.FullRange;
    }

    // =================================
    // INTERNAL
    // =================================

    function _requireConfigured() internal view {
        if (address(poolManager) == address(0)) revert PoolNotConfigured();
        if (positionManager == address(0)) revert PoolNotConfigured();
        if (permit2 == address(0)) revert PoolNotConfigured();
        if (PoolId.unwrap(poolId) == bytes32(0)) revert PoolNotConfigured();
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

    function _posmIncrease(uint256 tokenId, uint128 liquidityToAdd) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.INCREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(liquidityToAdd), type(uint128).max, type(uint128).max, bytes(""));
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

    /**
     * @dev Calculate liquidity from token amounts
     * @dev This is a simplified calculation - production would use V4's math
     */
    function _calculateLiquidity(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) internal pure returns (uint256) {
        // Simplified: geometric mean of amounts
        // In production, use Uniswap V4's liquidity calculation
        if (creatorCoinAmount == 0 || pairedAmount == 0) {
            return creatorCoinAmount + pairedAmount;
        }
        return _sqrt(creatorCoinAmount * pairedAmount);
    }

    /**
     * @dev Calculate token amounts for liquidity
     */
    function _calculateAmountsForLiquidity(
        uint256 liquidity
    ) internal view returns (uint256 creatorCoinAmount, uint256 pairedAmount) {
        // Simplified: split evenly
        // In production, this comes from V4 position data
        creatorCoinAmount = liquidity / 2;
        pairedAmount = liquidity / 2;
    }

    /**
     * @dev Square root using Babylonian method
     */
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
        emit EmergencyModeEnabled();
    }

    /**
     * @notice Emergency withdraw all tokens to owner
     */
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

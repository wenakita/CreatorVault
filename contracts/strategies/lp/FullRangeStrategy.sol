// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    /// @notice Uniswap V4 Pool Manager
    address public poolManager;

    /// @notice Uniswap V4 Position Manager
    address public positionManager;

    /// @notice Pool ID for this strategy's pool
    bytes32 public poolId;

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
    event PoolConfigured(bytes32 poolId, address poolManager, address positionManager);
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
     * @param _positionManager V4 Position Manager
     * @param _poolId Pool identifier
     */
    function configurePool(
        address _poolManager,
        address _positionManager,
        bytes32 _poolId
    ) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        positionManager = _positionManager;
        poolId = _poolId;

        // Approve position manager to spend tokens
        CREATOR_COIN.forceApprove(_positionManager, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_positionManager, type(uint256).max);

        emit PoolConfigured(_poolId, _poolManager, _positionManager);
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
        if (poolId == bytes32(0)) revert PoolNotConfigured();
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();

        // Pull tokens from LP Manager
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }

        // Add liquidity to V4 position
        // TODO: Implement V4 position manager interaction
        // This would call positionManager.modifyLiquidity() or similar
        
        // For now, calculate approximate liquidity based on amounts
        // In production, this comes from the actual V4 position
        liquidity = _calculateLiquidity(creatorCoinAmount, pairedAmount);

        if (positionTokenId == 0) {
            // Create new position
            // positionTokenId = _mintPosition(creatorCoinAmount, pairedAmount);
        } else {
            // Add to existing position
            // _increaseLiquidity(creatorCoinAmount, pairedAmount);
        }

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
        if (liquidity == 0) revert ZeroAmount();
        if (liquidity > totalLiquidity) revert InsufficientLiquidity();

        // Calculate proportional amounts
        // TODO: Get actual amounts from V4 position
        (creatorCoinAmount, pairedAmount) = _calculateAmountsForLiquidity(liquidity);

        // Remove liquidity from V4
        // _decreaseLiquidity(liquidity);

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
        if (totalLiquidity == 0) return (0, 0);

        uint256 liquidity = totalLiquidity;
        
        // Calculate amounts
        (creatorCoinAmount, pairedAmount) = _calculateAmountsForLiquidity(liquidity);

        // Remove all liquidity from V4
        // _decreaseLiquidity(liquidity);

        totalLiquidity = 0;

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
        // TODO: Get actual values from V4 position
        // For now, return token balances + position value
        
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


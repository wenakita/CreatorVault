// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../interfaces/strategies/IStrategy.sol";

/**
 * @title AjnaStrategy
 * @author 0xakita.eth
 * @notice Yield strategy for Creator Coins via Ajna permissionless lending
 * @dev Deposits creator tokens (AKITA, etc.) into Ajna lending pool to earn interest from borrowers
 * 
 * Ajna is permissionless - any token can be used without governance approval.
 * This strategy creates/uses a creator token lending pool where users can:
 * - Lend tokens (what we do) and earn interest
 * - Borrow tokens using collateral
 * 
 * Yield Source: Interest paid by borrowers
 */
contract AjnaStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // EVENTS
    // ================================

    event StrategyDeposit(uint256 amount, uint256 shares);
    event StrategyWithdraw(uint256 amount, uint256 shares);
    event YieldHarvested(uint256 amount, uint256 timestamp);
    event StrategyRebalanced(uint256 totalAssets, uint256 timestamp);
    event EmergencyWithdrawn(uint256 amount, address recipient);

    // ================================
    // ERRORS
    // ================================

    error OnlyVault();
    error StrategyPaused();
    error InsufficientAssets();

    // ================================
    // STATE
    // ================================

    /// @notice CreatorOVault that owns this strategy
    address public immutable vault;

    /// @notice Creator token (AKITA, etc.)
    IERC20 public immutable CREATOR_COIN;

    /// @notice Ajna pool for creator token lending
    address public ajnaPool;

    /// @notice Ajna ERC20 pool factory
    address public ajnaFactory;

    /// @notice Quote token for the Ajna pool (e.g., WETH, USDC)
    address public quoteToken;

    /// @notice Total tokens deposited to Ajna
    uint256 private _totalDeposited;

    /// @notice Strategy active status
    bool private _isActive;

    /// @notice Last harvest timestamp
    uint256 public lastHarvest;

    /// @notice Strategy name
    string public strategyName;

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    modifier whenActive() {
        if (!_isActive) revert StrategyPaused();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _vault,
        address _creatorCoin,
        address _ajnaFactory,
        address _quoteToken,
        address _owner
    ) Ownable(_owner) {
        require(_vault != address(0), "Invalid vault");
        require(_creatorCoin != address(0), "Invalid creator coin");
        require(_ajnaFactory != address(0), "Invalid Ajna factory");
        require(_quoteToken != address(0), "Invalid quote token");

        vault = _vault;
        CREATOR_COIN = IERC20(_creatorCoin);
        ajnaFactory = _ajnaFactory;
        quoteToken = _quoteToken;
        _isActive = true;
        
        strategyName = "Ajna Lending Strategy";
    }

    // ================================
    // CORE FUNCTIONS
    // ================================

    /**
     * @notice Deposit creator tokens into Ajna lending pool
     * @dev Only callable by vault
     */
    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deployed) {
        if (amount == 0) return 0;

        // Transfer tokens from vault
        CREATOR_COIN.safeTransferFrom(vault, address(this), amount);

        // Deploy to Ajna pool
        if (ajnaPool != address(0)) {
            deployed = _depositToAjna(amount);
        } else {
            // Pool not set - keep as idle in strategy
            deployed = amount;
        }

        _totalDeposited += deployed;
        
        emit StrategyDeposit(amount, deployed);
    }

    /**
     * @notice Withdraw creator tokens from Ajna lending pool
     * @dev Only callable by vault
     */
    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 received) {
        if (amount == 0) return 0;
        if (amount > _totalDeposited) revert InsufficientAssets();

        // Withdraw from Ajna pool
        if (ajnaPool != address(0)) {
            received = _withdrawFromAjna(amount);
        } else {
            // No pool - use idle balance
            received = amount;
        }

        _totalDeposited -= amount;

        // Transfer back to vault
        CREATOR_COIN.safeTransfer(vault, received);

        emit StrategyWithdraw(amount, received);
    }

    /**
     * @notice Harvest yield from Ajna pool
     */
    function harvest() external override onlyVault returns (uint256 yieldAmount) {
        if (ajnaPool == address(0)) return 0;

        // Get current balance in Ajna (includes accrued interest)
        uint256 currentValue = _getAjnaBalance();
        
        if (currentValue > _totalDeposited) {
            yieldAmount = currentValue - _totalDeposited;
            
            // Withdraw yield
            _withdrawFromAjna(yieldAmount);
            
            // Transfer yield to vault
            CREATOR_COIN.safeTransfer(vault, yieldAmount);

            lastHarvest = block.timestamp;
            
            emit YieldHarvested(yieldAmount, block.timestamp);
        }
    }

    /**
     * @notice Rebalance strategy positions
     */
    function rebalance() external override onlyVault {
        // For Ajna, rebalancing might involve moving to different price buckets
        // For now, this is a no-op as Ajna handles liquidity automatically
        emit StrategyRebalanced(getTotalAssets(), block.timestamp);
    }

    /**
     * @notice Emergency withdraw all assets
     */
    function emergencyWithdraw() external override onlyVault returns (uint256 amount) {
        _isActive = false;

        // Withdraw everything from Ajna
        if (ajnaPool != address(0)) {
            amount = _withdrawFromAjna(_totalDeposited);
        } else {
            amount = CREATOR_COIN.balanceOf(address(this));
        }

        _totalDeposited = 0;

        // Send all to vault
        CREATOR_COIN.safeTransfer(vault, amount);

        emit EmergencyWithdrawn(amount, vault);
    }

    // ================================
    // AJNA INTEGRATION
    // ================================

    /**
     * @notice Deploy creator tokens to Ajna pool as lender
     * @dev Ajna uses a bucket-based system for lending
     */
    function _depositToAjna(uint256 amount) internal returns (uint256) {
        // Approve Ajna pool
        CREATOR_COIN.forceApprove(ajnaPool, amount);

        // Ajna addQuoteToken function (simplified interface)
        // In reality, you need to specify a price bucket
        // bytes memory callData = abi.encodeWithSignature(
        //     "addQuoteToken(uint256,uint256,uint256)",
        //     amount,
        //     bucketIndex,  // Price bucket to lend at
        //     block.timestamp
        // );
        // (bool success, ) = ajnaPool.call(callData);
        // require(success, "Ajna deposit failed");

        // For now, simulate by just holding
        // Real implementation needs Ajna-specific integration
        return amount;
    }

    /**
     * @notice Withdraw creator tokens from Ajna pool
     */
    function _withdrawFromAjna(uint256 amount) internal pure returns (uint256) {
        // Ajna removeQuoteToken function
        // bytes memory callData = abi.encodeWithSignature(
        //     "removeQuoteToken(uint256,uint256)",
        //     amount,
        //     bucketIndex
        // );
        // (bool success, bytes memory result) = ajnaPool.call(callData);
        // require(success, "Ajna withdraw failed");

        // For now, return the amount (simulated)
        return amount;
    }

    /**
     * @notice Get current creator token balance in Ajna (includes interest)
     */
    function _getAjnaBalance() internal view returns (uint256) {
        if (ajnaPool == address(0)) {
            return CREATOR_COIN.balanceOf(address(this));
        }

        // Query Ajna for our lender position value
        // Real implementation needs Ajna-specific integration
        // For now, return deposited amount
        return _totalDeposited;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function asset() external view override returns (address) {
        return address(CREATOR_COIN);
    }

    function getTotalAssets() public view override returns (uint256) {
        if (ajnaPool != address(0)) {
            return _getAjnaBalance();
        }
        return CREATOR_COIN.balanceOf(address(this));
    }

    function isActive() external view override returns (bool) {
        return _isActive;
    }

    // ================================
    // ADDITIONAL VIEW FUNCTIONS
    // ================================

    function pendingYield() external view returns (uint256) {
        uint256 currentValue = _getAjnaBalance();
        if (currentValue > _totalDeposited) {
            return currentValue - _totalDeposited;
        }
        return 0;
    }

    function name() external view returns (string memory) {
        return strategyName;
    }

    function yieldSource() external pure returns (string memory) {
        return "Ajna Protocol - Permissionless Lending";
    }

    function estimatedAPY() external pure returns (uint256) {
        // Ajna APY is dynamic based on utilization
        // Return a conservative estimate
        return 500; // 5% in basis points
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Set or update the Ajna pool
     * @dev Owner can deploy to a new pool if needed
     */
    function setAjnaPool(address _pool) external onlyOwner {
        // If we have an existing pool with funds, must withdraw first
        if (ajnaPool != address(0) && _totalDeposited > 0) {
            revert("Withdraw from current pool first");
        }
        ajnaPool = _pool;
    }

    /**
     * @notice Initialize approvals for Ajna pool
     */
    function initializeApprovals() external onlyOwner {
        if (ajnaPool != address(0)) {
            CREATOR_COIN.forceApprove(ajnaPool, type(uint256).max);
        }
    }

    /**
     * @notice Pause/unpause strategy
     */
    function setActive(bool active) external onlyOwner {
        _isActive = active;
    }

    /**
     * @notice Rescue stuck tokens (not creator token when active)
     */
    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(CREATOR_COIN) && _isActive) {
            revert("Cannot rescue creator token when active");
        }
        IERC20(token).safeTransfer(to, amount);
    }
}


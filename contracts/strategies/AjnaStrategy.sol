// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../interfaces/strategies/IStrategy.sol";
import {IAjnaPool} from "../interfaces/ajna/IAjnaPool.sol";
import {IAjnaPoolFactory} from "../interfaces/ajna/IAjnaPool.sol";

/**
 * @title AjnaStrategy
 * @author 0xakita.eth
 * @notice Yield strategy for Creator Coins via Ajna permissionless lending
 * @dev LENDS the vault's creator tokens as the Ajna pool QUOTE TOKEN.
 *      Borrowers post collateral (e.g., USDC) and borrow the creator token (quote).
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
    event IdleBufferBpsUpdated(uint256 oldBps, uint256 newBps);

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

    /// @notice Collateral token for the Ajna pool (e.g., USDC, WETH)
    /// @dev Borrowers post this collateral to borrow the creator token (quote).
    address public collateralToken;

    /// @notice Ajna pool interest rate (WAD) used when deploying a new pool.
    /// @dev Ajna factory bounds are [MIN_RATE, MAX_RATE] (on Base currently 1%..10%).
    uint256 public immutable interestRateWad;

    /// @notice Ajna pool subset hash used for standard ERC20 pools.
    bytes32 public immutable ajnaSubsetHash;

    /// @notice Strategy active status
    bool private _isActive;

    /// @notice Last harvest timestamp
    uint256 public lastHarvest;

    /// @notice Strategy name
    string public strategyName;

    /// @notice Bucket index for Ajna lending (price point)
    /// @dev Ajna uses "Fenwick indices" from 1..7388 (0 is invalid for add/move).
    ///      Index 4156 corresponds to price = 1.0 (quote per collateral, WAD).
    ///      Lower index => higher price; higher index => lower price.
    uint256 public bucketIndex;

    /// @notice Target % of total strategy assets to keep idle in the strategy (basis points).
    /// @dev Inspired by Ajna's buffered ERC-4626 vault pattern, but implemented as a simple
    ///      best-effort idle buffer inside the strategy (no separate Buffer contract).
    ///      Keeping some idle reduces the chance we need to touch Ajna during withdrawals.
    uint256 public idleBufferBps = 1000; // 10% by default

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

    /**
     * @param _vault The vault that owns this strategy
     * @param _creatorCoin The creator token to lend
     * @param _ajnaFactory The Ajna ERC20 pool factory
     * @param _collateralToken The collateral token for the pool (e.g., USDC, WETH)
     * @param _owner The owner of this strategy
     * 
     * @dev Bucket index defaults to 4156 (price = 1.0 quote per collateral, WAD).
     *      After deployment, call setBucketIndex() to adjust based on market price
     *      or use moveToBucket() to rebalance existing positions.
     */
    constructor(
        address _vault,
        address _creatorCoin,
        address _ajnaFactory,
        address _collateralToken,
        address _owner
    ) Ownable(_owner) {
        require(_vault != address(0), "Invalid vault");
        require(_creatorCoin != address(0), "Invalid creator coin");
        require(_ajnaFactory != address(0), "Invalid Ajna factory");
        require(_collateralToken != address(0), "Invalid collateral token");

        vault = _vault;
        CREATOR_COIN = IERC20(_creatorCoin);
        ajnaFactory = _ajnaFactory;
        collateralToken = _collateralToken;
        _isActive = true;
        
        strategyName = "Ajna Lending Strategy";
        // 1.0 price bucket (quote per collateral)
        bucketIndex = 4156;

        // Default interest rate = 5% APR (WAD). Must be within Ajna factory bounds.
        interestRateWad = 5e16;

        // Fetch subset hash constant from factory (standard ERC20 pools)
        ajnaSubsetHash = IAjnaPoolFactory(_ajnaFactory).ERC20_NON_SUBSET_HASH();

        // Auto-create or attach to the Ajna pool for (collateralToken, creatorCoin quote)
        _initializeAjnaPool();
    }

    function _initializeAjnaPool() internal {
        address quote = address(CREATOR_COIN);

        // Lookup existing pool
        address pool = IAjnaPoolFactory(ajnaFactory).deployedPools(ajnaSubsetHash, collateralToken, quote);

        // Deploy if missing
        if (pool == address(0)) {
            // Ensure chosen rate is within bounds
            uint256 minRate = IAjnaPoolFactory(ajnaFactory).MIN_RATE();
            uint256 maxRate = IAjnaPoolFactory(ajnaFactory).MAX_RATE();
            require(interestRateWad >= minRate && interestRateWad <= maxRate, "Invalid Ajna rate");

            pool = IAjnaPoolFactory(ajnaFactory).deployPool(collateralToken, quote, interestRateWad);
        }

        // Sanity check token pair
        require(IAjnaPool(pool).quoteTokenAddress() == quote, "Ajna quote mismatch");
        require(IAjnaPool(pool).collateralAddress() == collateralToken, "Ajna collateral mismatch");

        ajnaPool = pool;
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
            // Best-effort: keep a target idle buffer (idleBufferBps) and only deposit the excess.
            // If any Ajna call reverts, we keep funds idle (never brick the vault).
            uint256 total = getTotalAssets(); // safe: _getAjnaQuoteBalance is best-effort
            uint256 desiredIdle = (total * idleBufferBps) / 10_000;
            uint256 idle = CREATOR_COIN.balanceOf(address(this));
            uint256 toDeploy = idle > desiredIdle ? idle - desiredIdle : 0;
            if (toDeploy > 0) {
                try this._depositToAjnaExternal(toDeploy) {} catch {}
            }
        }
        // We always "deploy" the full amount from the vault's perspective (strategy now controls it),
        // whether it sits idle or inside Ajna.
        deployed = amount;
        
        emit StrategyDeposit(amount, deployed);
    }

    /**
     * @notice Withdraw creator tokens from Ajna lending pool
     * @dev Only callable by vault
     */
    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 received) {
        if (amount == 0) return 0;

        uint256 idle = CREATOR_COIN.balanceOf(address(this));
        uint256 remaining = amount;

        // Use idle first
        if (idle > 0) {
            uint256 takeIdle = idle > remaining ? remaining : idle;
            if (takeIdle > 0) {
                CREATOR_COIN.safeTransfer(vault, takeIdle);
                received += takeIdle;
                remaining -= takeIdle;
            }
        }

        // Pull the rest from Ajna if needed
        if (remaining > 0 && ajnaPool != address(0)) {
            uint256 pulled = _withdrawFromAjna(remaining);
            if (pulled > 0) {
                CREATOR_COIN.safeTransfer(vault, pulled);
                received += pulled;
            }
        }

        emit StrategyWithdraw(amount, received);
    }

    /**
     * @notice Harvest yield from Ajna pool
     */
    function harvest() external override onlyVault returns (uint256 yieldAmount) {
        // Vault's `report()` already accounts for strategy gains via getTotalAssets().
        // We intentionally keep harvest as a no-op to avoid forcing liquidity movements.
        yieldAmount = 0;
    }

    /**
     * @notice Rebalance strategy positions
     */
    function rebalance() external override onlyVault {
        // Best-effort idle buffer maintenance:
        // - if idle is above target, deposit the excess to Ajna
        // - if idle is below target, attempt to withdraw from Ajna to refill idle
        //
        // NOTE: This does NOT change bucketIndex; moving buckets is an owner/admin action.
        uint256 total = getTotalAssets(); // safe
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = CREATOR_COIN.balanceOf(address(this));

        if (ajnaPool != address(0)) {
            if (idle > desiredIdle) {
                uint256 toDeploy = idle - desiredIdle;
                if (toDeploy > 0) {
                    try this._depositToAjnaExternal(toDeploy) {} catch {}
                }
            } else if (idle < desiredIdle) {
                uint256 toPull = desiredIdle - idle;
                if (toPull > 0) {
                    _withdrawFromAjna(toPull);
                }
            }
        }

        emit StrategyRebalanced(total, block.timestamp);
    }

    /**
     * @notice Emergency withdraw all assets
     */
    function emergencyWithdraw() external override onlyVault returns (uint256 amount) {
        _isActive = false;

        // Withdraw everything from Ajna (best-effort) + idle balance
        if (ajnaPool != address(0)) {
            // withdraw up to current Ajna value
            uint256 ajnaValue = _getAjnaQuoteBalance();
            if (ajnaValue > 0) {
                _withdrawFromAjna(ajnaValue);
            }
        }
        amount = CREATOR_COIN.balanceOf(address(this));

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
    function _depositToAjnaExternal(uint256 amount) external {
        require(msg.sender == address(this), "internal only");
        _depositToAjna(amount);
    }

    function _depositToAjna(uint256 amount) internal {
        // Approve Ajna pool (quote token = CREATOR_COIN)
        CREATOR_COIN.forceApprove(ajnaPool, amount);

        // Add quote tokens to lending bucket.
        // If some amount is not accepted for any reason, it remains idle in this strategy.
        IAjnaPool(ajnaPool).addQuoteToken(
            amount,
            bucketIndex,
            block.timestamp + 1 hours
        );
    }

    /**
     * @notice Withdraw creator tokens from Ajna pool
     */
    function _withdrawFromAjna(uint256 amount) internal returns (uint256) {
        // Determine LP needed to withdraw `amount` based on current bucket state.
        uint256 lpBalance;
        try IAjnaPool(ajnaPool).lenderInfo(bucketIndex, address(this)) returns (uint256 _lp, uint256 /* depositTime */) {
            lpBalance = _lp;
        } catch {
            return 0;
        }
        if (lpBalance == 0) return 0;

        uint256 bucketLPTotal;
        uint256 bucketDeposit;
        try IAjnaPool(ajnaPool).bucketInfo(bucketIndex) returns (
            uint256 _bucketLPTotal,
            uint256 /* collateral */,
            uint256 /* bankruptcyTime */,
            uint256 _bucketDeposit,
            uint256 /* scale */
        ) {
            bucketLPTotal = _bucketLPTotal;
            bucketDeposit = _bucketDeposit;
        } catch {
            return 0;
        }
        if (bucketDeposit == 0 || bucketLPTotal == 0) return 0;

        // lpToBurn ≈ amount * bucketLPTotal / bucketDeposit
        uint256 lpToBurn = (amount * bucketLPTotal) / bucketDeposit;
        if (lpToBurn == 0) lpToBurn = 1; // ensure progress for small withdrawals
        if (lpToBurn > lpBalance) lpToBurn = lpBalance;

        try IAjnaPool(ajnaPool).removeQuoteToken(lpToBurn, bucketIndex) returns (uint256 removedAmount, uint256 /* redeemedLP */) {
            return removedAmount;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get current creator token balance in Ajna (includes interest)
     */
    function _getAjnaQuoteBalance() internal view returns (uint256) {
        if (ajnaPool == address(0)) return 0;

        // Query Ajna for our LP balance in the bucket
        uint256 lpBalance;
        try IAjnaPool(ajnaPool).lenderInfo(bucketIndex, address(this)) returns (uint256 _lp, uint256 /* depositTime */) {
            lpBalance = _lp;
        } catch {
            return 0;
        }
        if (lpBalance == 0) return 0;

        // Get bucket info to calculate our share
        uint256 bucketLPTotal;
        uint256 bucketDeposit;
        try IAjnaPool(ajnaPool).bucketInfo(bucketIndex) returns (
            uint256 _bucketLPTotal,
            uint256 /* collateral */,
            uint256 /* bankruptcyTime */,
            uint256 _bucketDeposit,
            uint256 /* scale */
        ) {
            bucketLPTotal = _bucketLPTotal;
            bucketDeposit = _bucketDeposit;
        } catch {
            return 0;
        }

        // Calculate our share of the bucket deposits
        // Our value = (our LP / total LP) * total deposits
        if (bucketLPTotal > 0) {
            return (lpBalance * bucketDeposit) / bucketLPTotal;
        }

        return 0;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function asset() external view override returns (address) {
        return address(CREATOR_COIN);
    }

    function getTotalAssets() public view override returns (uint256) {
        // Total value = idle creator tokens + Ajna bucket value.
        return CREATOR_COIN.balanceOf(address(this)) + _getAjnaQuoteBalance();
    }

    function isActive() external view override returns (bool) {
        return _isActive;
    }

    // ================================
    // ADDITIONAL VIEW FUNCTIONS
    // ================================

    function pendingYield() external view returns (uint256) {
        // Vault profit is tracked via CreatorOVault.report() using totalAssets() deltas.
        // This strategy doesn't track principal internally (vault already tracks debt).
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
        // If we have an existing pool with LP, must withdraw first
        if (ajnaPool != address(0)) {
            (uint256 lpBalance, ) = IAjnaPool(ajnaPool).lenderInfo(bucketIndex, address(this));
            require(lpBalance == 0, "Withdraw from current pool first");
        }
        if (_pool != address(0)) {
            require(IAjnaPool(_pool).quoteTokenAddress() == address(CREATOR_COIN), "Ajna quote mismatch");
            require(IAjnaPool(_pool).collateralAddress() == collateralToken, "Ajna collateral mismatch");
        }
        ajnaPool = _pool;
    }

    /**
     * @notice Set the bucket index for lending
     * @dev Ajna bucket indices are Fenwick indices.
     *      Lower index => higher price; higher index => lower price.
     *      Index 4156 corresponds to price = 1.0 (quote per collateral, WAD).
     */
    function setBucketIndex(uint256 _index) external onlyOwner {
        // Ajna has MAX_FENWICK_INDEX = 7388, and index 0 is invalid for add/move.
        require(_index > 0 && _index <= 7388, "Invalid bucket index");
        
        // If we have LP in the current bucket, must move it first
        if (ajnaPool != address(0)) {
            (uint256 lpBalance, ) = IAjnaPool(ajnaPool).lenderInfo(bucketIndex, address(this));
            require(lpBalance == 0, "Move liquidity before changing bucket");
        }
        
        bucketIndex = _index;
    }

    /**
     * @notice Move liquidity to a different bucket
     * @dev Useful for rebalancing or adjusting to market conditions
     */
    function moveToBucket(uint256 newIndex, uint256 lpAmount) external onlyOwner {
        require(newIndex > 0 && newIndex <= 7388, "Invalid bucket index");
        require(ajnaPool != address(0), "Pool not set");
        
        if (lpAmount == 0) {
            (uint256 lpBalance, ) = IAjnaPool(ajnaPool).lenderInfo(bucketIndex, address(this));
            lpAmount = lpBalance;
        }
        if (lpAmount == 0) return;

        // Move LP tokens to new bucket
        IAjnaPool(ajnaPool).moveQuoteToken(
            lpAmount,
            bucketIndex,      // From current bucket
            newIndex,         // To new bucket
            block.timestamp + 1 hours
        );

        bucketIndex = newIndex;
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
     * @notice Set the strategy's idle buffer target.
     * @dev 0 = fully deploy to Ajna (previous behavior). 10_000 = keep everything idle.
     */
    function setIdleBufferBps(uint256 newBps) external onlyOwner {
        require(newBps <= 10_000, "Invalid bps");
        uint256 old = idleBufferBps;
        idleBufferBps = newBps;
        emit IdleBufferBpsUpdated(old, newBps);
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

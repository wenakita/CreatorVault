// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title veAKITA - CreatorVault Protocol Token
 * @author 0xakita.eth
 * @notice Vote-escrowed AKITA - THE protocol token for CreatorVault platform
 *
 * @dev veAKITA provides lottery boosts across ALL creator vaults on the platform.
 *      This is similar to how veCRV provides boosts across all Curve pools.
 *
 * PROTOCOL ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    CreatorVault Platform                            │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  PROTOCOL TOKEN: AKITA                                              │
 * │  └── wsAKITA → veAKITA (boosts across ALL creator vaults)          │
 * │                                                                     │
 * │  Creator A (Bob):   BOB → vBOB → wsBOB   (uses veAKITA for boost)  │
 * │  Creator B (Alice): ALICE → vALICE → wsALICE (uses veAKITA for boost)│
 * │  Creator C (You):   AKITA → vAKITA → wsAKITA → veAKITA             │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * WHY AKITA AS PROTOCOL TOKEN:
 * - Creates massive utility for AKITA across entire platform
 * - All creators' users need AKITA for lottery boosts
 * - Network effects: more creators = more AKITA demand
 * - You control the protocol governance via veAKITA
 *
 * BOOST MECHANICS:
 * - Lock wsAKITA for 1 week to 4 years
 * - Longer lock = more voting power = higher boost (up to 2.5x)
 * - Boosts apply to lottery odds on ANY creator's vault
 *
 * The vault supports multiple revenue-generating strategies, initially including:
 * - Continuous Clearing Auctions
 * - Dynamic Liquidity Management
 * - A fully self-sustaining Swap-to-Win Lottery mechanism (e.g., via CreatorShareOFT)
 *
 * A 6.9% fee is applied on both buys and sells via Uniswap V4 hooks.
 * Fees are distributed: 90% lottery jackpot, 5% creator, 5% protocol.
 *
 * Randomness for winner selection is provided by Chainlink VRF v2.5.
 *
 * USD-denominated probability calculations and swap-size normalization are derived
 * from a Chainlink Data Feed oracle (price feed), which is used to convert token
 * amounts to a standardized value unit for probability assignment.
 *
 * Lottery winning probability scales linearly with swap size:
 * - $1 swap       = 0.0004% chance
 * - $10,000 swap  = 4.0% chance
 *
 * Users may increase their effective probability via a liquidity-lock boost
 * mechanism with a maximum boost multiplier of 2.5×. The boost multiplier is
 * determined primarily by lock duration (e.g., up to 4 years for maximum boost).
 *
 * Boost application rules:
 * - Boosts apply only up to the user’s locked wsAKITA value.
 * - If swap size ≤ locked value, the entire swap is boosted.
 * - If swap size > locked value, only the portion up to the locked value is boosted;
 *   the remainder is applied at the base rate.
 *
 * Example:
 * - User locks $100 worth of wsAKITA (veAKITA) for 4 years (max boost).
 * - User swaps $200:
 *   - First $100 receives a 2.5× probability boost.
 *   - Remaining $100 is unboosted.
 *
 * Base probability:
 * - $100 = 0.04% (400 bps, where 1 bp = 0.0001%).
 *
 * Boosted portion:
 * - 400 bps × 2.5 = 1,000 bps.
 *
 * Unboosted portion:
 * - 400 bps.
 *
 * Total probability allocation:
 * - 1,400 bps (0.14%) chance to win.
 *
 * The maximum probability per user is capped at 10%, achievable by:
 * - Locking $10,000 worth of wsAKITA, and
 * - Swapping $10,000 in a single transaction.
 *
 * Under optimal conditions, this implies an expected jackpot winner approximately
 * once per $100,000 in total swap volume; under worst-case assumptions, at least
 * one jackpot event should occur per ~$250,000 in swap volume.
 *
 * With 6.9% fees applied to buys and sells, if 100% of fees were routed to the jackpot
 * and the winner claims the entire jackpot, the expected payout at $250,000 swap volume
 * would be approximately $17,250 (0.069 × 250,000).
 *
 * The system is designed to be self-sustaining, modular, and extensible; parameters
 * are intended to be governance-tunable as needed.
 *
 * @dev
 * The system operates omnichain via LayerZero V2 for synchronized state and cross-chain
 * execution.
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title IveAKITA
 * @notice Interface for veAKITA (Vote-Escrowed Wrapped AKITA Shares)
 */
interface IveAKITA {
    struct Lock {
        uint256 amount;
        uint256 end;
        uint256 start;
        address lockedToken;
        uint256 underlyingValue;
    }

    // Errors
    error InvalidToken();
    error ZeroAmount();
    error InvalidLockDuration();
    error NoExistingLock();
    error LockDurationTooShort();
    error LockExpired();
    error LockNotExpired();

    // Events
    event Locked(address indexed user, address indexed token, uint256 amount, uint256 lockEnd, uint256 votingPower);
    event LockExtended(address indexed user, uint256 oldEnd, uint256 newEnd, uint256 newVotingPower);
    event LockIncreased(address indexed user, uint256 addedAmount, uint256 totalAmount, uint256 newVotingPower);
    event Unlocked(address indexed user, uint256 amount, address token);

    // Functions
    function lock(address token, uint256 amount, uint256 duration) external returns (uint256 votingPower);
    function extendLock(uint256 newEnd) external returns (uint256 newVotingPower);
    function increaseLock(uint256 amount) external returns (uint256 newVotingPower);
    function unlock() external returns (uint256 amount);
    function getLock(address user) external view returns (Lock memory);
    function votingPower(address user) external view returns (uint256);
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);

    // Constants
    function MIN_LOCK_DURATION() external view returns (uint256);
    function MAX_LOCK_DURATION() external view returns (uint256);
}

contract veAKITA is IveAKITA, Ownable, ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant override MIN_LOCK_DURATION = 7 days;
    uint256 public constant override MAX_LOCK_DURATION = 4 * 365 days; // 4 years

    // ================================
    // STATE
    // ================================

    /// @notice Wrapped ShareOFT token (e.g., wsAKITA)
    address public immutable wrappedShareOFT;

    /// @notice Vault shares token (e.g., vAKITA) - alternative lock token
    address public vaultShares;

    /// @notice Vault for calculating underlying value
    address public vault;

    /// @notice Boost manager address
    address public boostManager;

    /// @notice User locks
    mapping(address => Lock) private _locks;

    /// @notice Total voting supply
    uint256 private _totalVotingSupply;

    /// @notice Accepted tokens for locking
    mapping(address => bool) public acceptedTokens;

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor
     * @param _name Token name (e.g., "Vote-Escrowed Wrapped AKITA Share")
     * @param _symbol Token symbol (e.g., "vewsAKITA" or "veAKITA")
     * @param _wrappedShareOFT The wsAKITA (or similar) token to lock
     * @param _owner Owner address
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _wrappedShareOFT,
        address _owner
    )
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(_owner)
    {
        require(_wrappedShareOFT != address(0), "Invalid wrapped share token");
        wrappedShareOFT = _wrappedShareOFT;
        acceptedTokens[_wrappedShareOFT] = true;
    }

    // ================================
    // LOCK FUNCTIONS
    // ================================

    /**
     * @notice Lock wrapped shares (wsAKITA) or vault shares (vAKITA) to receive voting power
     * @param _token Token to lock (wrappedShareOFT or vaultShares)
     * @param amount Amount to lock
     * @param duration Lock duration in seconds
     */
    function lock(
        address _token,
        uint256 amount,
        uint256 duration
    ) external override nonReentrant returns (uint256 votingPowerAmount) {
        if (!acceptedTokens[_token]) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert InvalidLockDuration();
        if (duration > MAX_LOCK_DURATION) revert InvalidLockDuration();
        if (_locks[msg.sender].amount > 0) revert NoExistingLock(); // Must use increaseLock

        uint256 lockEnd = block.timestamp + duration;

        // Transfer tokens
        IERC20(_token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate voting power
        votingPowerAmount = _calculateVotingPower(amount, lockEnd);

        // Store lock
        _locks[msg.sender] = Lock({
            amount: amount,
            end: lockEnd,
            start: block.timestamp,
            lockedToken: _token,
            underlyingValue: _getUnderlyingValue(_token, amount)
        });

        // Mint veAKITA (non-transferable)
        _mint(msg.sender, votingPowerAmount);
        _totalVotingSupply += votingPowerAmount;

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit Locked(msg.sender, _token, amount, lockEnd, votingPowerAmount);
    }

    /**
     * @notice Extend lock duration
     */
    function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (newEnd <= userLock.end) revert LockDurationTooShort();
        if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();

        uint256 oldEnd = userLock.end;
        uint256 oldPower = balanceOf(msg.sender);

        // Update lock end
        userLock.end = newEnd;

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, newEnd);

        // Adjust veAKITA balance
        if (newVotingPower > oldPower) {
            uint256 diff = newVotingPower - oldPower;
            _mint(msg.sender, diff);
            _totalVotingSupply += diff;
        }

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockExtended(msg.sender, oldEnd, newEnd, newVotingPower);
    }

    /**
     * @notice Increase lock amount
     */
    function increaseLock(uint256 amount) external override nonReentrant returns (uint256 newVotingPower) {
        if (amount == 0) revert ZeroAmount();

        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp >= userLock.end) revert LockExpired();

        uint256 oldPower = balanceOf(msg.sender);

        // Transfer additional tokens
        IERC20(userLock.lockedToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update lock
        userLock.amount += amount;
        userLock.underlyingValue = _getUnderlyingValue(userLock.lockedToken, userLock.amount);

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, userLock.end);

        // Mint additional veAKITA
        if (newVotingPower > oldPower) {
            uint256 diff = newVotingPower - oldPower;
            _mint(msg.sender, diff);
            _totalVotingSupply += diff;
        }

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockIncreased(msg.sender, amount, userLock.amount, newVotingPower);
    }

    /**
     * @notice Unlock tokens after lock expires
     */
    function unlock() external override nonReentrant returns (uint256 amount) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp < userLock.end) revert LockNotExpired();

        amount = userLock.amount;
        address tokenToReturn = userLock.lockedToken;

        // Burn veAKITA
        uint256 veBalance = balanceOf(msg.sender);
        if (veBalance > 0) {
            _burn(msg.sender, veBalance);
            _totalVotingSupply -= veBalance;
        }

        // Clear lock
        delete _locks[msg.sender];

        // Return tokens
        IERC20(tokenToReturn).safeTransfer(msg.sender, amount);

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit Unlocked(msg.sender, amount, tokenToReturn);
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    function _calculateVotingPower(uint256 amount, uint256 lockEnd) internal view returns (uint256) {
        if (block.timestamp >= lockEnd) return 0;

        uint256 duration = lockEnd - block.timestamp;
        // Linear: max power at MAX_LOCK_DURATION
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    function _getUnderlyingValue(address token, uint256 amount) internal view returns (uint256) {
        if (vault == address(0)) return amount;

        // If token is vault shares, get underlying value
        try IVault(vault).previewRedeem(amount) returns (uint256 value) {
            return value;
        } catch {
            return amount;
        }
    }

    function _notifyBoostManager(address user) internal {
        if (boostManager != address(0)) {
            try IBoostManager(boostManager).updateBalanceTracking(user) {} catch {}
        }
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getLock(address user) external view override returns (Lock memory) {
        return _locks[user];
    }

    function votingPower(address user) public view override returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        return _calculateVotingPower(userLock.amount, userLock.end);
    }

    function getVotingPower(address user) external view override returns (uint256) {
        return votingPower(user);
    }

    function votingPowerAt(address user, uint256 timestamp) external view returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        if (timestamp >= userLock.end) return 0;

        uint256 duration = userLock.end - timestamp;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
    }

    function getTotalVotingPower() external view override returns (uint256) {
        return _totalVotingSupply;
    }

    function totalVotingSupply() external view returns (uint256) {
        return _totalVotingSupply;
    }

    function hasActiveLock(address user) external view override returns (bool) {
        return _locks[user].amount > 0 && block.timestamp < _locks[user].end;
    }

    function getRemainingLockTime(address user) external view returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0 || block.timestamp >= userLock.end) return 0;
        return userLock.end - block.timestamp;
    }

    // ================================
    // ADMIN
    // ================================

    function setVaultShares(address _vaultShares) external onlyOwner {
        require(_vaultShares != address(0), "Invalid");
        vaultShares = _vaultShares;
        acceptedTokens[_vaultShares] = true;
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setBoostManager(address _boostManager) external onlyOwner {
        boostManager = _boostManager;
    }

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        acceptedTokens[token] = accepted;
    }

    // ================================
    // OVERRIDES (Non-transferable)
    // ================================

    function transfer(address, uint256) public pure override returns (bool) {
        revert("veAKITA: non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("veAKITA: non-transferable");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("veAKITA: non-transferable");
    }

    // Required overrides
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}

// Helper interfaces
interface IVault {
    function previewRedeem(uint256 shares) external view returns (uint256);
}

interface IBoostManager {
    function updateBalanceTracking(address user) external;
}


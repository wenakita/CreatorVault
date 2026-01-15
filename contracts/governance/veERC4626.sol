// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title veERC4626 - CreatorVault Protocol Token
 * @author 0xakita.eth
 * @notice Vote-escrowed ERC4626 (ve■4626) for protocol-wide boosts.
 * @dev Users lock ■4626 (or ▢4626) to get voting power and lottery boosts.
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
 * @title IveERC4626
 * @notice Interface for veERC4626 (Vote-Escrowed ■4626)
 */
interface IveERC4626 {
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

contract veERC4626 is IveERC4626, Ownable, ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant override MIN_LOCK_DURATION = 7 days;
    uint256 public constant override MAX_LOCK_DURATION = 4 * 365 days; // 4 years

    // ================================
    // STATE
    // ================================

    /// @notice Wrapped ShareOFT token (e.g., ■4626)
    address public immutable wrappedShareOFT;

    /// @notice Vault shares token (e.g., ▢4626) - alternative lock token
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
     * @param _name Token name (e.g., "Vote-Escrowed Wrapped 4626 Share")
     * @param _symbol Token symbol (e.g., "ve■4626")
     * @param _wrappedShareOFT The ■4626 (or similar) token to lock
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
     * @notice Lock wrapped shares (■4626) or vault shares (▢4626) to receive voting power
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

        // Mint veERC4626 (non-transferable)
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

        // Adjust veERC4626 balance
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

        // Mint additional veERC4626
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

        // Burn veERC4626
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

    function _getUnderlyingValue(address /* token */, uint256 amount) internal view returns (uint256) {
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
        revert("veERC4626: non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("veERC4626: non-transferable");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("veERC4626: non-transferable");
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


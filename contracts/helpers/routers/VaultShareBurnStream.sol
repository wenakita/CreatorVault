// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICreatorOVaultBurn {
    function burnSharesForPriceIncrease(uint256 shares) external;
    function pricePerShare() external view returns (uint256);
}

/**
 * @title VaultShareBurnStream
 * @notice Holds CreatorOVault shares (▢TOKEN) and burns them linearly over an epoch.
 *
 * @dev Enforceability:
 * - This contract has NO owner and NO withdrawal function.
 * - Vault shares deposited/minted to this address can only ever leave via burning.
 *
 * Epoch schedule:
 * - Weekly epochs aligned to Thursday 00:00 UTC (Unix epoch is Thursday 00:00 UTC).
 * - Shares minted to this contract are queued for the NEXT epoch.
 * - During an active epoch, anyone can call `drip()` to burn the proportional amount.
 */
contract VaultShareBurnStream is ReentrancyGuard {
    // Weekly epochs (7 days)
    uint256 public constant EPOCH_DURATION = 7 days;

    address public immutable vault;
    IERC20 public immutable vaultShares;

    // Pending (next epoch)
    uint256 public pendingShares;
    uint256 public pendingEpochStart;

    // Active (current epoch)
    uint256 public activeShares;
    uint256 public activeEpochStart;
    uint256 public burnedActive;

    event SharesQueued(uint256 shares, uint256 indexed scheduledEpochStart);
    event StreamStarted(uint256 indexed epochStart, uint256 shares);
    event StreamDripped(uint256 indexed epochStart, uint256 burnedNow, uint256 burnedTotal, uint256 remaining, uint256 pps);
    event StreamCompleted(uint256 indexed epochStart, uint256 totalBurned, uint256 pps);

    error ZeroAddress();
    error ZeroAmount();
    error NothingToStart();
    error TooSoon(uint256 nowTs, uint256 requiredTs);
    error NoActiveStream();
    error NoNewShares();

    constructor(address _vault) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        vaultShares = IERC20(_vault);
    }

    // ================================
    // EPOCH HELPERS (THU 00:00 UTC)
    // ================================

    function epochStart(uint256 ts) public pure returns (uint256) {
        return ts - (ts % EPOCH_DURATION);
    }

    function nextEpochStart(uint256 ts) public pure returns (uint256) {
        return epochStart(ts) + EPOCH_DURATION;
    }

    // ================================
    // QUEUE NEW SHARES
    // ================================

    /**
     * @notice Queue newly-minted/received vault shares for the next epoch.
     * @dev `shares` must correspond to NEW shares not yet accounted as pending/active.
     *      This lets routers call `queueShares(sharesMinted)` right after `vault.deposit(..., this)`.
     */
    function queueShares(uint256 shares) public nonReentrant {
        if (shares == 0) revert ZeroAmount();

        uint256 remainingActive = activeShares > burnedActive ? activeShares - burnedActive : 0;
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal < accounted + shares) revert NoNewShares();

        uint256 scheduled = nextEpochStart(block.timestamp);
        if (pendingShares == 0) {
            pendingEpochStart = scheduled;
        }
        // If pendingEpochStart is already set, we keep it — this batches all deposits that
        // occurred within the same epoch into the same next-epoch stream (by construction).

        pendingShares += shares;
        emit SharesQueued(shares, pendingEpochStart);
    }

    /**
     * @notice Convenience: queue ALL unaccounted shares.
     */
    function syncUnaccounted() external nonReentrant {
        uint256 remainingActive = activeShares > burnedActive ? activeShares - burnedActive : 0;
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal <= accounted) revert NoNewShares();
        queueShares(bal - accounted);
    }

    // ================================
    // START + DRIP
    // ================================

    /**
     * @notice Start the pending stream once the scheduled epoch begins.
     */
    function start() public nonReentrant {
        if (pendingShares == 0) revert NothingToStart();
        if (pendingEpochStart == 0) revert NothingToStart();
        if (block.timestamp < pendingEpochStart) revert TooSoon(block.timestamp, pendingEpochStart);

        // Only one active stream at a time (one epoch).
        if (activeShares != 0) revert NothingToStart();

        activeShares = pendingShares;
        activeEpochStart = pendingEpochStart;
        burnedActive = 0;

        pendingShares = 0;
        pendingEpochStart = 0;

        emit StreamStarted(activeEpochStart, activeShares);

        // If we started late, burn what should already have been burned.
        _drip();
    }

    /**
     * @notice Burn the proportional amount of shares for the active epoch.
     * @dev Permissionless.
     */
    function drip() external nonReentrant returns (uint256 burnedNow) {
        burnedNow = _drip();
    }

    /**
     * @notice Convenience: sync → start (if ready) → drip.
     */
    function checkpoint() external nonReentrant returns (uint256 burnedNow) {
        // Sync any unaccounted shares into the pending bucket.
        uint256 remainingActive = activeShares > burnedActive ? activeShares - burnedActive : 0;
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal > accounted) {
            // queueShares() already has a nonReentrant guard, so we inline the accounting here.
            uint256 scheduled = nextEpochStart(block.timestamp);
            if (pendingShares == 0) pendingEpochStart = scheduled;
            pendingShares += (bal - accounted);
            emit SharesQueued(bal - accounted, pendingEpochStart);
        }

        if (activeShares == 0 && pendingShares > 0 && pendingEpochStart != 0 && block.timestamp >= pendingEpochStart) {
            // Start and immediately drip.
            activeShares = pendingShares;
            activeEpochStart = pendingEpochStart;
            burnedActive = 0;
            pendingShares = 0;
            pendingEpochStart = 0;
            emit StreamStarted(activeEpochStart, activeShares);
        }

        burnedNow = _drip();
    }

    function _drip() internal returns (uint256 burnedNow) {
        if (activeShares == 0) return 0;
        if (block.timestamp < activeEpochStart) return 0;

        uint256 elapsed = block.timestamp - activeEpochStart;
        if (elapsed > EPOCH_DURATION) elapsed = EPOCH_DURATION;

        uint256 burnableTotal = (activeShares * elapsed) / EPOCH_DURATION;
        if (burnableTotal <= burnedActive) return 0;

        burnedNow = burnableTotal - burnedActive;
        burnedActive = burnableTotal;

        // Burn shares held by this contract (requires vault to allow this stream).
        ICreatorOVaultBurn(vault).burnSharesForPriceIncrease(burnedNow);

        uint256 remaining = activeShares - burnedActive;
        uint256 pps = ICreatorOVaultBurn(vault).pricePerShare();
        emit StreamDripped(activeEpochStart, burnedNow, burnedActive, remaining, pps);

        if (elapsed == EPOCH_DURATION && burnedActive == activeShares) {
            emit StreamCompleted(activeEpochStart, activeShares, pps);
            activeShares = 0;
            activeEpochStart = 0;
            burnedActive = 0;
        }
    }
}


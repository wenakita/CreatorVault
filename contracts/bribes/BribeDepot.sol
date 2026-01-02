// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BribeDepot
 * @author CreatorVault
 * @notice Epoch-scoped, multi-token bribe vault for a single creator vault gauge.
 *
 * Design goals (Hermes-inspired, but strict epoch accounting):
 * - Anyone can deposit bribes for a FUTURE epoch only (prevents retroactive bribing).
 * - Voters can claim pro-rata for the exact epoch they voted (by vote weight).
 * - If an epoch ends with 0 votes for this vault, depositors can refund their own deposits.
 *
 * @dev Vault address is treated as the "gauge id" (matches `VaultGaugeVoting` design).
 */

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVaultGaugeVotingForBribes {
    function currentEpoch() external view returns (uint256);
    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
}

contract BribeDepot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // IMMUTABLES
    // ================================

    /// @notice The vault that this depot is attached to (gauge id).
    address public immutable vault;

    /// @notice Gauge voting contract used for epoch + vote weight reads.
    IVaultGaugeVotingForBribes public immutable gaugeVoting;

    // ================================
    // STATE
    // ================================

    /// @notice epoch => token => total bribes (denominated in `token`)
    mapping(uint256 => mapping(address => uint256)) public epochTokenBribes;

    /// @notice epoch => token => user => claimed?
    mapping(uint256 => mapping(address => mapping(address => bool))) public hasClaimed;

    /// @notice epoch => token => depositor => amount (for zero-vote refunds)
    mapping(uint256 => mapping(address => mapping(address => uint256))) public depositorBribes;

    // ================================
    // EVENTS
    // ================================

    event BribeDeposited(uint256 indexed epoch, address indexed token, address indexed depositor, uint256 amount);
    event BribeClaimed(uint256 indexed epoch, address indexed token, address indexed user, uint256 amount);
    event BribeRefunded(uint256 indexed epoch, address indexed token, address indexed depositor, uint256 amount);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error EpochNotInFuture();
    error EpochNotEnded();
    error NotZeroVoteEpoch();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _vault, address _gaugeVoting) {
        if (_vault == address(0) || _gaugeVoting == address(0)) revert ZeroAddress();
        vault = _vault;
        gaugeVoting = IVaultGaugeVotingForBribes(_gaugeVoting);
    }

    // ================================
    // DEPOSIT
    // ================================

    /**
     * @notice Deposit a bribe token for a future epoch.
     * @dev Deposits for the current/past epoch are rejected.
     */
    function depositBribe(address token, uint256 epoch, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch <= current) revert EpochNotInFuture();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        epochTokenBribes[epoch][token] += amount;
        depositorBribes[epoch][token][msg.sender] += amount;

        emit BribeDeposited(epoch, token, msg.sender, amount);
    }

    // ================================
    // CLAIM
    // ================================

    function previewClaim(address user, address token, uint256 epoch) external view returns (uint256 amount) {
        if (user == address(0) || token == address(0)) return 0;
        if (epoch >= gaugeVoting.currentEpoch()) return 0; // epoch not ended
        if (hasClaimed[epoch][token][user]) return 0;

        uint256 totalBribe = epochTokenBribes[epoch][token];
        if (totalBribe == 0) return 0;

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) return 0;

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, user, vault);
        if (userWeight == 0) return 0;

        return (totalBribe * userWeight) / totalWeight;
    }

    /**
     * @notice Claim bribes for a given token and epoch (pro-rata by vote weight).
     * @dev Strict epoch accounting: only claim after the epoch ends.
     */
    function claim(address token, uint256 epoch) external nonReentrant returns (uint256 amount) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();

        if (hasClaimed[epoch][token][msg.sender]) return 0;
        hasClaimed[epoch][token][msg.sender] = true;

        uint256 totalBribe = epochTokenBribes[epoch][token];
        if (totalBribe == 0) return 0;

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) return 0;

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, msg.sender, vault);
        if (userWeight == 0) return 0;

        amount = (totalBribe * userWeight) / totalWeight;
        if (amount > 0) {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit BribeClaimed(epoch, token, msg.sender, amount);
    }

    // ================================
    // REFUND (ZERO-VOTE EPOCHS ONLY)
    // ================================

    /**
     * @notice Refund the caller's deposited bribe if the epoch ended with 0 votes for this vault.
     * @dev This prevents bribes from getting stuck when no one voted for the vault that epoch.
     */
    function refundZeroVoteBribe(address token, uint256 epoch) external nonReentrant returns (uint256 amount) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();

        if (gaugeVoting.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();

        amount = depositorBribes[epoch][token][msg.sender];
        if (amount == 0) return 0;

        // Effects before interactions
        depositorBribes[epoch][token][msg.sender] = 0;
        epochTokenBribes[epoch][token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);
        emit BribeRefunded(epoch, token, msg.sender, amount);
    }
}




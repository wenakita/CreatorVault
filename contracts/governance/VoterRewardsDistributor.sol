// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VoterRewardsDistributor
 * @author CreatorVault
 * @notice Distributes the "protocol" fee slice to veAKITA voters (ve(3,3) mechanics)
 *
 * @dev Inspired by ve(3,3) systems where voters receive fees/bribes for voting on gauges.
 *      Conceptually similar to bribe/fee-distributor patterns used in b(3,3)/ve(3,3) stacks
 *      (e.g. Hermes V2) but simplified for CreatorVault.
 *
 * How it works:
 * - Each CreatorGaugeController sends its voter slice (currently 9.61%) to this contract.
 * - The slice is recorded per (epoch, vault).
 * - Users claim pro-rata by their vote weight for that (epoch, vault).
 *
 * Reward token:
 * - We distribute vault shares (sTOKEN / ERC-4626 shares) for that vault.
 * - This keeps everything composable: users can hold shares or redeem underlying.
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVaultGaugeVotingForRewards {
    function currentEpoch() external view returns (uint256);
    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
}

contract VoterRewardsDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant BPS = 10_000;

    // ================================
    // IMMUTABLES
    // ================================

    IVaultGaugeVotingForRewards public immutable gaugeVoting;

    // ================================
    // STATE
    // ================================

    /// @notice Where zero-vote epoch rewards are swept after the grace period.
    /// @dev Set by owner; must be non-zero before sweeping is enabled.
    address public protocolTreasury;

    /// @notice Number of weekly epochs to wait before allowing a zero-vote epoch sweep.
    /// @dev 4 epochs ≈ 4 weeks after the epoch ends (sweepable starting epoch+5).
    uint256 public sweepGraceEpochs = 4;

    /// @notice Vault => reward token (vault shares token). Set on first notification.
    mapping(address => address) public vaultRewardToken;

    /// @notice epoch => vault => total rewards (in vault share tokens)
    mapping(uint256 => mapping(address => uint256)) public epochVaultRewards;

    /// @notice epoch => vault => user => claimed?
    mapping(uint256 => mapping(address => mapping(address => bool))) public hasClaimed;

    // ================================
    // EVENTS
    // ================================

    event RewardsNotified(uint256 indexed epoch, address indexed vault, address indexed token, uint256 amount);
    event RewardTokenSet(address indexed vault, address indexed token);
    event Claimed(uint256 indexed epoch, address indexed vault, address indexed user, address token, uint256 amount);
    event ProtocolTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ZeroVoteEpochSwept(
        uint256 indexed epoch,
        address indexed vault,
        address indexed token,
        uint256 amount,
        address protocolTreasury
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error RewardTokenMismatch();
    error ProtocolTreasuryNotSet();
    error SweepNotAllowedYet();
    error NotZeroVoteEpoch();
    error EpochNotEnded();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _gaugeVoting, address _owner) Ownable(_owner) {
        if (_gaugeVoting == address(0)) revert ZeroAddress();
        gaugeVoting = IVaultGaugeVotingForRewards(_gaugeVoting);
    }

    // ================================
    // ADMIN
    // ================================

    function setProtocolTreasury(address _protocolTreasury) external onlyOwner {
        if (_protocolTreasury == address(0)) revert ZeroAddress();
        address old = protocolTreasury;
        protocolTreasury = _protocolTreasury;
        emit ProtocolTreasuryUpdated(old, _protocolTreasury);
    }

    // ================================
    // NOTIFY (CALLED BY GAUGE CONTROLLERS)
    // ================================

    /**
     * @notice Notify rewards for a vault for the current epoch.
     * @dev Caller must have approved `token` to this contract.
     */
    function notifyRewards(address vault, address token, uint256 amount) external nonReentrant {
        if (vault == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        address existing = vaultRewardToken[vault];
        if (existing == address(0)) {
            vaultRewardToken[vault] = token;
            emit RewardTokenSet(vault, token);
        } else if (existing != token) {
            revert RewardTokenMismatch();
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 epoch = gaugeVoting.currentEpoch();
        epochVaultRewards[epoch][vault] += amount;

        emit RewardsNotified(epoch, vault, token, amount);
    }

    // ================================
    // SWEEP (OWNER-ONLY)
    // ================================

    /**
     * @notice Sweep rewards for a (epoch, vault) that had 0 votes, after the grace period.
     * @dev Your selected policy:
     *      - sweepGraceEpochs = 4
     *      - sweep only when vault vote weight == 0 for that epoch
     *      - sweep to protocolTreasury
     */
    function sweepZeroVoteEpoch(address vault, uint256 epoch) external onlyOwner nonReentrant returns (uint256 amount) {
        if (vault == address(0)) revert ZeroAddress();

        address treasury = protocolTreasury;
        if (treasury == address(0)) revert ProtocolTreasuryNotSet();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch + sweepGraceEpochs >= current) revert SweepNotAllowedYet();

        // Only sweep epochs with 0 votes for this vault (no eligible claimants).
        if (gaugeVoting.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();

        amount = epochVaultRewards[epoch][vault];
        if (amount == 0) return 0;

        address token = vaultRewardToken[vault];
        if (token == address(0)) revert ZeroAddress();

        // Effects before interactions
        epochVaultRewards[epoch][vault] = 0;

        IERC20(token).safeTransfer(treasury, amount);

        emit ZeroVoteEpochSwept(epoch, vault, token, amount, treasury);
    }

    // ================================
    // CLAIM
    // ================================

    function previewClaim(address user, address vault, uint256 epoch) external view returns (uint256 amount) {
        if (user == address(0) || vault == address(0)) return 0;
        // Strict epoch accounting: claims only after the epoch has ended (epoch is finalized).
        if (epoch >= gaugeVoting.currentEpoch()) return 0;
        if (hasClaimed[epoch][vault][user]) return 0;

        uint256 reward = epochVaultRewards[epoch][vault];
        if (reward == 0) return 0;

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) return 0;

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, user, vault);
        if (userWeight == 0) return 0;

        return (reward * userWeight) / totalWeight;
    }

    function claim(address vault, uint256 epoch) external nonReentrant returns (uint256 amount) {
        return _claim(msg.sender, vault, epoch);
    }

    function claimMany(address[] calldata vaults, uint256 epoch) external nonReentrant returns (uint256 totalAmount) {
        for (uint256 i = 0; i < vaults.length; i++) {
            totalAmount += _claim(msg.sender, vaults[i], epoch);
        }
    }

    function _claim(address user, address vault, uint256 epoch) internal returns (uint256 amount) {
        if (vault == address(0) || user == address(0)) revert ZeroAddress();
        // Strict epoch accounting: claims only after the epoch has ended (epoch is finalized).
        if (epoch >= gaugeVoting.currentEpoch()) revert EpochNotEnded();
        if (hasClaimed[epoch][vault][user]) return 0;

        address token = vaultRewardToken[vault];
        if (token == address(0)) {
            hasClaimed[epoch][vault][user] = true;
            return 0;
        }

        uint256 reward = epochVaultRewards[epoch][vault];
        if (reward == 0) {
            hasClaimed[epoch][vault][user] = true;
            return 0;
        }

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) {
            // Nobody voted for this vault this epoch → nobody can claim.
            // Keep rewards in the contract; governance can decide how to handle later.
            hasClaimed[epoch][vault][user] = true;
            return 0;
        }

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, user, vault);
        if (userWeight == 0) {
            hasClaimed[epoch][vault][user] = true;
            return 0;
        }

        amount = (reward * userWeight) / totalWeight;
        hasClaimed[epoch][vault][user] = true;

        if (amount > 0) {
            IERC20(token).safeTransfer(user, amount);
        }

        emit Claimed(epoch, vault, user, token, amount);
    }
}



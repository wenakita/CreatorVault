// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVaultGaugeVotingForBribeDepot {
    function currentEpoch() external view returns (uint256);
    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
}

/**
 * @title BribeDepot
 * @author CreatorVault
 * @notice Vault-scoped bribe depot for ve(3,3) voting epochs.
 * @dev Deployed per-vault by BribesFactory using CREATE2.
 */
contract BribeDepot is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // STATE
    // ================================

    /// @notice Vault this depot is tied to
    address public immutable vault;

    /// @notice Gauge voting contract used for vote weights
    IVaultGaugeVotingForBribeDepot public immutable gaugeVoting;

    /// @notice epoch => token => total bribe amount
    mapping(uint256 => mapping(address => uint256)) public totalBribes;

    /// @notice epoch => token => user => claimed
    mapping(uint256 => mapping(address => mapping(address => bool))) public claimed;

    // ================================
    // EVENTS
    // ================================

    event Bribed(address indexed token, uint256 amount, uint256 indexed epoch);
    event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error AlreadyClaimed();
    error NoUserVotes();

    constructor(address _vault, address _gaugeVoting) Ownable(msg.sender) {
        if (_vault == address(0) || _gaugeVoting == address(0)) revert ZeroAddress();
        vault = _vault;
        gaugeVoting = IVaultGaugeVotingForBribeDepot(_gaugeVoting);
    }

    /**
     * @notice Add bribe tokens for the current epoch.
     * @param token Token to bribe with
     * @param amount Amount to bribe
     */
    function bribe(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 epoch = gaugeVoting.currentEpoch();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalBribes[epoch][token] += amount;

        emit Bribed(token, amount, epoch);
    }

    /**
     * @notice Claim bribe rewards for a past epoch.
     * @param epoch Epoch to claim
     * @param token Token to claim
     */
    function claim(uint256 epoch, address token) external nonReentrant returns (uint256 amount) {
        if (claimed[epoch][token][msg.sender]) revert AlreadyClaimed();

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) revert NoUserVotes();

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, msg.sender, vault);
        if (userWeight == 0) revert NoUserVotes();

        uint256 totalAmount = totalBribes[epoch][token];
        amount = (totalAmount * userWeight) / totalWeight;

        claimed[epoch][token][msg.sender] = true;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, token, amount, epoch);
    }
}

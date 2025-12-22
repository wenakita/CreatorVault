// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title VotingPowerCalculator
 * @dev Library for calculating voting power for veDRAGON tokens
 * Supports linear and time-weighted calculation methods for simplicity and gas efficiency
 */
library VotingPowerCalculator {
  using Math for uint256;

  // Constants
  uint256 public constant PRECISION = 1e18;
  uint256 public constant BPS_DENOMINATOR = 10000;
  uint256 public constant SECONDS_PER_YEAR = 365 days;
  uint256 public constant MAX_LOCK_TIME = 4 * SECONDS_PER_YEAR;

  // Calculation methods for voting power (simplified)
  enum VotingPowerMethod {
    LINEAR, // Linear scaling with lock time
    TIME_WEIGHTED // Time-weighted balance (veCRV style)
  }

  /**
   * @dev Calculate voting power based on amount and lock time using the specified method
   * @param amount Amount of veDRAGON tokens
   * @param lockDuration Duration of lock in seconds
   * @param method Calculation method to use
   * @return votingPower The calculated voting power
   */
  function calculateVotingPower(
    uint256 amount,
    uint256 lockDuration,
    VotingPowerMethod method
  ) public pure returns (uint256 votingPower) {
    if (amount == 0) return 0;

    // Ensure lock duration is capped
    lockDuration = Math.min(lockDuration, MAX_LOCK_TIME);

    // Apply different calculation methods
    if (method == VotingPowerMethod.LINEAR) {
      return calculateLinearVotingPower(amount, lockDuration);
    } else if (method == VotingPowerMethod.TIME_WEIGHTED) {
      return calculateTimeWeightedVotingPower(amount, lockDuration);
    } else {
      // Default to linear if invalid method
      return calculateLinearVotingPower(amount, lockDuration);
    }
  }

  /**
   * @dev Calculate voting power using linear scaling with lock time
   * @param amount Amount of veDRAGON tokens
   * @param lockDuration Duration of lock in seconds
   * @return votingPower The calculated voting power
   */
  function calculateLinearVotingPower(uint256 amount, uint256 lockDuration) public pure returns (uint256 votingPower) {
    // Linear scaling: amount * (lockDuration / MAX_LOCK_TIME)
    // With minimum multiplier of 1x and maximum of 2.5x
    uint256 timeRatio = (lockDuration * PRECISION) / MAX_LOCK_TIME;
    uint256 boost = BPS_DENOMINATOR + ((15000 * timeRatio) / PRECISION); // 1.5x additional boost

    return (amount * boost) / BPS_DENOMINATOR;
  }

  /**
   * @dev Calculate voting power using time-weighted balance (veCRV style)
   * @param amount Amount of veDRAGON tokens
   * @param lockDuration Duration of lock in seconds
   * @return votingPower The calculated voting power
   */
  function calculateTimeWeightedVotingPower(
    uint256 amount,
    uint256 lockDuration
  ) public pure returns (uint256 votingPower) {
    // Time-weighted voting power: amount * lockDuration / MAX_LOCK_TIME
    return (amount * lockDuration) / MAX_LOCK_TIME;
  }

  /**
   * @dev Calculate effective voting power at a specific timestamp
   * @param amount Amount of veDRAGON tokens
   * @param lockEndTime Timestamp when lock expires
   * @param currentTime Current timestamp to calculate voting power at
   * @param method Calculation method to use
   * @return effectiveVotingPower The time-decayed voting power
   */
  function calculateEffectiveVotingPower(
    uint256 amount,
    uint256 lockEndTime,
    uint256 currentTime,
    VotingPowerMethod method
  ) public pure returns (uint256 effectiveVotingPower) {
    // If lock has expired, voting power is 0
    if (currentTime >= lockEndTime) return 0;

    // Calculate remaining lock duration
    uint256 remainingLockTime = lockEndTime - currentTime;

    // Calculate effective voting power using specified method
    return calculateVotingPower(amount, remainingLockTime, method);
  }

  /**
   * @dev Calculate weighted voting power for governance
   * @param amount Amount of veDRAGON tokens
   * @param lockEndTime Timestamp when lock expires
   * @param currentTime Current timestamp
   * @return weightedVotingPower The weighted voting power for governance
   */
  function calculateGovernanceVotingPower(
    uint256 amount,
    uint256 lockEndTime,
    uint256 currentTime
  ) public pure returns (uint256 weightedVotingPower) {
    // For governance, we use time-weighted power with a minimum 0.1x multiplier
    // If lock has expired, provide minimal voting rights (10% of tokens)
    if (currentTime >= lockEndTime) {
      return amount / 10;
    }

    // Calculate remaining lock duration
    uint256 remainingLockTime = lockEndTime - currentTime;

    // Use time-weighted method for governance
    uint256 baseVotingPower = calculateTimeWeightedVotingPower(amount, remainingLockTime);

    // Ensure minimum voting power is 10% of token amount
    return Math.max(baseVotingPower, amount / 10);
  }

  /**
   * @dev Calculate boost multiplier for rewards based on voting power
   * @param votingPower User's voting power
   * @param totalVotingPower Total voting power in the system
   * @param userBalance User's token balance
   * @param totalSupply Total token supply
   * @return boostMultiplier The boost multiplier in basis points (10000 = 1.0x)
   */
  function calculateRewardBoostMultiplier(
    uint256 votingPower,
    uint256 totalVotingPower,
    uint256 userBalance,
    uint256 totalSupply
  ) public pure returns (uint256 boostMultiplier) {
    if (votingPower == 0 || totalVotingPower == 0) {
      return BPS_DENOMINATOR; // Default 1.0x with no voting power
    }

    // Calculate vote share and token share
    uint256 voteShare = (votingPower * PRECISION) / totalVotingPower;
    uint256 tokenShare = (userBalance * PRECISION) / totalSupply;

    // Calculate boost based on the ratio of vote share to token share
    // A higher vote-to-token ratio gives more boost, capped at 2.5x
    uint256 shareRatio = (voteShare * PRECISION) / tokenShare;

    // Linear scaling from 1.0x to 2.5x based on share ratio
    // Maximum boost at 4.0x ratio (4 times more voting weight than token weight)
    uint256 maxBoostRatio = 4 * PRECISION;
    uint256 maxBoostMultiplier = 25000; // 2.5x

    if (shareRatio >= maxBoostRatio) {
      return maxBoostMultiplier;
    } else {
      uint256 boostRange = maxBoostMultiplier - BPS_DENOMINATOR;
      uint256 additionalBoost = (boostRange * shareRatio) / maxBoostRatio;
      return BPS_DENOMINATOR + additionalBoost;
    }
  }
}
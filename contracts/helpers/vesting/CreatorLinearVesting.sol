// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CreatorLinearVesting
 * @notice Minimal linear vesting wallet for the creator’s ShareOFT allocation.
 * @dev Intentionally small/simple (no cliff, no revocation) to minimize deployment gas.
 */
contract CreatorLinearVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint64 public immutable startTimestamp;
    uint64 public immutable durationSeconds;

    uint256 public released;

    error ZeroAddress();
    error ZeroDuration();

    constructor(address token_, address beneficiary_, uint64 startTimestamp_, uint64 durationSeconds_) {
        if (token_ == address(0) || beneficiary_ == address(0)) revert ZeroAddress();
        if (durationSeconds_ == 0) revert ZeroDuration();
        token = IERC20(token_);
        beneficiary = beneficiary_;
        startTimestamp = startTimestamp_;
        durationSeconds = durationSeconds_;
    }

    function vestedAmount(uint64 timestamp) public view returns (uint256) {
        uint256 total = token.balanceOf(address(this)) + released;
        if (timestamp <= startTimestamp) return 0;

        uint256 elapsed = uint256(timestamp - startTimestamp);
        if (elapsed >= uint256(durationSeconds)) return total;

        return (total * elapsed) / uint256(durationSeconds);
    }

    function releasable() public view returns (uint256) {
        uint256 vested = vestedAmount(uint64(block.timestamp));
        return vested > released ? vested - released : 0;
    }

    function release() external returns (uint256 amount) {
        amount = releasable();
        if (amount == 0) return 0;
        released += amount;
        token.safeTransfer(beneficiary, amount);
    }
}


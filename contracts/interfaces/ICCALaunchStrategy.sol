// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICCALaunchStrategy
 * @author 0xakita.eth
 * @notice Interface for configuring CCALaunchStrategy.
 * @dev Used by deployment and admin tooling.
 */
interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
}

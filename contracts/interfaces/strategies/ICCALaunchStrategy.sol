// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICCALaunchStrategy
 * @notice Interface for CCALaunchStrategy deployment
 */
interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
}

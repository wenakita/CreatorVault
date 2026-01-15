// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICreatorOVault
 * @author 0xakita.eth
 * @notice Minimal vault interface for registry and helper wiring.
 * @dev Used by batchers and controllers to configure vaults.
 */
interface ICreatorOVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function setGaugeController(address _controller) external;
    function setWhitelist(address _account, bool _status) external;
    function setProtocolRescue(address rescue) external;
    function transferOwnership(address newOwner) external;
    function convertToAssets(uint256 shares) external view returns (uint256);
}

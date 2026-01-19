// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal interface for Base's CrossChainERC20Factory used by the Base↔Solana bridge.
 *
 * Factory address (Base mainnet): 0xDD56781d0509650f8C2981231B6C917f2d5d7dF2
 */
interface ICrossChainERC20Factory {
    function BEACON() external view returns (address);

    function isCrossChainErc20(address token) external view returns (bool);

    function deploy(bytes32 remoteToken, string calldata name, string calldata symbol, uint8 decimals) external returns (address);
}


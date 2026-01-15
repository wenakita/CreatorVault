// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OFTBootstrapRegistry
 * @author 0xakita.eth
 * @notice Minimal registry for CreatorShareOFT construction.
 * @dev Used only during OFT deployment to resolve the LayerZero endpoint.
 */
contract OFTBootstrapRegistry {
    /// @dev LayerZero v2 common endpoint (used as a fallback).
    ///      This is the same value used by CreatorRegistry (`layerZeroCommonEndpoint`).
    address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    mapping(uint16 => address) public layerZeroEndpoints;

    event LayerZeroEndpointUpdated(uint16 indexed chainId, address endpoint);

    error ZeroAddress();

    /// @notice Set (or update) the LayerZero endpoint for a chain.
    /// @dev Permissionless by design — safe because it is only used during OFT construction,
    ///      and our AA batch sets the value atomically immediately before deployment.
    function setLayerZeroEndpoint(uint16 chainId, address endpoint) external {
        if (endpoint == address(0)) revert ZeroAddress();
        layerZeroEndpoints[chainId] = endpoint;
        emit LayerZeroEndpointUpdated(chainId, endpoint);
    }

    /// @notice Return the LayerZero endpoint for a chain, with a common fallback.
    function getLayerZeroEndpoint(uint16 chainId) external view returns (address) {
        address ep = layerZeroEndpoints[chainId];
        return ep == address(0) ? LZ_COMMON_ENDPOINT : ep;
    }
}

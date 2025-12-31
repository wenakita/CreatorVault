// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OFTBootstrapRegistry
 * @notice Minimal registry used ONLY at CreatorShareOFT construction time to resolve the LayerZero endpoint.
 * @dev This contract is intentionally:
 * - tiny (safe for calldata-based deployments)
 * - permissionless (anyone can set endpoints; we set it atomically right before deploying the OFT)
 * - chain-agnostic in constructor args (so the OFT initCode can be identical across chains)
 *
 * After OFT deployment, the real CreatorRegistry is set via CreatorShareOFT.setRegistry(...).
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

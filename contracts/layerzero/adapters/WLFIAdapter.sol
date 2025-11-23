// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IChainRegistry {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getCurrentChainId() external view returns (uint16);
}

/**
 * @title WLFIAdapter
 * @notice LayerZero OFT Adapter for native WLFI token on hub chains
 * 
 * @dev Deploy this on chains where WLFI already exists as a native ERC20
 *      (e.g., Ethereum mainnet, BNB Chain)
 * 
 * ARCHITECTURE:
 * - Wraps existing WLFI ERC20 token
 * - Locks tokens when bridging OUT
 * - Unlocks tokens when bridging IN
 * - Never changes native token supply
 * - Backed 1:1 by real WLFI tokens
 * - Uses EagleRegistry for LayerZero endpoint configuration ✅
 * 
 * PAIRING:
 * - Pairs with WLFIAssetOFT on spoke chains (Arbitrum, Base, etc.)
 * - Spoke chains mint/burn synthetic WLFI
 * - Hub chains lock/unlock native WLFI
 * 
 * USAGE:
 * 1. User approves native WLFI to this adapter
 * 2. User calls send() to bridge to another chain
 * 3. Adapter locks native WLFI
 * 4. LayerZero sends message to destination
 * 5. Destination OFT mints synthetic WLFI
 * 
 * FEES: 
 * - NO fees on WLFI (as per architecture)
 * - Only LayerZero messaging fees apply
 * 
 * REGISTRY:
 * - Uses EagleRegistry for centralized endpoint management
 * - No hardcoded addresses
 * - Easy to update if endpoints change
 */
contract WLFIAdapter is OFTAdapter {
    /// @notice EagleRegistry for LayerZero endpoint lookup
    IChainRegistry public immutable registry;
    
    /**
     * @notice Constructor for WLFI Adapter with EagleRegistry
     * @param _token Address of native WLFI ERC20 token
     * @param _registry Address of EagleRegistry contract
     * @param _delegate Admin address (can configure peers, etc.)
     */
    constructor(
        address _token,
        address _registry,
        address _delegate
    ) OFTAdapter(
        _token,
        _getEndpointFromRegistry(_registry),
        _delegate
    ) Ownable(_delegate) {
        require(_token != address(0), "WLFIAdapter: token cannot be zero");
        require(_registry != address(0), "WLFIAdapter: registry cannot be zero");
        require(_delegate != address(0), "WLFIAdapter: delegate cannot be zero");
        
        registry = IChainRegistry(_registry);
    }
    
    /**
     * @notice Get LayerZero endpoint from registry
     * @param _registry Registry address
     * @return LayerZero endpoint address for current chain
     */
    function _getEndpointFromRegistry(address _registry) private view returns (address) {
        IChainRegistry reg = IChainRegistry(_registry);
        uint16 chainId = reg.getCurrentChainId();
        address endpoint = reg.getLayerZeroEndpoint(chainId);
        require(endpoint != address(0), "WLFIAdapter: endpoint not configured in registry");
        return endpoint;
    }
    
    /**
     * @notice Get the name of this adapter (for identification)
     */
    function adapterName() external pure returns (string memory) {
        return "WLFI LayerZero Adapter";
    }
    
    /**
     * @notice Get the version of this adapter
     */
    function adapterVersion() external pure returns (string memory) {
        return "1.1.0"; // Updated to use registry
    }
    
    /**
     * @notice Get LayerZero endpoint address
     * @return Current LayerZero endpoint
     */
    function getEndpoint() external view returns (address) {
        uint16 chainId = registry.getCurrentChainId();
        return registry.getLayerZeroEndpoint(chainId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IEagleRegistry
 * @notice Interface for EagleRegistry - Universal chain registry for EagleOVault ecosystem
 */
interface IEagleRegistry {
    
    // ================================
    // STRUCTS
    // ================================
    
    struct ChainConfig {
        uint16 chainId;
        string chainName;
        address wrappedNative;
        string wrappedSymbol;
        bool isActive;
        uint32 layerZeroEid;
    }
    
    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    /**
     * @notice Get LayerZero endpoint for a specific chain
     * @param chainId The chain ID
     * @return The LayerZero endpoint address
     */
    function getLayerZeroEndpoint(uint16 chainId) external view returns (address);
    
    /**
     * @notice Get chain configuration
     * @param chainId The chain ID
     * @return The chain configuration
     */
    function getChainConfig(uint16 chainId) external view returns (ChainConfig memory);
    
    /**
     * @notice Check if a chain is registered
     * @param chainId The chain ID
     * @return True if registered
     */
    function isChainRegistered(uint16 chainId) external view returns (bool);
    
    /**
     * @notice Get all supported chain IDs
     * @return Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint16[] memory);
    
    /**
     * @notice Get current chain ID
     * @return The current chain ID
     */
    function getCurrentChainId() external view returns (uint16);
    
    /**
     * @notice Get LayerZero EID for a chain ID
     * @param chainId The chain ID
     * @return The LayerZero EID
     */
    function getEidForChainId(uint256 chainId) external view returns (uint32);
    
    /**
     * @notice Get chain ID for a LayerZero EID
     * @param eid The LayerZero EID
     * @return The chain ID
     */
    function getChainIdForEid(uint32 eid) external view returns (uint256);
    
    // ================================
    // ADMIN FUNCTIONS
    // ================================
    
    /**
     * @notice Register a new chain
     * @param chainId The chain ID
     * @param chainName The chain name
     * @param wrappedNative The wrapped native token address
     * @param wrappedSymbol The wrapped native token symbol
     * @param layerZeroEid The LayerZero endpoint ID
     */
    function registerChain(
        uint16 chainId,
        string memory chainName,
        address wrappedNative,
        string memory wrappedSymbol,
        uint32 layerZeroEid
    ) external;
    
    /**
     * @notice Set LayerZero endpoint for a chain
     * @param chainId The chain ID
     * @param endpoint The LayerZero endpoint address
     */
    function setLayerZeroEndpoint(uint16 chainId, address endpoint) external;
    
    /**
     * @notice Update chain status
     * @param chainId The chain ID
     * @param isActive The new status
     */
    function setChainStatus(uint16 chainId, bool isActive) external;
    
    /**
     * @notice Map chain ID to LayerZero EID
     * @param chainId The chain ID
     * @param eid The LayerZero EID
     */
    function setChainIdToEid(uint256 chainId, uint32 eid) external;
}


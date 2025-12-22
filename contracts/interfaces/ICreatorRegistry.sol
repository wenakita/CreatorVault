// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICreatorRegistry
 * @notice Interface for CreatorVault ecosystem registry
 * @dev Manages Creator Coin mappings, chain configurations, and LayerZero setup
 * 
 * @dev KEY FEATURES:
 *      - Register Creator Coins and their vault/OFT deployments
 *      - Chain configuration for multi-chain deployments
 *      - LayerZero endpoint and DVN configuration
 *      - Ecosystem contract lookups (lottery, gauge, etc.)
 */
interface ICreatorRegistry {
    
    // =================================
    // STRUCTS
    // =================================
    
    /**
     * @notice Information about a registered Creator Coin
     */
    struct CreatorCoinInfo {
        address token;           // Creator Coin token address
        string name;             // Token name
        string symbol;           // Token symbol
        address vault;           // CreatOVault address
        address shareOFT;        // CreatorShareOFT address
        address wrapper;         // CreatorOVaultWrapper address
        address creator;         // Creator's address (admin)
        address pool;            // Primary liquidity pool
        uint24 poolFee;          // Pool fee tier (e.g., 3000 = 0.3%)
        uint16 primaryChainId;   // Chain where token originated
        bool isActive;           // Active status
        uint256 registeredAt;    // Registration timestamp
    }
    
    /**
     * @notice Chain configuration
     */
    struct ChainConfig {
        uint16 chainId;
        string chainName;
        address wrappedNativeToken;
        string wrappedNativeSymbol;
        address poolManager;        // Uniswap V4 PoolManager
        address swapRouter;         // UniversalRouter
        address positionManager;    // V4 PositionManager
        address quoter;             // Quoter
        address chainlinkNativeFeed;
        bool isActive;
    }
    
    /**
     * @notice LayerZero configuration per chain
     */
    struct LzConfig {
        address endpoint;
        uint32 eid;
        address sendLib;
        address receiveLib;
        address executor;
        address dvn;
        address lzReadDvn;
        address[] optionalDvns;
        uint64 confirmations;
        bool isConfigured;
        bool useCustomOApp;
    }
    
    // =================================
    // EVENTS
    // =================================
    
    event CreatorCoinRegistered(
        address indexed token,
        string name,
        string symbol,
        address indexed creator,
        address vault,
        address shareOFT,
        address wrapper
    );
    
    event CreatorCoinUpdated(address indexed token);
    event CreatorCoinStatusChanged(address indexed token, bool isActive);
    
    event ChainRegistered(uint16 indexed chainId, string chainName);
    event ChainUpdated(uint16 indexed chainId);
    event ChainStatusChanged(uint16 indexed chainId, bool isActive);
    
    event LayerZeroEndpointUpdated(uint16 indexed chainId, address endpoint);
    event LzConfigUpdated(uint16 indexed chainId);
    
    event EcosystemContractSet(uint16 indexed chainId, string contractType, address indexed contractAddress);
    
    // =================================
    // CREATOR COIN MANAGEMENT
    // =================================
    
    /**
     * @notice Register a new Creator Coin
     * @param _token Creator Coin token address
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _creator Creator's address
     * @param _pool Primary liquidity pool
     * @param _poolFee Pool fee tier
     */
    function registerCreatorCoin(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _creator,
        address _pool,
        uint24 _poolFee
    ) external;
    
    /**
     * @notice Set vault address for a Creator Coin
     */
    function setCreatorVault(address _token, address _vault) external;
    
    /**
     * @notice Set ShareOFT address for a Creator Coin
     */
    function setCreatorShareOFT(address _token, address _shareOFT) external;
    
    /**
     * @notice Set wrapper address for a Creator Coin
     */
    function setCreatorWrapper(address _token, address _wrapper) external;
    
    /**
     * @notice Set active status for a Creator Coin
     */
    function setCreatorCoinStatus(address _token, bool _isActive) external;
    
    // =================================
    // CREATOR COIN GETTERS
    // =================================
    
    /**
     * @notice Get full Creator Coin info
     */
    function getCreatorCoin(address _token) external view returns (CreatorCoinInfo memory);
    
    /**
     * @notice Get vault for a Creator Coin
     */
    function getVaultForToken(address _token) external view returns (address);
    
    /**
     * @notice Get ShareOFT for a Creator Coin
     */
    function getShareOFTForToken(address _token) external view returns (address);
    
    /**
     * @notice Get wrapper for a Creator Coin
     */
    function getWrapperForToken(address _token) external view returns (address);
    
    /**
     * @notice Get all registered Creator Coins
     */
    function getAllCreatorCoins() external view returns (address[] memory);
    
    /**
     * @notice Check if a Creator Coin is registered
     */
    function isCreatorCoinRegistered(address _token) external view returns (bool);
    
    // =================================
    // CHAIN CONFIGURATION
    // =================================
    
    /**
     * @notice Register a new chain
     */
    function registerChain(
        uint16 _chainId,
        string calldata _chainName,
        address _wrappedNativeToken,
        bool _isActive
    ) external;
    
    /**
     * @notice Set DEX infrastructure for a chain
     */
    function setDexInfrastructure(
        uint16 _chainId,
        address _poolManager,
        address _swapRouter,
        address _positionManager,
        address _quoter
    ) external;
    
    /**
     * @notice Set chain active status
     */
    function setChainStatus(uint16 _chainId, bool _isActive) external;
    
    /**
     * @notice Get chain configuration
     */
    function getChainConfig(uint16 _chainId) external view returns (ChainConfig memory);
    
    /**
     * @notice Get all supported chains
     */
    function getSupportedChains() external view returns (uint16[] memory);
    
    /**
     * @notice Get current chain ID
     */
    function getCurrentChainId() external view returns (uint16);
    
    /**
     * @notice Check if chain is supported
     */
    function isChainSupported(uint16 _chainId) external view returns (bool);
    
    // =================================
    // LAYERZERO CONFIGURATION
    // =================================
    
    /**
     * @notice Set LayerZero endpoint for a chain
     */
    function setLayerZeroEndpoint(uint16 _chainId, address _endpoint) external;
    
    /**
     * @notice Get LayerZero endpoint for a chain
     */
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Set chain ID to LayerZero EID mapping
     */
    function setChainIdToEid(uint256 _chainId, uint32 _eid) external;
    
    /**
     * @notice Get EID for a chain ID
     */
    function getEidForChainId(uint256 _chainId) external view returns (uint32);
    
    /**
     * @notice Get chain ID for an EID
     */
    function getChainIdForEid(uint32 _eid) external view returns (uint256);
    
    /**
     * @notice Get full LZ config for a chain
     */
    function getLzConfig(uint16 _chainId) external view returns (LzConfig memory);
    
    /**
     * @notice Get effective LZ config (custom or default)
     */
    function getEffectiveLzConfig(uint16 _chainId) external view returns (LzConfig memory);
    
    // =================================
    // ECOSYSTEM CONTRACTS
    // =================================
    
    /**
     * @notice Set lottery manager for a chain
     */
    function setLotteryManager(uint16 _chainId, address _manager) external;
    
    /**
     * @notice Get lottery manager for a chain
     */
    function getLotteryManager(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Set gauge controller for a chain
     */
    function setGaugeController(uint16 _chainId, address _controller) external;
    
    /**
     * @notice Get gauge controller for a chain
     */
    function getGaugeController(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Set gas reserve for a chain
     */
    function setGasReserve(uint16 _chainId, address _reserve) external;
    
    /**
     * @notice Get gas reserve for a chain
     */
    function getGasReserve(uint16 _chainId) external view returns (address);
    
    // =================================
    // CHAIN LOOKUPS
    // =================================
    
    /**
     * @notice Get wrapped native token for a chain
     */
    function getWrappedNativeToken(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Get pool manager for a chain
     */
    function getPoolManager(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Get swap router for a chain
     */
    function getSwapRouter(uint16 _chainId) external view returns (address);
    
    /**
     * @notice Check if this is the hub chain
     */
    function isHubChain() external view returns (bool);
    
    /**
     * @notice Get hub chain ID
     */
    function hubChainId() external view returns (uint16);
    
    /**
     * @notice Get hub chain EID
     */
    function hubChainEid() external view returns (uint32);
}



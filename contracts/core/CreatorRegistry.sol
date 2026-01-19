// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";

/**
 * @title CreatorRegistry
 * @author 0xakita.eth
 * @notice Registry for CreatorVault deployments and configs.
 * @dev Used by factories, vaults, and OFTs to resolve ecosystem addresses.
 */
contract CreatorRegistry is ICreatorRegistry, Ownable {
    
    // =================================
    // CONSTANTS
    // =================================
    
    uint256 public constant MAX_SUPPORTED_CHAINS = 99;
    uint256 public constant MAX_CREATOR_COINS = 999999;
    
    // =================================
    // CREATOR COIN STORAGE
    // =================================
    
    /// @notice Creator Coin info by token address
    mapping(address => CreatorCoinInfo) private creatorCoins;
    
    /// @notice Reverse lookup: vault → token
    mapping(address => address) public vaultToToken;
    
    /// @notice Reverse lookup: shareOFT → token
    mapping(address => address) public shareOFTToToken;
    
    /// @notice Reverse lookup: wrapper → token
    mapping(address => address) public wrapperToToken;
    
    /// @notice Reverse lookup: oracle → token
    mapping(address => address) public oracleToToken;
    
    /// @notice Reverse lookup: gaugeController → token
    mapping(address => address) public gaugeControllerToToken;
    
    /// @notice All registered Creator Coin addresses
    address[] private registeredTokens;
    
    /// @notice Authorized factories that can register Creator Coins
    mapping(address => bool) public authorizedFactories;
    
    // =================================
    // CHAIN CONFIGURATION
    // =================================
    
    /// @notice Chain config by chain ID
    mapping(uint16 => ChainConfig) private chainConfigs;
    
    /// @notice All supported chains
    uint16[] private supportedChains;
    
    /// @notice Current chain ID
    uint16 private currentChainId;
    
    // =================================
    // LAYERZERO CONFIGURATION
    // =================================
    
    /// @notice LayerZero endpoints by chain
    mapping(uint16 => address) public layerZeroEndpoints;
    
    /// @notice Chain ID to LZ EID mapping
    mapping(uint256 => uint32) public chainIdToEid;
    mapping(uint32 => uint256) public eidToChainId;
    
    /// @notice LZ config per chain
    mapping(uint16 => LzConfig) public lzConfigs;
    
    /// @notice Default LZ config for standard chains
    LzConfig public defaultLzConfig;
    
    /// @notice Common LZ endpoint (fallback)
    address public immutable layerZeroCommonEndpoint;
    
    // =================================
    // ECOSYSTEM CONTRACTS
    // =================================
    
    /// @notice Lottery managers by chain
    mapping(uint16 => address) public lotteryManagers;
    
    /// @notice Gauge controllers by chain
    mapping(uint16 => address) public gaugeControllers;
    
    /// @notice Gas reserves by chain
    mapping(uint16 => address) public gasReserves;
    
    /// @notice Hub chain configuration
    uint16 public hubChainId = 8453; // Base
    uint32 public hubChainEid = 30184;
    
    // =================================
    // ADDITIONAL EVENTS
    // =================================
    
    event FactoryAuthorized(address indexed factory, bool status);
    event HubChainSet(uint16 chainId, uint32 eid);
    
    // =================================
    // ERRORS
    // =================================
    
    error ChainAlreadyRegistered(uint16 chainId);
    error ChainNotRegistered(uint16 chainId);
    error CreatorCoinAlreadyRegistered(address token);
    error CreatorCoinNotRegistered(address token);
    error TooManyChains();
    error TooManyCreatorCoins();
    error ZeroAddress();
    error NotAuthorized();
    
    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyAuthorizedOrOwner() {
        if (msg.sender != owner() && !authorizedFactories[msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _initialOwner) Ownable(_initialOwner) {
        if (_initialOwner == address(0)) revert ZeroAddress();
        
        currentChainId = uint16(block.chainid);
        
        // Common LayerZero endpoint address
        layerZeroCommonEndpoint = address(bytes20(hex"1a44076050125825900e736c501f859c50fe728c"));
        
        // Pre-configure Base (hub chain)
        layerZeroEndpoints[8453] = layerZeroCommonEndpoint;
        chainIdToEid[8453] = 30184;
        eidToChainId[30184] = 8453;
        
        emit CurrentChainSet(currentChainId);
    }
    
    // =================================
    // FACTORY AUTHORIZATION
    // =================================
    
    /**
     * @notice Authorize a factory to register Creator Coins
     */
    function setAuthorizedFactory(address _factory, bool _authorized) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        authorizedFactories[_factory] = _authorized;
        emit FactoryAuthorized(_factory, _authorized);
    }
    
    // =================================
    // CREATOR COIN MANAGEMENT
    // =================================
    
    /**
     * @notice Register a new Creator Coin
     */
    function registerCreatorCoin(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _creator,
        address _pool,
        uint24 _poolFee
    ) external override onlyAuthorizedOrOwner {
        if (_token == address(0)) revert ZeroAddress();
        if (creatorCoins[_token].token != address(0)) revert CreatorCoinAlreadyRegistered(_token);
        if (registeredTokens.length >= MAX_CREATOR_COINS) revert TooManyCreatorCoins();
        
        creatorCoins[_token] = CreatorCoinInfo({
            token: _token,
            name: _name,
            symbol: _symbol,
            vault: address(0),
            shareOFT: address(0),
            wrapper: address(0),
            oracle: address(0),
            gaugeController: address(0),
            creator: _creator,
            pool: _pool,
            poolFee: _poolFee,
            primaryChainId: currentChainId,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        registeredTokens.push(_token);
        
        emit CreatorCoinRegistered(
            _token,
            _name,
            _symbol,
            _creator,
            address(0),
            address(0),
            address(0)
        );
    }
    
    /**
     * @notice Set vault address for a Creator Coin
     */
    function setCreatorVault(address _token, address _vault) external override onlyAuthorizedOrOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        if (_vault == address(0)) revert ZeroAddress();
        
        // Clear old reverse mapping if exists
        if (creatorCoins[_token].vault != address(0)) {
            delete vaultToToken[creatorCoins[_token].vault];
        }
        
        creatorCoins[_token].vault = _vault;
        vaultToToken[_vault] = _token;
        
        emit CreatorCoinUpdated(_token);
    }
    
    /**
     * @notice Set ShareOFT address for a Creator Coin
     */
    function setCreatorShareOFT(address _token, address _shareOFT) external override onlyAuthorizedOrOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        if (_shareOFT == address(0)) revert ZeroAddress();
        
        // Clear old reverse mapping if exists
        if (creatorCoins[_token].shareOFT != address(0)) {
            delete shareOFTToToken[creatorCoins[_token].shareOFT];
        }
        
        creatorCoins[_token].shareOFT = _shareOFT;
        shareOFTToToken[_shareOFT] = _token;
        
        emit CreatorCoinUpdated(_token);
    }
    
    /**
     * @notice Set wrapper address for a Creator Coin
     */
    function setCreatorWrapper(address _token, address _wrapper) external override onlyAuthorizedOrOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        if (_wrapper == address(0)) revert ZeroAddress();
        
        // Clear old reverse mapping if exists
        if (creatorCoins[_token].wrapper != address(0)) {
            delete wrapperToToken[creatorCoins[_token].wrapper];
        }
        
        creatorCoins[_token].wrapper = _wrapper;
        wrapperToToken[_wrapper] = _token;
        
        emit CreatorCoinUpdated(_token);
    }
    
    /**
     * @notice Set oracle address for a Creator Coin
     */
    function setCreatorOracle(address _token, address _oracle) external override onlyAuthorizedOrOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        if (_oracle == address(0)) revert ZeroAddress();
        
        // Clear old reverse mapping if exists
        if (creatorCoins[_token].oracle != address(0)) {
            delete oracleToToken[creatorCoins[_token].oracle];
        }
        
        creatorCoins[_token].oracle = _oracle;
        oracleToToken[_oracle] = _token;
        
        emit CreatorCoinUpdated(_token);
    }
    
    /**
     * @notice Set gauge controller address for a Creator Coin
     */
    function setCreatorGaugeController(address _token, address _gaugeController) external override onlyAuthorizedOrOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        if (_gaugeController == address(0)) revert ZeroAddress();
        
        // Clear old reverse mapping if exists
        if (creatorCoins[_token].gaugeController != address(0)) {
            delete gaugeControllerToToken[creatorCoins[_token].gaugeController];
        }
        
        creatorCoins[_token].gaugeController = _gaugeController;
        gaugeControllerToToken[_gaugeController] = _token;
        
        emit CreatorCoinUpdated(_token);
    }
    
    /**
     * @notice Set active status for a Creator Coin
     */
    function setCreatorCoinStatus(address _token, bool _isActive) external override onlyOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        
        creatorCoins[_token].isActive = _isActive;
        
        emit CreatorCoinStatusChanged(_token, _isActive);
    }
    
    /**
     * @notice Update Creator Coin pool info
     */
    function setCreatorPool(address _token, address _pool, uint24 _poolFee) external onlyOwner {
        if (creatorCoins[_token].token == address(0)) revert CreatorCoinNotRegistered(_token);
        
        creatorCoins[_token].pool = _pool;
        creatorCoins[_token].poolFee = _poolFee;
        
        emit CreatorCoinUpdated(_token);
    }
    
    // =================================
    // CREATOR COIN GETTERS
    // =================================
    
    function getCreatorCoin(address _token) external view override returns (CreatorCoinInfo memory) {
        return creatorCoins[_token];
    }
    
    function getVaultForToken(address _token) external view override returns (address) {
        return creatorCoins[_token].vault;
    }
    
    function getShareOFTForToken(address _token) external view override returns (address) {
        return creatorCoins[_token].shareOFT;
    }
    
    function getWrapperForToken(address _token) external view override returns (address) {
        return creatorCoins[_token].wrapper;
    }
    
    function getOracleForToken(address _token) external view override returns (address) {
        return creatorCoins[_token].oracle;
    }
    
    function getGaugeControllerForToken(address _token) external view override returns (address) {
        return creatorCoins[_token].gaugeController;
    }
    
    function getAllCreatorCoins() external view override returns (address[] memory) {
        return registeredTokens;
    }
    
    function isCreatorCoinRegistered(address _token) external view override returns (bool) {
        return creatorCoins[_token].token != address(0);
    }
    
    function isCreatorCoinActive(address _token) external view override returns (bool) {
        return creatorCoins[_token].token != address(0) && creatorCoins[_token].isActive;
    }
    
    function getCreatorCoinCount() external view returns (uint256) {
        return registeredTokens.length;
    }
    
    /**
     * @notice Get token address from vault
     */
    function getTokenForVault(address _vault) external view returns (address) {
        return vaultToToken[_vault];
    }
    
    /**
     * @notice Get token address from ShareOFT
     */
    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        return shareOFTToToken[_shareOFT];
    }
    
    // =================================
    // CHAIN CONFIGURATION
    // =================================
    
    function registerChain(
        uint16 _chainId,
        string calldata _chainName,
        address _wrappedNativeToken,
        bool _isActive
    ) external override onlyOwner {
        if (_wrappedNativeToken == address(0)) revert ZeroAddress();
        if (chainConfigs[_chainId].chainId != 0) revert ChainAlreadyRegistered(_chainId);
        if (supportedChains.length >= MAX_SUPPORTED_CHAINS) revert TooManyChains();
        
        chainConfigs[_chainId] = ChainConfig({
            chainId: _chainId,
            chainName: _chainName,
            wrappedNativeToken: _wrappedNativeToken,
            wrappedNativeSymbol: _getDefaultWrappedNativeSymbol(_chainId),
            poolManager: address(0),
            swapRouter: address(0),
            positionManager: address(0),
            quoter: address(0),
            chainlinkNativeFeed: address(0),
            isActive: _isActive
        });
        
        supportedChains.push(_chainId);
        
        emit ChainRegistered(_chainId, _chainName);
    }
    
    function setDexInfrastructure(
        uint16 _chainId,
        address _poolManager,
        address _swapRouter,
        address _positionManager,
        address _quoter
    ) external override onlyOwner {
        if (chainConfigs[_chainId].chainId == 0) revert ChainNotRegistered(_chainId);
        
        chainConfigs[_chainId].poolManager = _poolManager;
        chainConfigs[_chainId].swapRouter = _swapRouter;
        chainConfigs[_chainId].positionManager = _positionManager;
        chainConfigs[_chainId].quoter = _quoter;
        
        emit ChainUpdated(_chainId);
    }
    
    function setChainStatus(uint16 _chainId, bool _isActive) external override onlyOwner {
        if (chainConfigs[_chainId].chainId == 0) revert ChainNotRegistered(_chainId);
        
        chainConfigs[_chainId].isActive = _isActive;
        
        emit ChainStatusChanged(_chainId, _isActive);
    }
    
    function getChainConfig(uint16 _chainId) external view override returns (ChainConfig memory) {
        return chainConfigs[_chainId];
    }
    
    function getSupportedChains() external view override returns (uint16[] memory) {
        return supportedChains;
    }
    
    function getCurrentChainId() external view override returns (uint16) {
        return currentChainId;
    }
    
    function isChainSupported(uint16 _chainId) external view override returns (bool) {
        return chainConfigs[_chainId].isActive && chainConfigs[_chainId].chainId != 0;
    }
    
    // =================================
    // LAYERZERO CONFIGURATION
    // =================================
    
    function setLayerZeroEndpoint(uint16 _chainId, address _endpoint) external override onlyOwner {
        if (_endpoint == address(0)) revert ZeroAddress();
        
        layerZeroEndpoints[_chainId] = _endpoint;
        
        emit LayerZeroEndpointUpdated(_chainId, _endpoint);
    }
    
    function getLayerZeroEndpoint(uint16 _chainId) external view override returns (address) {
        address ep = layerZeroEndpoints[_chainId];
        return ep == address(0) ? layerZeroCommonEndpoint : ep;
    }
    
    function setChainIdToEid(uint256 _chainId, uint32 _eid) external override onlyOwner {
        chainIdToEid[_chainId] = _eid;
        eidToChainId[_eid] = _chainId;
        
        emit ChainIdToEidUpdated(uint16(_chainId), _eid);
    }
    
    function getEidForChainId(uint256 _chainId) external view override returns (uint32) {
        return chainIdToEid[_chainId];
    }
    
    function getChainIdForEid(uint32 _eid) external view override returns (uint256) {
        return eidToChainId[_eid];
    }
    
    function getLzConfig(uint16 _chainId) external view override returns (LzConfig memory) {
        return lzConfigs[_chainId];
    }
    
    function getEffectiveLzConfig(uint16 _chainId) external view override returns (LzConfig memory) {
        LzConfig memory config = lzConfigs[_chainId];
        
        if (config.useCustomOApp || config.isConfigured) {
            return config;
        }
        
        // Use default config with chain-specific EID and endpoint
        LzConfig memory effective = defaultLzConfig;
        effective.eid = chainIdToEid[_chainId];
        effective.endpoint = layerZeroEndpoints[_chainId] != address(0) 
            ? layerZeroEndpoints[_chainId] 
            : layerZeroCommonEndpoint;
        return effective;
    }
    
    /**
     * @notice Set full LZ config for a chain
     */
    function setLzConfig(
        uint16 _chainId,
        address _endpoint,
        uint32 _eid,
        address _sendLib,
        address _receiveLib,
        address _executor,
        address _dvn,
        address _lzReadDvn,
        uint64 _confirmations,
        bool _useCustomOApp
    ) external onlyOwner {
        lzConfigs[_chainId] = LzConfig({
            endpoint: _endpoint,
            eid: _eid,
            sendLib: _sendLib,
            receiveLib: _receiveLib,
            executor: _executor,
            dvn: _dvn,
            lzReadDvn: _lzReadDvn,
            optionalDvns: new address[](0),
            confirmations: _confirmations,
            isConfigured: true,
            useCustomOApp: _useCustomOApp
        });
        
        layerZeroEndpoints[_chainId] = _endpoint;
        chainIdToEid[_chainId] = _eid;
        eidToChainId[_eid] = _chainId;
        
        emit LzConfigUpdated(_chainId);
    }
    
    /**
     * @notice Set default LZ config for standard chains
     */
    function setDefaultLzConfig(
        address _endpoint,
        address _sendLib,
        address _receiveLib,
        address _executor,
        address _dvn,
        address _lzReadDvn,
        uint64 _confirmations
    ) external onlyOwner {
        defaultLzConfig = LzConfig({
            endpoint: _endpoint,
            eid: 0,
            sendLib: _sendLib,
            receiveLib: _receiveLib,
            executor: _executor,
            dvn: _dvn,
            lzReadDvn: _lzReadDvn,
            optionalDvns: new address[](0),
            confirmations: _confirmations,
            isConfigured: true,
            useCustomOApp: false
        });
    }
    
    // =================================
    // ECOSYSTEM CONTRACTS
    // =================================
    
    function setLotteryManager(uint16 _chainId, address _manager) external override onlyOwner {
        lotteryManagers[_chainId] = _manager;
        emit EcosystemContractSet(_chainId, "LotteryManager", _manager);
    }
    
    function getLotteryManager(uint16 _chainId) external view override returns (address) {
        return lotteryManagers[_chainId];
    }
    
    function setGaugeController(uint16 _chainId, address _controller) external override onlyOwner {
        gaugeControllers[_chainId] = _controller;
        emit EcosystemContractSet(_chainId, "GaugeController", _controller);
    }
    
    function getGaugeController(uint16 _chainId) external view override returns (address) {
        return gaugeControllers[_chainId];
    }
    
    function setGasReserve(uint16 _chainId, address _reserve) external override onlyOwner {
        gasReserves[_chainId] = _reserve;
        emit EcosystemContractSet(_chainId, "GasReserve", _reserve);
    }
    
    function getGasReserve(uint16 _chainId) external view override returns (address) {
        return gasReserves[_chainId];
    }
    
    /**
     * @notice Set hub chain
     */
    function setHubChain(uint16 _chainId, uint32 _eid) external onlyOwner {
        hubChainId = _chainId;
        hubChainEid = _eid;
        emit HubChainSet(_chainId, _eid);
    }
    
    function isHubChain() external view override returns (bool) {
        return uint16(block.chainid) == hubChainId;
    }
    
    // =================================
    // CHAIN LOOKUPS
    // =================================
    
    function getWrappedNativeToken(uint16 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].wrappedNativeToken;
    }
    
    function getPoolManager(uint16 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].poolManager;
    }
    
    function getSwapRouter(uint16 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].swapRouter;
    }
    
    /**
     * @notice Get position manager for a chain
     */
    function getPositionManager(uint16 _chainId) external view returns (address) {
        return chainConfigs[_chainId].positionManager;
    }
    
    /**
     * @notice Get quoter for a chain
     */
    function getQuoter(uint16 _chainId) external view returns (address) {
        return chainConfigs[_chainId].quoter;
    }
    
    // =================================
    // INTERNAL HELPERS
    // =================================
    
    function _getDefaultWrappedNativeSymbol(uint256 _chainId) internal pure returns (string memory) {
        if (_chainId == 146) return "WS";        // Sonic
        if (_chainId == 43114) return "WAVAX";   // Avalanche
        if (_chainId == 250) return "WFTM";      // Fantom
        if (_chainId == 137) return "WMATIC";    // Polygon
        if (_chainId == 56) return "WBNB";       // BSC
        if (_chainId == 999) return "WHYPE";     // HyperEVM
        if (_chainId == 10143) return "WMONAD";  // Monad
        return "WETH";
    }
    
    // =================================
    // EVENTS FOR MISSING INTERFACE EVENTS
    // =================================
    
    event CurrentChainSet(uint16 indexed chainId);
    event ChainIdToEidUpdated(uint16 indexed chainId, uint32 eid);
}



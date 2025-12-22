// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/config/IOmniDragonRegistry.sol";

/**
 * @title OmniDragonRegistry
 * @author 0xakita.eth
 * @dev Registry for omniDRAGON deployment
 *
 * Provides:
 * - Deterministic address calculation via CREATE2
 * - Basic chain configuration storage
 * - LayerZero configuration during deployment
 */
contract OmniDragonRegistry is IOmniDragonRegistry, Ownable {
  // Chain configuration
  mapping(uint16 => IOmniDragonRegistry.ChainConfig) private chainConfigs;
  uint16[] private supportedChains;
  uint16 private currentChainId;
  uint256 public constant MAX_SUPPORTED_CHAINS = 69;

  // LayerZero endpoints and mapping
  mapping(uint256 => uint32) public chainIdToEid;
  mapping(uint32 => uint256) public eidToChainId;
  mapping(uint16 => address) public layerZeroEndpoints;
  address public immutable layerZeroCommonEndpoint;
  address public immutable layerZeroUncommonEndpoint;

  // Oracles
  mapping(uint16 => address) public priceOracles;
  mapping(uint16 => IOmniDragonRegistry.OracleConfig) public oracleConfigs;
  address public primaryOracle;
  uint32 public primaryChainEid;
  mapping(uint16 => address) public secondaryOracles;

  // ============ Ecosystem Contract Registry ============
  mapping(uint16 => address) public jackpotVaults;      // chainId => vault
  mapping(uint16 => address) public gasReserves;        // chainId => LZ gas reserve
  mapping(uint16 => address) public lotteryManagers;    // chainId => lottery manager
  mapping(uint16 => address) public v4Hooks;            // chainId => V4 hook
  mapping(uint16 => address) public dragonTokens;       // chainId => DRAGON token
  
  // ============ DragonOVault Vault System ============
  mapping(uint16 => address) public dragonOVaults;  // chainId => DragonOVault vault
  mapping(uint16 => address) public veDragonContracts;  // chainId => veDRAGON
  mapping(uint16 => address) public gaugeControllers;   // chainId => GaugeController
  mapping(uint16 => address) public lpManagers;         // chainId => DragonLPManager

  // Hub chain configuration (Base is the hub)
  uint16 public hubChainId = 8453;  // Base
  uint32 public hubChainEid = 30184;

  // ============ LayerZero Per-Chain Config ============
  mapping(uint16 => IOmniDragonRegistry.LzConfig) public lzConfigs;
  
  // Default LZ config for standard chains (uses common endpoint)
  IOmniDragonRegistry.LzConfig public defaultLzConfig;
  
  // Chains that require custom OApp setup (e.g., Monad, Sonic)
  mapping(uint16 => bool) public customOAppChains;

  // Events
  event CurrentChainSet(uint16 indexed chainId);
  event LayerZeroConfigured(address indexed oapp, uint32 indexed eid, string configType);
  event LayerZeroLibrarySet(address indexed oapp, uint32 indexed eid, address lib, string libraryType);
  event LayerZeroEndpointUpdated(uint16 indexed chainId, address endpoint);
  event WrappedNativeSymbolUpdated(uint16 indexed chainId, string symbol);
  event ChainIdToEidUpdated(uint256 chainId, uint32 eid);
  event SecondaryOracleSet(uint16 indexed chainId, address indexed oracle);
  event EcosystemContractSet(uint16 indexed chainId, string contractType, address indexed contractAddress);
  event HubChainSet(uint16 chainId, uint32 eid);

  // Errors
  error ChainAlreadyRegistered(uint16 chainId);
  error ChainNotRegistered(uint16 chainId);
  error ZeroAddress();
  error TooManyChains();
  error InfrastructureAlreadyLocked(uint16 chainId);
  
  // ============ Set-Once Security for Critical Infrastructure ============
  // Once locked, PoolManager and other critical DEX addresses cannot be changed
  mapping(uint16 => bool) public dexInfrastructureLocked;
  
  // Additional V4 infrastructure not in ChainConfig
  mapping(uint16 => address) public stateViews;         // V4 StateView for reading pool state
  mapping(uint16 => address) public permit2Addresses;   // Permit2 (usually same on all chains)
  
  // NOTE: VRF, Treasury, Governance, and Pool Defaults moved to OmniDragonRegistryExtension
  // to keep this contract under the EVM size limit (24KB)

  struct SetConfigParam { uint32 eid; uint32 configType; bytes config; }

  constructor(address _initialOwner) Ownable(_initialOwner) {
    currentChainId = uint16(block.chainid);
    // Common LayerZero endpoint address (used as default fallback)
    layerZeroCommonEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
    layerZeroUncommonEndpoint = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;
    
    // Only Base (hub chain) is pre-configured - all other chains configured via setLayerZeroEndpoint()
    layerZeroEndpoints[8453] = layerZeroCommonEndpoint; // Base (hub)
    chainIdToEid[8453] = 30184; // Base EID
    eidToChainId[30184] = 8453;
  }

  // Internal
  function _getDefaultWrappedNativeSymbol(uint256 _chainId) internal pure returns (string memory) {
    if (_chainId == 146) return "WS";
    if (_chainId == 43114) return "WAVAX";
    if (_chainId == 250) return "WFTM";
    if (_chainId == 137) return "WMATIC";
    if (_chainId == 56) return "WBNB";
    if (_chainId == 239) return "WTAC";
    if (_chainId == 999) return "WHYPE";    
    if (_chainId == 143) return "WMONAD"; 
    return "WETH";
  }

  // Chain config
  function setCurrentChainId(uint16 _chainId) external onlyOwner { currentChainId = _chainId; emit CurrentChainSet(_chainId); }

  function registerChain(
    uint16 _chainId, 
    string calldata _chainName, 
    address _wrappedNativeToken, 
    bool _isActive
  ) external override onlyOwner {
    if (chainConfigs[_chainId].chainId == _chainId) revert ChainAlreadyRegistered(_chainId);
    if (supportedChains.length >= MAX_SUPPORTED_CHAINS) revert TooManyChains();
    chainConfigs[_chainId] = IOmniDragonRegistry.ChainConfig({
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

  /**
   * @notice Set DEX infrastructure for a chain (SET ONCE - cannot be changed after locking)
   * @dev PoolManager is critical - hooks depend on it. Once set and locked, cannot be modified.
   * @param _chainId The chain ID
   * @param _poolManager Pool manager address (V4 PoolManager)
   * @param _swapRouter Swap router address (UniversalRouter)
   * @param _positionManager Position manager address (V4 PositionManager)
   * @param _quoter Quoter address
   */
  function setDexInfrastructure(
    uint16 _chainId,
    address _poolManager,
    address _swapRouter,
    address _positionManager,
    address _quoter
  ) external override onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    
    // If infrastructure is locked, prevent any changes
    if (dexInfrastructureLocked[_chainId]) revert InfrastructureAlreadyLocked(_chainId);
    
    chainConfigs[_chainId].poolManager = _poolManager;
    chainConfigs[_chainId].swapRouter = _swapRouter;
    chainConfigs[_chainId].positionManager = _positionManager;
    chainConfigs[_chainId].quoter = _quoter;
    emit ChainUpdated(_chainId);
  }
  
  /**
   * @notice Lock DEX infrastructure for a chain (IRREVERSIBLE)
   * @dev Once locked, PoolManager, SwapRouter, PositionManager, Quoter cannot be changed
   * @dev Verifies ALL critical infrastructure is set before allowing lock
   * @param _chainId The chain ID to lock
   */
  function lockDexInfrastructure(uint16 _chainId) external onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    
    // Verify all critical DEX infrastructure is set before locking
    ChainConfig storage config = chainConfigs[_chainId];
    require(config.poolManager != address(0), "PoolManager not set");
    require(config.swapRouter != address(0), "SwapRouter not set");
    require(config.positionManager != address(0), "PositionManager not set");
    require(config.quoter != address(0), "Quoter not set");
    
    dexInfrastructureLocked[_chainId] = true;
    emit DexInfrastructureLocked(_chainId);
  }
  
  /**
   * @notice Check if DEX infrastructure is locked for a chain
   * @param _chainId The chain ID
   * @return True if locked
   */
  function isDexInfrastructureLocked(uint16 _chainId) external view returns (bool) {
    return dexInfrastructureLocked[_chainId];
  }
  
  /**
   * @notice Set StateView for a chain (for reading V4 pool state)
   * @param _chainId The chain ID
   * @param _stateView StateView address
   */
  function setStateView(uint16 _chainId, address _stateView) external onlyOwner {
    if (_stateView == address(0)) revert ZeroAddress();
    stateViews[_chainId] = _stateView;
    emit StateViewSet(_chainId, _stateView);
  }
  
  /**
   * @notice Get StateView for a chain
   * @param _chainId The chain ID
   * @return StateView address
   */
  function getStateView(uint16 _chainId) external view returns (address) {
    return stateViews[_chainId];
  }
  
  /**
   * @notice Set Permit2 for a chain (usually same on all EVM chains)
   * @param _chainId The chain ID
   * @param _permit2 Permit2 address
   */
  function setPermit2(uint16 _chainId, address _permit2) external onlyOwner {
    if (_permit2 == address(0)) revert ZeroAddress();
    permit2Addresses[_chainId] = _permit2;
    emit Permit2Set(_chainId, _permit2);
  }
  
  /**
   * @notice Get Permit2 for a chain
   * @param _chainId The chain ID
   * @return Permit2 address (falls back to canonical address if not set)
   */
  function getPermit2(uint16 _chainId) external view returns (address) {
    address permit2 = permit2Addresses[_chainId];
    // Canonical Permit2 address on all EVM chains
    return permit2 != address(0) ? permit2 : 0x000000000022D473030F116dDEE9F6B43aC78BA3;
  }
  
  /**
   * @notice Get Multicall3 address (same on all EVM chains)
   * @return Canonical Multicall3 address
   * @dev Useful for batching reads/writes in scripts and frontends
   */
  function getMulticall3() external pure returns (address) {
    return 0xcA11bde05977b3631167028862bE2a173976CA11;
  }

  // NOTE: VRF, Treasury, Governance, and Pool Defaults functions moved to OmniDragonRegistryExtension

  function updateChainName(uint16 _chainId, string calldata _chainName) external onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    chainConfigs[_chainId].chainName = _chainName;
    emit ChainUpdated(_chainId);
  }

  function updateWrappedNative(uint16 _chainId, address _wrappedNativeToken) external onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    chainConfigs[_chainId].wrappedNativeToken = _wrappedNativeToken;
    chainConfigs[_chainId].wrappedNativeSymbol = _getDefaultWrappedNativeSymbol(_chainId);
    emit ChainUpdated(_chainId);
  }

  function updateWrappedNativeSymbol(uint16 _chainId, string calldata _symbol) external onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    chainConfigs[_chainId].wrappedNativeSymbol = _symbol; emit WrappedNativeSymbolUpdated(_chainId, _symbol); emit ChainUpdated(_chainId);
  }

  function setChainStatus(uint16 _chainId, bool _isActive) external override onlyOwner {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    chainConfigs[_chainId].isActive = _isActive; emit ChainStatusChanged(_chainId, _isActive);
  }

  function getChainConfig(uint16 _chainId) external view override returns (IOmniDragonRegistry.ChainConfig memory) {
    if (chainConfigs[_chainId].chainId != _chainId) revert ChainNotRegistered(_chainId);
    return chainConfigs[_chainId];
  }

  function getSupportedChains() external view override returns (uint16[] memory) { return supportedChains; }
  function getCurrentChainId() external view override returns (uint16) { return currentChainId; }
  function isChainSupported(uint16 _chainId) external view override returns (bool) { return chainConfigs[_chainId].isActive && chainConfigs[_chainId].chainId == _chainId; }

  // Endpoints and mapping
  function setChainIdToEid(uint256 _chainId, uint32 _eid) external onlyOwner { chainIdToEid[_chainId] = _eid; eidToChainId[_eid] = _chainId; emit ChainIdToEidUpdated(_chainId, _eid); }
  function setLayerZeroEndpoint(uint16 _chainId, address _endpoint) external onlyOwner { if (_endpoint == address(0)) revert ZeroAddress(); layerZeroEndpoints[_chainId] = _endpoint; emit LayerZeroEndpointUpdated(_chainId, _endpoint); }
  function getLayerZeroEndpoint(uint16 _chainId) external view returns (address) {
    address ep = layerZeroEndpoints[_chainId];
    return ep == address(0) ? layerZeroCommonEndpoint : ep;
  }

  // Lookups
  function getWrappedNativeToken(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].wrappedNativeToken; }
  function getWrappedNativeSymbol(uint16 _chainId) external view override returns (string memory) { return chainConfigs[_chainId].wrappedNativeSymbol; }
  function getPoolManager(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].poolManager; }
  function getSwapRouter(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].swapRouter; }
  function getPositionManager(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].positionManager; }
  function getQuoter(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].quoter; }
  function getChainlinkNativeFeed(uint16 _chainId) external view override returns (address) { return chainConfigs[_chainId].chainlinkNativeFeed; }
  function setChainlinkNativeFeed(uint16 _chainId, address _feed) external override onlyOwner { require(_feed != address(0), "Invalid feed"); chainConfigs[_chainId].chainlinkNativeFeed = _feed; emit ChainUpdated(_chainId); }

  // Oracle management
  function setPriceOracle(uint16 _chainId, address _oracle) external override onlyOwner { require(_oracle != address(0), "Invalid oracle address"); priceOracles[_chainId] = _oracle; oracleConfigs[_chainId].isConfigured = true; emit PriceOracleSet(_chainId, _oracle); }
  function getPriceOracle(uint16 _chainId) external view returns (address) { return priceOracles[_chainId]; }
  function setSecondaryOracle(uint16 _chainId, address _oracle) external onlyOwner { require(_oracle != address(0), "Invalid oracle address"); secondaryOracles[_chainId] = _oracle; emit SecondaryOracleSet(_chainId, _oracle); }
  function getSecondaryOracle(uint16 _chainId) external view returns (address) { return secondaryOracles[_chainId]; }
  function configurePrimaryOracle(address _primaryOracle, uint32 _chainEid) external override onlyOwner { require(_primaryOracle != address(0), "Invalid oracle address"); primaryOracle = _primaryOracle; primaryChainEid = _chainEid; priceOracles[146] = _primaryOracle; oracleConfigs[146].primaryOracle = _primaryOracle; oracleConfigs[146].primaryChainEid = _chainEid; oracleConfigs[146].isConfigured = true; emit PrimaryOracleConfigured(_primaryOracle, _chainEid); }
  function setLzReadChannel(uint16 _chainId, uint32 _channelId) external override onlyOwner { oracleConfigs[_chainId].lzReadChannelId = _channelId; emit LzReadChannelConfigured(_chainId, _channelId); }
  function getOracleConfigByChainId(uint256 _chainId) external view returns (IOmniDragonRegistry.OracleConfig memory) {
    return oracleConfigs[uint16(_chainId)];
  }
  function getOracleConfig(uint16 _chainId) external view returns (IOmniDragonRegistry.OracleConfig memory) {
    return oracleConfigs[_chainId];
  }

  // ============ Ecosystem Contract Management ============
  
  function setJackpotVault(uint16 _chainId, address _vault) external onlyOwner {
    jackpotVaults[_chainId] = _vault;
    emit EcosystemContractSet(_chainId, "JackpotVault", _vault);
  }

  function setGasReserve(uint16 _chainId, address _reserve) external onlyOwner {
    gasReserves[_chainId] = _reserve;
    emit EcosystemContractSet(_chainId, "GasReserve", _reserve);
  }

  function setLotteryManager(uint16 _chainId, address _manager) external onlyOwner {
    lotteryManagers[_chainId] = _manager;
    emit EcosystemContractSet(_chainId, "LotteryManager", _manager);
  }

  function setV4Hook(uint16 _chainId, address _hook) external onlyOwner {
    v4Hooks[_chainId] = _hook;
    emit EcosystemContractSet(_chainId, "V4Hook", _hook);
  }

  function setDragonToken(uint16 _chainId, address _token) external onlyOwner {
    dragonTokens[_chainId] = _token;
    emit EcosystemContractSet(_chainId, "DragonToken", _token);
  }

  function setHubChain(uint16 _chainId, uint32 _eid) external onlyOwner {
    hubChainId = _chainId;
    hubChainEid = _eid;
    emit HubChainSet(_chainId, _eid);
  }

  // Ecosystem getters
  function getJackpotVault(uint16 _chainId) external view returns (address) { return jackpotVaults[_chainId]; }
  function getGasReserve(uint16 _chainId) external view returns (address) { return gasReserves[_chainId]; }
  function getLotteryManager(uint16 _chainId) external view returns (address) { return lotteryManagers[_chainId]; }
  function getV4Hook(uint16 _chainId) external view returns (address) { return v4Hooks[_chainId]; }
  function getDragonToken(uint16 _chainId) external view returns (address) { return dragonTokens[_chainId]; }
  function isHubChain() external view returns (bool) { return uint16(block.chainid) == hubChainId; }

  // ============ DragonOVault Vault System Setters ============
  
  function setChainDragonVault(uint16 _chainId, address _vault) external onlyOwner {
    dragonOVaults[_chainId] = _vault;
    emit EcosystemContractSet(_chainId, "ChainDragonVault", _vault);
  }

  function setVeDragon(uint16 _chainId, address _veDragon) external onlyOwner {
    veDragonContracts[_chainId] = _veDragon;
    emit EcosystemContractSet(_chainId, "veDRAGON", _veDragon);
  }

  function setGaugeController(uint16 _chainId, address _gaugeController) external onlyOwner {
    gaugeControllers[_chainId] = _gaugeController;
    emit EcosystemContractSet(_chainId, "GaugeController", _gaugeController);
  }

  function setLPManager(uint16 _chainId, address _lpManager) external onlyOwner {
    lpManagers[_chainId] = _lpManager;
    emit EcosystemContractSet(_chainId, "LPManager", _lpManager);
  }

  // DragonOVault Vault System Getters
  function getDragonOVault(uint16 _chainId) external view returns (address) { return dragonOVaults[_chainId]; }
  function getVeDragon(uint16 _chainId) external view returns (address) { return veDragonContracts[_chainId]; }
  function getGaugeController(uint16 _chainId) external view returns (address) { return gaugeControllers[_chainId]; }
  function getLPManager(uint16 _chainId) external view returns (address) { return lpManagers[_chainId]; }

  // Batch getter for cross-chain operations
  function getRemoteVaults() external view returns (uint32[] memory eids, address[] memory vaults) {
    uint256 count = 0;
    
    // Count non-hub chains with vaults
    for (uint i = 0; i < supportedChains.length; i++) {
      if (supportedChains[i] != hubChainId && jackpotVaults[supportedChains[i]] != address(0)) {
        count++;
      }
    }
    
    eids = new uint32[](count);
    vaults = new address[](count);
    uint256 idx = 0;
    
    for (uint i = 0; i < supportedChains.length; i++) {
      if (supportedChains[i] != hubChainId && jackpotVaults[supportedChains[i]] != address(0)) {
        eids[idx] = chainIdToEid[supportedChains[i]];
        vaults[idx] = jackpotVaults[supportedChains[i]];
        idx++;
      }
    }
  }

  // ============ LayerZero Config Setters ============

  /**
   * @notice Set full LZ config for a chain (custom OApp)
   * @dev Use this for chains like Monad/Sonic that need custom DVN setup
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
    lzConfigs[_chainId] = IOmniDragonRegistry.LzConfig({
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
    
    customOAppChains[_chainId] = _useCustomOApp;
    
    // Update mappings
    layerZeroEndpoints[_chainId] = _endpoint;
    chainIdToEid[_chainId] = _eid;
    eidToChainId[_eid] = _chainId;
    
    emit LayerZeroConfigured(address(0), _eid, _useCustomOApp ? "CUSTOM_OAPP_SET" : "LZ_CONFIG_SET");
  }

  /**
   * @notice Set default LZ config for standard chains
   * @dev Used by chains that don't need custom DVN setup
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
    defaultLzConfig = IOmniDragonRegistry.LzConfig({
      endpoint: _endpoint,
      eid: 0, // EID is chain-specific, set per-chain
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
    
    emit LayerZeroConfigured(address(0), 0, "DEFAULT_LZ_CONFIG_SET");
  }

  /**
   * @notice Mark a chain as custom OApp (Monad, Sonic, etc.)
   */
  function setCustomOAppChain(uint16 _chainId, bool _isCustom) external onlyOwner {
    customOAppChains[_chainId] = _isCustom;
    lzConfigs[_chainId].useCustomOApp = _isCustom;
  }

  /**
   * @notice Set optional DVNs for a chain
   */
  function setOptionalDvns(uint16 _chainId, address[] calldata _dvns) external onlyOwner {
    lzConfigs[_chainId].optionalDvns = _dvns;
  }

  /**
   * @notice Update individual LZ config fields
   */
  function setLzEndpoint(uint16 _chainId, address _endpoint) external onlyOwner {
    lzConfigs[_chainId].endpoint = _endpoint;
    layerZeroEndpoints[_chainId] = _endpoint;
  }

  function setLzEid(uint16 _chainId, uint32 _eid) external onlyOwner {
    lzConfigs[_chainId].eid = _eid;
    chainIdToEid[_chainId] = _eid;
    eidToChainId[_eid] = _chainId;
  }

  function setLzSendLib(uint16 _chainId, address _sendLib) external onlyOwner {
    lzConfigs[_chainId].sendLib = _sendLib;
  }

  function setLzReceiveLib(uint16 _chainId, address _receiveLib) external onlyOwner {
    lzConfigs[_chainId].receiveLib = _receiveLib;
  }

  function setLzExecutor(uint16 _chainId, address _executor) external onlyOwner {
    lzConfigs[_chainId].executor = _executor;
  }

  function setLzDvn(uint16 _chainId, address _dvn) external onlyOwner {
    lzConfigs[_chainId].dvn = _dvn;
  }

  function setLzReadDvn(uint16 _chainId, address _lzReadDvn) external onlyOwner {
    lzConfigs[_chainId].lzReadDvn = _lzReadDvn;
  }

  function setLzConfirmations(uint16 _chainId, uint64 _confirmations) external onlyOwner {
    lzConfigs[_chainId].confirmations = _confirmations;
  }

  // ============ LayerZero Config Getters ============

  function getLzConfig(uint16 _chainId) external view returns (IOmniDragonRegistry.LzConfig memory) {
    return lzConfigs[_chainId];
  }

  function getEidForChainId(uint256 _chainId) external view returns (uint32) {
    return chainIdToEid[_chainId];
  }

  function getChainIdForEid(uint32 _eid) external view returns (uint256) {
    return eidToChainId[_eid];
  }

  function getDvn(uint16 _chainId) external view returns (address) {
    return lzConfigs[_chainId].dvn;
  }

  function getExecutor(uint16 _chainId) external view returns (address) {
    return lzConfigs[_chainId].executor;
  }

  function getSendLib(uint16 _chainId) external view returns (address) {
    return lzConfigs[_chainId].sendLib;
  }

  function getReceiveLib(uint16 _chainId) external view returns (address) {
    return lzConfigs[_chainId].receiveLib;
  }

  function getLzReadDvn(uint16 _chainId) external view returns (address) {
    return lzConfigs[_chainId].lzReadDvn;
  }

  function usesCustomOApp(uint16 _chainId) external view returns (bool) {
    return customOAppChains[_chainId];
  }

  function getDefaultLzConfig() external view returns (IOmniDragonRegistry.LzConfig memory) {
    return defaultLzConfig;
  }

  /**
   * @notice Get effective LZ config (custom if set, default otherwise)
   * @dev Returns chain-specific config if useCustomOApp, otherwise returns default with chain's EID
   */
  function getEffectiveLzConfig(uint16 _chainId) external view returns (IOmniDragonRegistry.LzConfig memory) {
    IOmniDragonRegistry.LzConfig memory config = lzConfigs[_chainId];
    
    // If chain has custom config, use it
    if (config.useCustomOApp || config.isConfigured) {
      return config;
    }
    
    // Otherwise, use default config with chain-specific EID and endpoint
    IOmniDragonRegistry.LzConfig memory effective = defaultLzConfig;
    effective.eid = chainIdToEid[_chainId];
    effective.endpoint = layerZeroEndpoints[_chainId] != address(0) 
      ? layerZeroEndpoints[_chainId] 
      : layerZeroCommonEndpoint;
    return effective;
  }

  // ============ OApp Auto-Configuration ============

  /// @notice OApp types for different configuration needs
  enum OAppType {
    OFT,          // Standard OFT (omniDRAGON, DragonOVault/vDRAGON)
    OAPP,         // Standard OApp messaging
    LZREAD,       // lzRead for cross-chain reads (Oracle)
    COMPOSER      // lzCompose receiver (DragonOVaultComposer)
  }

  /**
   * @notice Auto-configure an OApp for all supported chains
   * @dev Sets peers, DVN, executor, and enforced options using stored LZ config
   * @param _oapp The OApp address (omniDRAGON, Oracle, etc.)
   * @param _defaultGasLimit Default gas limit for enforced options
   */
  function configureOAppForAllChains(
    address _oapp,
    uint128 _defaultGasLimit
  ) external onlyOwner {
    require(_oapp != address(0), "Invalid OApp");
    
    uint16 thisChain = uint16(block.chainid);
    
    for (uint i = 0; i < supportedChains.length; i++) {
      uint16 remoteChainId = supportedChains[i];
      if (remoteChainId == thisChain) continue; // Skip self
      
      IOmniDragonRegistry.LzConfig memory remoteLz = lzConfigs[remoteChainId];
      if (!remoteLz.isConfigured) continue; // Skip unconfigured chains
      
      // Set peer (assumes same address on all chains for CREATE2)
      _setPeer(_oapp, remoteLz.eid, bytes32(uint256(uint160(_oapp))));
      
      // Configure send path (this chain -> remote)
      _configurePathToRemote(_oapp, remoteLz, _defaultGasLimit);
    }
    
    emit LayerZeroConfigured(_oapp, 0, "OAPP_AUTO_CONFIGURED");
  }

  /**
   * @notice Auto-configure an OApp with specific type for all supported chains
   * @dev Handles OFT, OApp, lzRead, and Composer patterns differently
   * @param _oapp The OApp address
   * @param _oappType Type of OApp (determines config pattern)
   * @param _defaultGasLimit Default gas limit for enforced options
   */
  function configureOAppWithType(
    address _oapp,
    OAppType _oappType,
    uint128 _defaultGasLimit
  ) external onlyOwner {
    require(_oapp != address(0), "Invalid OApp");
    
    uint16 thisChain = uint16(block.chainid);
    
    for (uint i = 0; i < supportedChains.length; i++) {
      uint16 remoteChainId = supportedChains[i];
      if (remoteChainId == thisChain) continue;
      
      IOmniDragonRegistry.LzConfig memory remoteLz = lzConfigs[remoteChainId];
      if (!remoteLz.isConfigured) continue;
      
      // Set peer (assumes same address on all chains for CREATE2)
      _setPeer(_oapp, remoteLz.eid, bytes32(uint256(uint160(_oapp))));
      
      // Configure based on type
      if (_oappType == OAppType.LZREAD) {
        _configurePathForLzRead(_oapp, remoteLz);
      } else {
        // OFT, OAPP, COMPOSER all use standard messaging
        _configurePathToRemote(_oapp, remoteLz, _defaultGasLimit);
      }
    }
    
    string memory typeStr = _oappType == OAppType.OFT ? "OFT" :
                            _oappType == OAppType.OAPP ? "OAPP" :
                            _oappType == OAppType.LZREAD ? "LZREAD" : "COMPOSER";
    emit LayerZeroConfigured(_oapp, 0, typeStr);
  }

  /**
   * @notice Configure lzRead path (uses lzReadDvn instead of regular DVN)
   * @dev lzRead is for cross-chain reads, used by Oracle
   */
  function _configurePathForLzRead(
    address _oapp,
    IOmniDragonRegistry.LzConfig memory _remoteLz
  ) internal {
    IOmniDragonRegistry.LzConfig memory localLz = lzConfigs[uint16(block.chainid)];
    require(localLz.isConfigured, "Local chain not configured");
    
    address ep = localLz.endpoint;
    require(ep != address(0), "No local endpoint");
    
    // lzRead uses the lzReadDvn instead of regular DVN
    address lzReadDvn = localLz.lzReadDvn;
    if (lzReadDvn == address(0)) {
      lzReadDvn = localLz.dvn; // Fallback to regular DVN
    }
    
    // Set send library for lzRead
    if (localLz.sendLib != address(0)) {
      bytes memory cd = abi.encodeWithSignature(
        "setSendLibrary(address,uint32,address)",
        _oapp, _remoteLz.eid, localLz.sendLib
      );
      _executeLowLevelCall(ep, cd, "setSendLibrary fail");
    }
    
    // Configure lzRead DVN
    if (lzReadDvn != address(0) && localLz.sendLib != address(0)) {
      address[] memory reqDvns = new address[](1);
      reqDvns[0] = lzReadDvn;
      bytes memory ulnCfg = abi.encode(
        uint64(1), // Minimal confirmations for reads
        uint8(1),
        uint8(0),
        uint8(0),
        reqDvns,
        new address[](0)
      );
      SetConfigParam[] memory params = new SetConfigParam[](1);
      params[0] = SetConfigParam({ eid: _remoteLz.eid, configType: 2, config: ulnCfg });
      bytes memory cd = abi.encodeWithSignature(
        "setConfig(address,address,(uint32,uint32,bytes)[])",
        _oapp, localLz.sendLib, params
      );
      _executeLowLevelCall(ep, cd, "setLzReadULN fail");
    }
  }

  /**
   * @notice Configure OApp for a specific remote chain
   * @param _oapp The OApp address
   * @param _remoteChainId Remote chain ID
   * @param _remotePeer Remote peer address (as bytes32)
   * @param _gasLimit Gas limit for enforced options
   */
  function configureOAppForChain(
    address _oapp,
    uint16 _remoteChainId,
    bytes32 _remotePeer,
    uint128 _gasLimit
  ) external onlyOwner {
    require(_oapp != address(0), "Invalid OApp");
    
    IOmniDragonRegistry.LzConfig memory remoteLz = lzConfigs[_remoteChainId];
    require(remoteLz.isConfigured, "Remote chain not configured");
    
    // Set peer
    _setPeer(_oapp, remoteLz.eid, _remotePeer);
    
    // Configure send path
    _configurePathToRemote(_oapp, remoteLz, _gasLimit);
    
    emit LayerZeroConfigured(_oapp, remoteLz.eid, "OAPP_CHAIN_CONFIGURED");
  }

  /**
   * @notice Configure send path from this chain to remote
   */
  function _configurePathToRemote(
    address _oapp,
    IOmniDragonRegistry.LzConfig memory _remoteLz,
    uint128 _gasLimit
  ) internal {
    IOmniDragonRegistry.LzConfig memory localLz = lzConfigs[uint16(block.chainid)];
    require(localLz.isConfigured, "Local chain not configured");
    
    address ep = localLz.endpoint;
    require(ep != address(0), "No local endpoint");
    
    // Set send library
    if (localLz.sendLib != address(0)) {
      bytes memory cd = abi.encodeWithSignature(
        "setSendLibrary(address,uint32,address)",
        _oapp, _remoteLz.eid, localLz.sendLib
      );
      _executeLowLevelCall(ep, cd, "setSendLibrary fail");
    }
    
    // Set receive library
    if (localLz.receiveLib != address(0)) {
      bytes memory cd = abi.encodeWithSignature(
        "setReceiveLibrary(address,uint32,address,uint256)",
        _oapp, _remoteLz.eid, localLz.receiveLib, 0
      );
      _executeLowLevelCall(ep, cd, "setReceiveLibrary fail");
    }
    
    // Configure executor
    if (localLz.executor != address(0) && localLz.sendLib != address(0)) {
      bytes memory execCfg = abi.encode(uint32(10000), localLz.executor);
      SetConfigParam[] memory params = new SetConfigParam[](1);
      params[0] = SetConfigParam({ eid: _remoteLz.eid, configType: 1, config: execCfg });
      bytes memory cd = abi.encodeWithSignature(
        "setConfig(address,address,(uint32,uint32,bytes)[])",
        _oapp, localLz.sendLib, params
      );
      _executeLowLevelCall(ep, cd, "setExecutorConfig fail");
    }
    
    // Configure DVN (ULN) for send
    if (localLz.dvn != address(0) && localLz.sendLib != address(0)) {
      address[] memory reqDvns = new address[](1);
      reqDvns[0] = localLz.dvn;
      bytes memory ulnCfg = abi.encode(
        localLz.confirmations,
        uint8(1), // requiredDVNCount
        uint8(0), // optionalDVNCount
        uint8(0), // optionalDVNThreshold
        reqDvns,
        new address[](0)
      );
      SetConfigParam[] memory params = new SetConfigParam[](1);
      params[0] = SetConfigParam({ eid: _remoteLz.eid, configType: 2, config: ulnCfg });
      bytes memory cd = abi.encodeWithSignature(
        "setConfig(address,address,(uint32,uint32,bytes)[])",
        _oapp, localLz.sendLib, params
      );
      _executeLowLevelCall(ep, cd, "setSendULN fail");
    }
    
    // Configure DVN (ULN) for receive (use remote chain's DVN)
    if (_remoteLz.dvn != address(0) && localLz.receiveLib != address(0)) {
      address[] memory reqDvns = new address[](1);
      reqDvns[0] = _remoteLz.dvn;
      bytes memory ulnCfg = abi.encode(
        _remoteLz.confirmations,
        uint8(1),
        uint8(0),
        uint8(0),
        reqDvns,
        new address[](0)
      );
      SetConfigParam[] memory params = new SetConfigParam[](1);
      params[0] = SetConfigParam({ eid: _remoteLz.eid, configType: 2, config: ulnCfg });
      bytes memory cd = abi.encodeWithSignature(
        "setConfig(address,address,(uint32,uint32,bytes)[])",
        _oapp, localLz.receiveLib, params
      );
      _executeLowLevelCall(ep, cd, "setReceiveULN fail");
    }
    
    // Set enforced options
    _setEnforcedOptions(_oapp, _remoteLz.eid, _gasLimit);
  }

  /**
   * @notice Set peer on OApp
   */
  function _setPeer(address _oapp, uint32 _eid, bytes32 _peer) internal {
    bytes memory cd = abi.encodeWithSignature("setPeer(uint32,bytes32)", _eid, _peer);
    _executeLowLevelCall(_oapp, cd, "setPeer fail");
  }

  /**
   * @notice Set enforced options on OApp
   */
  function _setEnforcedOptions(address _oapp, uint32 _eid, uint128 _gasLimit) internal {
    // Build enforced options for send (msgType 1) and sendAndCall (msgType 2)
    bytes memory options = abi.encodePacked(
      uint16(3),      // TYPE_3 options
      uint8(1),       // WORKER_ID for executor
      uint16(17),     // Option length (1 + 16)
      uint8(1),       // LZ_RECEIVE option type
      _gasLimit       // Gas limit
    );
    
    // Struct: (uint32 eid, uint16 msgType, bytes options)
    bytes memory opt1 = abi.encode(_eid, uint16(1), options); // Send
    bytes memory opt2 = abi.encode(_eid, uint16(2), options); // SendAndCall
    
    bytes[] memory allOpts = new bytes[](2);
    allOpts[0] = opt1;
    allOpts[1] = opt2;
    
    bytes memory cd = abi.encodeWithSignature(
      "setEnforcedOptions((uint32,uint16,bytes)[])",
      allOpts
    );
    // Don't revert if this fails (some OApps may not have this function)
    (bool success, ) = _oapp.call(cd);
    if (!success) {
      // Try alternate signature
      cd = abi.encodeWithSignature(
        "setEnforcedOptions(bytes[])",
        allOpts
      );
      _oapp.call(cd);
    }
  }

  // Low-level call helper (minimal)
  function _executeLowLevelCall(address target, bytes memory callData, string memory errorMessage) private {
    // Verify target is a contract (not EOA)
    require(target.code.length > 0, "Target is not a contract");
    
    (bool success, bytes memory returnData) = target.call(callData);
    if (!success) { 
      if (returnData.length > 0) { 
        assembly { revert(add(returnData, 32), mload(returnData)) } 
      } else { 
        revert(errorMessage); 
      } 
    }
  }

  // NOTE: Additional LZ configuration helpers moved to separate OmniDragonConfigurator contract to reduce size
}





















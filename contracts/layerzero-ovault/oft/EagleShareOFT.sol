// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IChainRegistry } from "../../interfaces/IChainRegistry.sol";

/**
 * @title EagleShareOFT
 * @notice Production-ready LayerZero OFT for Eagle Vault Shares
 * 
 * @dev FEATURES:
 *      ✅ Optional registry integration (hub chain) or simple mode (spoke chains)
 *      ✅ V3 Uniswap pool compatibility (no "Insufficient Input Amount" errors)
 *      ✅ Smart DEX detection (V2, V3, routers, pools)
 *      ✅ Fee-on-swap only (regular transfers remain free)
 *      ✅ Multi-recipient fee distribution (Treasury + Vault)
 *      ✅ Configurable fee structure
 *      ✅ Emergency controls
 * 
 * @dev MODES:
 *      - Registry Mode: For hub chain with registry integration
 *      - Simple Mode: For spoke chains without registry (pass address(0) for registry)
 *      - Bridge Mode: For hub chain, can mint/burn via VaultToOFTBridge
 * 
 * @dev FEE STRUCTURE:
 *      - Buy/Sell fees configurable separately
 *      - Two recipients: Treasury (50%), Vault Injection (50%)
 *      - Fees only apply to DEX swaps, not regular transfers
 *      - V3-compatible dual-mode processing
 *      - No burn mechanism (all fees go to productive use)
 */
contract EagleShareOFT is OFT {
    // =================================
    // CONSTANTS & ENUMS
    // =================================
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_FEE_BPS = 1000; // 10% maximum
    
    enum OperationType {
        Unknown,        // Apply fees based on detection (default)
        SwapOnly,       // Apply fees for swaps only
        NoFees,         // Never apply fees (exempt addresses)
        LiquidityOnly   // Only liquidity operations (no fees)
    }
    
    // =================================
    // STRUCTS
    // =================================
    
    struct SwapFeeConfig {
        uint16 buyFee;          // Buy fee in basis points
        uint16 sellFee;         // Sell fee in basis points  
        uint16 treasuryShare;   // Treasury allocation (e.g., 5000 = 50%)
        uint16 vaultShare;      // Vault injection (e.g., 5000 = 50%)
        address treasury;       // Treasury address
        address vaultBeneficiary; // Vault beneficiary address
        bool feesEnabled;       // Global fee toggle
    }
    
    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice Registry contract (optional - address(0) for simple mode)
    IChainRegistry public immutable CHAIN_REGISTRY;
    
    /// @notice Cached chain EID (0 if simple mode)
    uint32 public immutable CHAIN_EID;
    
    /// @notice Vault bridge (for hub chain only - converts vault shares to OFT)
    address public vaultBridge;
    
    /// @notice Fee configuration
    SwapFeeConfig public swapFeeConfig;
    
    /// @notice Smart detection mappings
    mapping(address => bool) public isPair;
    mapping(address => OperationType) public addressOperationType;
    mapping(address => bool) public isSwapRouter;
    mapping(address => bool) public isV3Pool;
    mapping(address => bool) public feeExempt;
    
    /// @notice Statistics
    uint256 public totalBuyFees;
    uint256 public totalSellFees;
    uint256 public totalVaultInjected;
    uint256 public totalSwapsProcessed;
    
    // =================================
    // EVENTS
    // =================================

    event RegistryConfigured(address indexed registry, address lzEndpoint, uint32 eid, uint256 chainId);
    event SwapFeeApplied(address indexed from, address indexed to, uint256 amount, uint256 feeAmount, string reason);
    event FeesDistributed(address indexed recipient, uint256 amount, string category);
    event V3PoolConfigured(address indexed pool, bool isV3);
    event OperationTypeUpdated(address indexed addr, OperationType opType);
    event FeeConfigUpdated(uint16 buyFee, uint16 sellFee, bool enabled);

    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error ChainNotConfigured();
    error RegistryCallFailed();
    error FeeExceedsLimit();
    error InvalidFeeRecipient();
    error InvalidFeeDistribution();

    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Creates Eagle Share OFT with optional registry
     * @param _name Token name (identical on all chains)
     * @param _symbol Token symbol (identical on all chains) 
     * @param _lzEndpoint LayerZero endpoint (required in simple mode, ignored in registry mode)
     * @param _registry Registry address (pass address(0) for simple mode)
     * @param _delegate Contract delegate/owner
     * @param _feeConfig Initial fee configuration (can be zero fees)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _registry,
        address _delegate,
        SwapFeeConfig memory _feeConfig
    ) OFT(
        _name, 
        _symbol, 
        _registry != address(0) ? _getEndpointFromRegistry(_registry) : _lzEndpoint,
        _delegate
    ) Ownable(_delegate) {
        if (_delegate == address(0)) revert ZeroAddress();
        
        // Registry mode vs Simple mode
        if (_registry != address(0)) {
        CHAIN_REGISTRY = IChainRegistry(_registry);
        uint16 currentChainId = CHAIN_REGISTRY.getCurrentChainId();
        CHAIN_EID = uint32(CHAIN_REGISTRY.getEidForChainId(uint256(currentChainId)));
        
        emit RegistryConfigured(
            _registry, 
                address(endpoint),
            CHAIN_EID,
            block.chainid
        );
        } else {
            // Simple mode: no registry
            CHAIN_REGISTRY = IChainRegistry(address(0));
            CHAIN_EID = 0;
            
            if (_lzEndpoint == address(0)) revert ZeroAddress();
        }
        
        // Set up fee configuration
        if (_feeConfig.treasury != address(0)) {
            _setSwapFeeConfig(_feeConfig);
        }
        
        // Set deployer and contract as fee exempt
        feeExempt[_delegate] = true;
        feeExempt[address(this)] = true;
    }

    // =================================
    // ENHANCED TRANSFER WITH V3 COMPATIBILITY
    // =================================
    
    /**
     * @notice Enhanced transfer with V3-compatible smart fee detection
     * @dev Overrides ERC20's _update function
     */
    function _update(address from, address to, uint256 amount) internal virtual override {
        // Skip fees for mint/burn operations or zero amount
        if (from == address(0) || to == address(0) || amount == 0) {
            super._update(from, to, amount);
            return;
        }
        
        // Skip fees if globally disabled
        if (!swapFeeConfig.feesEnabled) {
            super._update(from, to, amount);
            return;
        }
        
        // Skip fees for exempt addresses
        if (feeExempt[from] || feeExempt[to]) {
            super._update(from, to, amount);
            return;
        }
        
        // Apply smart fee detection
        if (_shouldApplyTradingFees(from, to)) {
            _processTradeWithFees(from, to, amount);
        } else {
            // Regular transfer - no fees
            super._update(from, to, amount);
        }
    }
    
    // =================================
    // SMART FEE DETECTION
    // =================================
    
    /**
     * @notice Determine if trading fees should apply
     */
    function _shouldApplyTradingFees(address from, address to) internal view returns (bool) {
        // Check operation type classifications
        OperationType fromType = addressOperationType[from];
        OperationType toType = addressOperationType[to];
        
        // No fees if either side is classified as no fees
        if (fromType == OperationType.NoFees || toType == OperationType.NoFees) {
            return false;
        }
        
        // No fees if either side is liquidity only
        if (fromType == OperationType.LiquidityOnly || toType == OperationType.LiquidityOnly) {
            return false;
        }
        
        // Apply fees if either side is swap-enabled
        if (fromType == OperationType.SwapOnly || toType == OperationType.SwapOnly) {
            return true;
        }
        
        // Enhanced detection for DEX operations
        return _detectTradingOperation(from, to);
    }
    
    /**
     * @notice Detect if this is a trading operation
     */
    function _detectTradingOperation(address from, address to) internal view returns (bool) {
        // V2 pair detection
        if (isPair[from] || isPair[to]) return true;
        
        // V3 pool detection
        if (isV3Pool[from] || isV3Pool[to]) return true;
        
        // Router detection
        if (isSwapRouter[from] || isSwapRouter[to]) return true;
        
        return false;
    }
    
    // =================================
    // DUAL-MODE FEE PROCESSING
    // =================================
    
    /**
     * @notice Process trading transaction with V3-compatible fees
     */
    function _processTradeWithFees(address from, address to, uint256 amount) internal {
        bool isBuy = _isBuyTransaction(from, to);
        uint256 feeRate = isBuy ? swapFeeConfig.buyFee : swapFeeConfig.sellFee;
        
        if (feeRate > 0) {
            if (!isBuy && isV3Pool[to]) {
                _transferV3Compatible(from, to, amount, feeRate);
            } else {
                _transferTraditional(from, to, amount, feeRate, isBuy);
            }
        } else {
            super._update(from, to, amount);
        }
        
        totalSwapsProcessed++;
    }
    
    /**
     * @notice V3-compatible transfer (avoids balance verification issues)
     */
    function _transferV3Compatible(address from, address to, uint256 amount, uint256 feeRate) internal {
        uint256 feeAmount = (amount * feeRate) / BASIS_POINTS;
        uint256 netAmount = amount - feeAmount;
        
        // Transfer net amount to pool, fees to contract
        super._update(from, to, netAmount);
        super._update(from, address(this), feeAmount);
        
        // Distribute fees immediately
        _distributeFees(feeAmount, false);
        
        emit SwapFeeApplied(from, to, amount, feeAmount, "sell_v3_compatible");
        totalSellFees += feeAmount;
    }
    
    /**
     * @notice Traditional fee-on-transfer for V2/other pools
     */
    function _transferTraditional(address from, address to, uint256 amount, uint256 feeRate, bool isBuy) internal {
        uint256 feeAmount = (amount * feeRate) / BASIS_POINTS;
        uint256 transferAmount = amount - feeAmount;
        
        super._update(from, address(this), feeAmount);
        super._update(from, to, transferAmount);
        
        _distributeFees(feeAmount, isBuy);
        
        emit SwapFeeApplied(from, to, amount, feeAmount, isBuy ? "buy_traditional" : "sell_traditional");
        
        if (isBuy) {
            totalBuyFees += feeAmount;
        } else {
            totalSellFees += feeAmount;
        }
    }
    
    /**
     * @notice Determine if transaction is a buy
     */
    function _isBuyTransaction(address from, address /* to */) internal view returns (bool) {
        return isPair[from] || isSwapRouter[from] || isV3Pool[from];
    }
    
    // =================================
    // FEE DISTRIBUTION
    // =================================
    
    /**
     * @notice Distribute fees to Treasury + Vault Injection
     */
    function _distributeFees(uint256 feeAmount, bool isBuy) internal {
        if (feeAmount == 0) return;
        
        // Calculate distribution amounts (Treasury 70%, Vault 30%)
        uint256 treasuryAmount = (feeAmount * swapFeeConfig.treasuryShare) / BASIS_POINTS;
        uint256 vaultAmount = feeAmount - treasuryAmount; // Remainder goes to vault
        
        // Distribute to treasury
        if (swapFeeConfig.treasury != address(0) && treasuryAmount > 0) {
            super._update(address(this), swapFeeConfig.treasury, treasuryAmount);
            emit FeesDistributed(swapFeeConfig.treasury, treasuryAmount, isBuy ? "buy_treasury" : "sell_treasury");
        }
        
        // Vault injection (all remaining fees go here)
        if (vaultAmount > 0 && swapFeeConfig.vaultBeneficiary != address(0)) {
            super._update(address(this), swapFeeConfig.vaultBeneficiary, vaultAmount);
            emit FeesDistributed(swapFeeConfig.vaultBeneficiary, vaultAmount, isBuy ? "buy_vault" : "sell_vault");
            totalVaultInjected += vaultAmount;
        }
    }
    
    // =================================
    // ADMIN CONFIGURATION
    // =================================
    
    /**
     * @notice Configure swap fees
     */
    function setSwapFeeConfig(
        uint16 _buyFee,
        uint16 _sellFee,
        uint16 _treasuryShare,
        uint16 _vaultShare,
        address _treasury,
        address _vaultBeneficiary,
        bool _enabled
    ) external onlyOwner {
        SwapFeeConfig memory newConfig = SwapFeeConfig({
            buyFee: _buyFee,
            sellFee: _sellFee,
            treasuryShare: _treasuryShare,
            vaultShare: _vaultShare,
            treasury: _treasury,
            vaultBeneficiary: _vaultBeneficiary,
            feesEnabled: _enabled
        });
        
        _setSwapFeeConfig(newConfig);
        
        emit FeeConfigUpdated(_buyFee, _sellFee, _enabled);
    }
    
    /**
     * @notice Set V3 pool status (CRITICAL for V3 compatibility)
     */
    function setV3Pool(address pool, bool _isV3Pool) external onlyOwner {
        if (pool == address(0)) revert InvalidFeeRecipient();
        
        isV3Pool[pool] = _isV3Pool;
        
        if (_isV3Pool) {
            addressOperationType[pool] = OperationType.SwapOnly;
        }
        
        emit V3PoolConfigured(pool, _isV3Pool);
    }
    
    /**
     * @notice Batch configure V3 pools
     */
    function setV3PoolsBatch(address[] calldata pools, bool _isV3Pool) external onlyOwner {
        uint256 length = pools.length;  // Cache length
        for (uint256 i = 0; i < length;) {
            if (pools[i] != address(0)) {
                isV3Pool[pools[i]] = _isV3Pool;
                if (_isV3Pool) {
                    addressOperationType[pools[i]] = OperationType.SwapOnly;
                }
                emit V3PoolConfigured(pools[i], _isV3Pool);
            }
            unchecked { ++i; }  // Gas optimization
        }
    }
    
    /**
     * @notice Set DEX pair status
     */
    function setPair(address pair, bool _isPair) external onlyOwner {
        if (pair == address(0)) revert InvalidFeeRecipient();
        
        isPair[pair] = _isPair;
        if (_isPair) {
            addressOperationType[pair] = OperationType.SwapOnly;
        }
    }
    
    /**
     * @notice Set swap router status
     */
    function setSwapRouter(address router, bool _isRouter) external onlyOwner {
        if (router == address(0)) revert InvalidFeeRecipient();
        
        isSwapRouter[router] = _isRouter;
        if (_isRouter) {
            addressOperationType[router] = OperationType.SwapOnly;
        }
    }
    
    /**
     * @notice Set fee exemption status
     */
    function setFeeExempt(address account, bool _isExempt) external onlyOwner {
        if (account == address(0)) revert InvalidFeeRecipient();
        feeExempt[account] = _isExempt;
    }
    
    /**
     * @notice Update vault beneficiary
     */
    function setVaultBeneficiary(address _vaultBeneficiary) external onlyOwner {
        swapFeeConfig.vaultBeneficiary = _vaultBeneficiary;
    }
    
    /**
     * @notice Set operation type for enhanced detection
     */
    function setAddressOperationType(address addr, OperationType opType) external onlyOwner {
        if (addr == address(0)) revert InvalidFeeRecipient();
        addressOperationType[addr] = opType;
        emit OperationTypeUpdated(addr, opType);
    }
    
    /**
     * @notice Toggle fees on/off
     */
    function setFeesEnabled(bool _enabled) external onlyOwner {
        swapFeeConfig.feesEnabled = _enabled;
        emit FeeConfigUpdated(swapFeeConfig.buyFee, swapFeeConfig.sellFee, _enabled);
    }
    
    // =================================
    // VAULT BRIDGE FUNCTIONS (HUB CHAIN ONLY)
    // =================================
    
    /**
     * @notice Set vault bridge address (one-time setup, hub chain only)
     * @dev Allows VaultToOFTBridge to mint/burn for wrapping vault shares
     * @param _bridge VaultToOFTBridge contract address
     */
    function setVaultBridge(address _bridge) external onlyOwner {
        require(vaultBridge == address(0), "Bridge already set");
        require(_bridge != address(0), "Zero address");
        vaultBridge = _bridge;
        
        // Exempt bridge from fees (wrapping should be free)
        feeExempt[_bridge] = true;
    }
    
    /**
     * @notice Mint OFT tokens (only callable by vault bridge)
     * @dev Used when users wrap vault shares → OFT tokens
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == vaultBridge, "Only vault bridge");
        require(vaultBridge != address(0), "Bridge not set");
        _mint(to, amount);
    }
    
    /**
     * @notice Burn OFT tokens (only callable by vault bridge)
     * @dev Used when users unwrap OFT tokens → vault shares
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == vaultBridge, "Only vault bridge");
        require(vaultBridge != address(0), "Bridge not set");
        _burn(from, amount);
    }
    
    // =================================
    // INTERNAL HELPERS
    // =================================
    
    /**
     * @notice Internal function to get endpoint from registry
     */
    function _getEndpointFromRegistry(address _registry) private view returns (address) {
        if (_registry == address(0)) revert ZeroAddress();
        
        try IChainRegistry(_registry).getCurrentChainId() returns (uint16 currentChainId) {
            try IChainRegistry(_registry).getLayerZeroEndpoint(currentChainId) returns (address endpoint) {
                if (endpoint == address(0)) revert ChainNotConfigured();
                return endpoint;
            } catch {
                revert RegistryCallFailed();
            }
        } catch {
            revert RegistryCallFailed();
        }
    }

    /**
     * @notice Internal function to set fee config with validation
     */
    function _setSwapFeeConfig(SwapFeeConfig memory _config) internal {
        if (_config.buyFee > MAX_FEE_BPS || _config.sellFee > MAX_FEE_BPS) {
            revert FeeExceedsLimit();
        }
        
        if (_config.treasuryShare + _config.vaultShare != BASIS_POINTS) {
            revert InvalidFeeDistribution();
        }
        
        if (_config.treasury == address(0) && _config.feesEnabled) {
            revert InvalidFeeRecipient();
        }
        
        swapFeeConfig = _config;
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get registry address (address(0) if simple mode)
     */
    function getRegistry() external view returns (address) {
        return address(CHAIN_REGISTRY);
    }

    /**
     * @notice Get cached chain EID (0 if simple mode)
     */
    function getChainEID() external view returns (uint32) {
        return CHAIN_EID;
    }

    /**
     * @notice Check if using registry mode
     */
    function isRegistryMode() external view returns (bool) {
        return address(CHAIN_REGISTRY) != address(0);
    }
    
    /**
     * @notice Get chain config from registry (registry mode only)
     */
    function getChainConfig() external view returns (IChainRegistry.ChainConfig memory) {
        if (address(CHAIN_REGISTRY) == address(0)) revert("Simple mode");
        uint16 currentChainId = CHAIN_REGISTRY.getCurrentChainId();
        return CHAIN_REGISTRY.getChainConfig(currentChainId);
    }

    /**
     * @notice Verify configuration (registry mode only)
     */
    function verifyConfiguration() external view returns (bool) {
        if (address(CHAIN_REGISTRY) == address(0)) return true; // Simple mode is always valid
        
        try CHAIN_REGISTRY.getCurrentChainId() returns (uint16 currentChainId) {
            try CHAIN_REGISTRY.getLayerZeroEndpoint(currentChainId) returns (address registryEndpoint) {
                return registryEndpoint == address(endpoint);
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    /**
     * @notice Calculate swap fee for a given amount
     */
    function calculateSwapFee(uint256 amount, bool isBuy) external view returns (uint256 feeAmount) {
        if (!swapFeeConfig.feesEnabled) return 0;
        uint256 feeRate = isBuy ? swapFeeConfig.buyFee : swapFeeConfig.sellFee;
        return (amount * feeRate) / BASIS_POINTS;
    }
    
    /**
     * @notice Get fee statistics
     */
    function getFeeStats() external view returns (
        uint256 totalBuyFeesCollected,
        uint256 totalSellFeesCollected,
        uint256 totalVaultFees,
        uint256 totalSwaps
    ) {
        return (totalBuyFees, totalSellFees, totalVaultInjected, totalSwapsProcessed);
    }
    
    /**
     * @notice Check if address is V3 pool
     */
    function isV3PoolConfigured(address pool) external view returns (bool) {
        return isV3Pool[pool];
    }
    
    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "3.0.0-unified";
    }
    
}


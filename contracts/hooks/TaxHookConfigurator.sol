// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaxHookConfigurator
 * @author 0xakita.eth (CreatorVault)
 * @notice Helper to configure the existing V4 Tax Hook for CreatorVault
 * 
 * @dev EXISTING TAX HOOK:
 *      Address: 0xca975B9dAF772C71161f3648437c3616E5Be0088 (Base)
 *      This hook is already deployed and approved on Uniswap V4!
 *      We just need to configure it for our stkmaakita/ETH pool.
 * 
 * @dev CONFIGURATION:
 *      - Set 6.9% (690 bps) fee on swaps
 *      - Route fees to CreatorGaugeController
 *      - GaugeController then distributes: 50% burn, 31% lottery, 19% creator
 */

/// @notice Interface for the existing Tax Hook
interface ITaxHook {
    /// @notice Configuration for a specific pool
    struct TaxConfig {
        uint256 buyTaxBps;      // Tax on buys in basis points
        uint256 sellTaxBps;     // Tax on sells in basis points  
        address taxRecipient;    // Where taxes go
        bool enabled;            // Whether taxes are active
    }
    
    /// @notice Set tax configuration for a pool
    /// @param poolId The pool identifier (keccak256 of pool key)
    /// @param config The tax configuration
    function setTaxConfig(bytes32 poolId, TaxConfig calldata config) external;
    
    /// @notice Get tax configuration for a pool
    function getTaxConfig(bytes32 poolId) external view returns (TaxConfig memory);
    
    /// @notice Check if caller can configure a pool
    function canConfigure(bytes32 poolId, address caller) external view returns (bool);
}

/// @notice Uniswap V4 Pool Key structure
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

contract TaxHookConfigurator {
    
    // =================================
    // CONSTANTS
    // =================================
    
    /// @notice The existing tax hook on Base
    address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    
    /// @notice Uniswap V4 Pool Manager on Base
    address public constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    
    /// @notice WETH on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    
    /// @notice Default fee: 6.9% = 690 basis points
    uint256 public constant DEFAULT_FEE_BPS = 690;
    
    // =================================
    // EVENTS
    // =================================
    
    event PoolConfigured(
        bytes32 indexed poolId,
        address indexed shareOFT,
        address indexed gaugeController,
        uint256 feeBps
    );
    
    // =================================
    // MAIN FUNCTION
    // =================================
    
    /**
     * @notice Configure tax hook for a wsAKITA/ETH pool
     * @param _shareOFT The CreatorShareOFT token address
     * @param _gaugeController The CreatorGaugeController address (fee recipient)
     * @param _feeBps Fee in basis points (690 = 6.9%)
     * @param _tickSpacing Tick spacing for the pool
     * @return poolId The pool identifier
     */
    function configureCreatorPool(
        address _shareOFT,
        address _gaugeController,
        uint256 _feeBps,
        int24 _tickSpacing
    ) external returns (bytes32 poolId) {
        require(_shareOFT != address(0), "Invalid ShareOFT");
        require(_gaugeController != address(0), "Invalid GaugeController");
        require(_feeBps <= 1000, "Fee too high (max 10%)");
        
        // Sort tokens (V4 requires currency0 < currency1)
        (address token0, address token1) = _shareOFT < WETH 
            ? (_shareOFT, WETH) 
            : (WETH, _shareOFT);
        
        // Compute pool ID
        poolId = _computePoolId(token0, token1, _tickSpacing);
        
        // Configure the hook
        ITaxHook.TaxConfig memory config = ITaxHook.TaxConfig({
            buyTaxBps: _feeBps,      // 6.9% on buys
            sellTaxBps: _feeBps,     // 6.9% on sells (or 0 for buy-only)
            taxRecipient: _gaugeController,
            enabled: true
        });
        
        ITaxHook(TAX_HOOK).setTaxConfig(poolId, config);
        
        emit PoolConfigured(poolId, _shareOFT, _gaugeController, _feeBps);
    }
    
    /**
     * @notice Configure with default 6.9% fee
     */
    function configureCreatorPoolDefault(
        address _shareOFT,
        address _gaugeController,
        int24 _tickSpacing
    ) external returns (bytes32 poolId) {
        return this.configureCreatorPool(_shareOFT, _gaugeController, DEFAULT_FEE_BPS, _tickSpacing);
    }
    
    /**
     * @notice Update fee recipient (e.g., to new GaugeController)
     */
    function updateFeeRecipient(
        bytes32 poolId,
        address _newRecipient
    ) external {
        ITaxHook.TaxConfig memory config = ITaxHook(TAX_HOOK).getTaxConfig(poolId);
        config.taxRecipient = _newRecipient;
        ITaxHook(TAX_HOOK).setTaxConfig(poolId, config);
    }
    
    /**
     * @notice Update fee percentage
     */
    function updateFeeBps(
        bytes32 poolId,
        uint256 _newBuyFeeBps,
        uint256 _newSellFeeBps
    ) external {
        require(_newBuyFeeBps <= 1000 && _newSellFeeBps <= 1000, "Fee too high");
        
        ITaxHook.TaxConfig memory config = ITaxHook(TAX_HOOK).getTaxConfig(poolId);
        config.buyTaxBps = _newBuyFeeBps;
        config.sellTaxBps = _newSellFeeBps;
        ITaxHook(TAX_HOOK).setTaxConfig(poolId, config);
    }
    
    /**
     * @notice Disable fees for a pool
     */
    function disableFees(bytes32 poolId) external {
        ITaxHook.TaxConfig memory config = ITaxHook(TAX_HOOK).getTaxConfig(poolId);
        config.enabled = false;
        ITaxHook(TAX_HOOK).setTaxConfig(poolId, config);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get pool ID for a token pair
     */
    function getPoolId(
        address _shareOFT,
        int24 _tickSpacing
    ) external pure returns (bytes32) {
        (address token0, address token1) = _shareOFT < WETH 
            ? (_shareOFT, WETH) 
            : (WETH, _shareOFT);
        return _computePoolId(token0, token1, _tickSpacing);
    }
    
    /**
     * @notice Get current config for a pool
     */
    function getConfig(bytes32 poolId) external view returns (ITaxHook.TaxConfig memory) {
        return ITaxHook(TAX_HOOK).getTaxConfig(poolId);
    }
    
    /**
     * @notice Check if pool is configured
     */
    function isConfigured(bytes32 poolId) external view returns (bool) {
        ITaxHook.TaxConfig memory config = ITaxHook(TAX_HOOK).getTaxConfig(poolId);
        return config.enabled && config.taxRecipient != address(0);
    }
    
    /**
     * @notice Preview fee amount for a swap
     */
    function previewFee(bytes32 poolId, uint256 swapAmount, bool isBuy) external view returns (uint256 fee) {
        ITaxHook.TaxConfig memory config = ITaxHook(TAX_HOOK).getTaxConfig(poolId);
        if (!config.enabled) return 0;
        
        uint256 feeBps = isBuy ? config.buyTaxBps : config.sellTaxBps;
        return (swapAmount * feeBps) / 10000;
    }
    
    // =================================
    // INTERNAL
    // =================================
    
    /**
     * @dev Compute pool ID from pool key components
     */
    function _computePoolId(
        address token0,
        address token1,
        int24 tickSpacing
    ) internal pure returns (bytes32) {
        // Pool ID is hash of the pool key
        // Note: This should match how V4 computes pool IDs
        return keccak256(abi.encode(
            token0,
            token1,
            uint24(0), // Dynamic fee flag
            tickSpacing,
            TAX_HOOK
        ));
    }
}



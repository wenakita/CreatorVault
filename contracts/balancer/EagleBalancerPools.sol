// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title EagleBalancerPools
 * @notice Manages two nested Balancer V2 Weighted Pools for Eagle ecosystem
 * 
 * @dev Pool Architecture:
 *      Pool 1 (Base): WLFI/USD1 (50/50) → BPT1
 *      Pool 2 (Vault): BPT1/EAGLE (60/40) → BPT2
 * 
 * @dev Why this architecture?
 *      - WLFI/USD1 trade fee-free in dedicated pool
 *      - EAGLE fees only apply to EAGLE trades
 *      - BPT1 represents stable base assets
 *      - BPT2 represents vault ownership
 * 
 * @dev Balancer V2 Features:
 *      ✅ Native fee-on-transfer support
 *      ✅ Customizable swap fees
 *      ✅ Multi-asset pools
 *      ✅ No impermanent loss limits
 */
contract EagleBalancerPools is Ownable {
    
    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice Balancer V2 Vault (same address on all chains)
    IBalancerVault public immutable vault;
    
    /// @notice Balancer Weighted Pool Factory
    IWeightedPoolFactory public immutable poolFactory;
    
    /// @notice Base Pool: WLFI/USD1 (50/50)
    address public basePool;      // BPT1
    bytes32 public basePoolId;
    
    /// @notice Vault Pool: BPT1/EAGLE (60/40)
    address public vaultPool;     // BPT2
    bytes32 public vaultPoolId;
    
    /// @notice Token addresses
    address public immutable wlfi;
    address public immutable usd1;
    address public immutable eagle;
    
    /// @notice Pool configuration
    struct PoolConfig {
        string name;
        string symbol;
        address[] tokens;
        uint256[] weights;
        uint256 swapFee;
    }
    
    // =================================
    // EVENTS
    // =================================
    
    event BasePoolCreated(address indexed pool, bytes32 indexed poolId);
    event VaultPoolCreated(address indexed pool, bytes32 indexed poolId);
    event LiquidityAdded(bytes32 indexed poolId, address indexed provider, uint256 bptOut);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error PoolAlreadyCreated();
    error PoolNotCreated();
    error InvalidWeights();
    error InsufficientBPT();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Initialize Eagle Balancer Pools
     * @param _vault Balancer V2 Vault address
     * @param _poolFactory Weighted Pool Factory address
     * @param _wlfi WLFI token address
     * @param _usd1 USD1 token address
     * @param _eagle EAGLE token address
     * @param _owner Contract owner
     */
    constructor(
        address _vault,
        address _poolFactory,
        address _wlfi,
        address _usd1,
        address _eagle,
        address _owner
    ) Ownable(_owner) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_poolFactory == address(0)) revert ZeroAddress();
        if (_wlfi == address(0)) revert ZeroAddress();
        if (_usd1 == address(0)) revert ZeroAddress();
        if (_eagle == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        
        vault = IBalancerVault(_vault);
        poolFactory = IWeightedPoolFactory(_poolFactory);
        wlfi = _wlfi;
        usd1 = _usd1;
        eagle = _eagle;
    }
    
    // =================================
    // POOL CREATION
    // =================================
    
    /**
     * @notice Create Base Pool: WLFI/USD1 (50/50)
     * @param swapFee Swap fee in 18 decimals (e.g., 0.003e18 = 0.3%)
     */
    function createBasePool(uint256 swapFee) external onlyOwner returns (address, bytes32) {
        if (basePool != address(0)) revert PoolAlreadyCreated();
        
        // Sort tokens (required by Balancer)
        (address token0, address token1) = wlfi < usd1 ? (wlfi, usd1) : (usd1, wlfi);
        
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
        
        // 50/50 weights (0.5e18 each)
        uint256[] memory weights = new uint256[](2);
        weights[0] = 0.5e18;
        weights[1] = 0.5e18;
        
        // Create pool
        basePool = poolFactory.create(
            "Eagle Base Pool",
            "BPT-BASE",
            tokens,
            weights,
            swapFee,
            owner()
        );
        
        basePoolId = IBalancerPool(basePool).getPoolId();
        
        emit BasePoolCreated(basePool, basePoolId);
        return (basePool, basePoolId);
    }
    
    /**
     * @notice Create Vault Pool: BPT1/EAGLE (60/40)
     * @param swapFee Swap fee in 18 decimals (e.g., 0.003e18 = 0.3%)
     */
    function createVaultPool(uint256 swapFee) external onlyOwner returns (address, bytes32) {
        if (basePool == address(0)) revert PoolNotCreated();
        if (vaultPool != address(0)) revert PoolAlreadyCreated();
        
        // Sort tokens (required by Balancer)
        (address token0, address token1) = basePool < eagle ? (basePool, eagle) : (eagle, basePool);
        
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
        
        // 60/40 weights (BPT1: 60%, EAGLE: 40%)
        uint256[] memory weights = new uint256[](2);
        if (token0 == basePool) {
            weights[0] = 0.6e18;  // BPT1
            weights[1] = 0.4e18;  // EAGLE
        } else {
            weights[0] = 0.4e18;  // EAGLE
            weights[1] = 0.6e18;  // BPT1
        }
        
        // Create pool
        vaultPool = poolFactory.create(
            "Eagle Vault Pool",
            "BPT-VAULT",
            tokens,
            weights,
            swapFee,
            owner()
        );
        
        vaultPoolId = IBalancerPool(vaultPool).getPoolId();
        
        emit VaultPoolCreated(vaultPool, vaultPoolId);
        return (vaultPool, vaultPoolId);
    }
    
    // =================================
    // LIQUIDITY MANAGEMENT
    // =================================
    
    /**
     * @notice Add initial liquidity to Base Pool (WLFI/USD1)
     * @param wlfiAmount WLFI amount
     * @param usd1Amount USD1 amount
     */
    function addBasePoolLiquidity(
        uint256 wlfiAmount,
        uint256 usd1Amount
    ) external returns (uint256 bptOut) {
        if (basePool == address(0)) revert PoolNotCreated();
        
        // Transfer tokens from sender
        IERC20(wlfi).transferFrom(msg.sender, address(this), wlfiAmount);
        IERC20(usd1).transferFrom(msg.sender, address(this), usd1Amount);
        
        // Approve vault
        IERC20(wlfi).approve(address(vault), wlfiAmount);
        IERC20(usd1).approve(address(vault), usd1Amount);
        
        // Sort amounts to match sorted tokens
        (uint256 amount0, uint256 amount1) = wlfi < usd1 
            ? (wlfiAmount, usd1Amount) 
            : (usd1Amount, wlfiAmount);
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount0;
        amounts[1] = amount1;
        
        // Get tokens array
        (IERC20[] memory tokens, , ) = vault.getPoolTokens(basePoolId);
        
        // Join pool
        IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest({
            assets: _toAssets(tokens),
            maxAmountsIn: amounts,
            userData: abi.encode(
                IBalancerVault.JoinKind.INIT,
                amounts,
                0 // minBptOut
            ),
            fromInternalBalance: false
        });
        
        uint256 bptBefore = IERC20(basePool).balanceOf(msg.sender);
        
        vault.joinPool(
            basePoolId,
            address(this),
            msg.sender,
            request
        );
        
        bptOut = IERC20(basePool).balanceOf(msg.sender) - bptBefore;
        
        emit LiquidityAdded(basePoolId, msg.sender, bptOut);
    }
    
    /**
     * @notice Add liquidity to Vault Pool (BPT1/EAGLE)
     * @param bpt1Amount BPT1 amount
     * @param eagleAmount EAGLE amount
     */
    function addVaultPoolLiquidity(
        uint256 bpt1Amount,
        uint256 eagleAmount
    ) external returns (uint256 bptOut) {
        if (vaultPool == address(0)) revert PoolNotCreated();
        
        // Transfer tokens from sender
        IERC20(basePool).transferFrom(msg.sender, address(this), bpt1Amount);
        IERC20(eagle).transferFrom(msg.sender, address(this), eagleAmount);
        
        // Approve vault
        IERC20(basePool).approve(address(vault), bpt1Amount);
        IERC20(eagle).approve(address(vault), eagleAmount);
        
        // Sort amounts to match sorted tokens
        (uint256 amount0, uint256 amount1) = basePool < eagle 
            ? (bpt1Amount, eagleAmount) 
            : (eagleAmount, bpt1Amount);
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount0;
        amounts[1] = amount1;
        
        // Get tokens array
        (IERC20[] memory tokens, , ) = vault.getPoolTokens(vaultPoolId);
        
        // Join pool
        IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest({
            assets: _toAssets(tokens),
            maxAmountsIn: amounts,
            userData: abi.encode(
                IBalancerVault.JoinKind.INIT,
                amounts,
                0 // minBptOut
            ),
            fromInternalBalance: false
        });
        
        uint256 bptBefore = IERC20(vaultPool).balanceOf(msg.sender);
        
        vault.joinPool(
            vaultPoolId,
            address(this),
            msg.sender,
            request
        );
        
        bptOut = IERC20(vaultPool).balanceOf(msg.sender) - bptBefore;
        
        emit LiquidityAdded(vaultPoolId, msg.sender, bptOut);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get Base Pool info
     */
    function getBasePoolInfo() external view returns (
        address pool,
        bytes32 poolId,
        address token0,
        address token1
    ) {
        pool = basePool;
        poolId = basePoolId;
        token0 = wlfi < usd1 ? wlfi : usd1;
        token1 = wlfi < usd1 ? usd1 : wlfi;
    }
    
    /**
     * @notice Get Vault Pool info
     */
    function getVaultPoolInfo() external view returns (
        address pool,
        bytes32 poolId,
        address token0,
        address token1
    ) {
        pool = vaultPool;
        poolId = vaultPoolId;
        token0 = basePool < eagle ? basePool : eagle;
        token1 = basePool < eagle ? eagle : basePool;
    }
    
    /**
     * @notice Check if pools are created
     */
    function poolsCreated() external view returns (bool base, bool vaultPoolCreated) {
        base = basePool != address(0);
        vaultPoolCreated = vaultPool != address(0);
    }
    
    // =================================
    // INTERNAL HELPERS
    // =================================
    
    function _toAssets(IERC20[] memory tokens) internal pure returns (IAsset[] memory assets) {
        assets = new IAsset[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            assets[i] = IAsset(address(tokens[i]));
        }
    }
}

// =============================================================================
// BALANCER V2 INTERFACES
// =============================================================================

interface IBalancerVault {
    enum JoinKind { INIT, EXACT_TOKENS_IN_FOR_BPT_OUT, TOKEN_IN_FOR_EXACT_BPT_OUT }
    
    struct JoinPoolRequest {
        IAsset[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }
    
    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external payable;
    
    function getPoolTokens(bytes32 poolId)
        external
        view
        returns (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        );
}

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);
}

interface IWeightedPoolFactory {
    function create(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory weights,
        uint256 swapFeePercentage,
        address owner
    ) external returns (address);
}

interface IAsset {
    // solhint-disable-previous-line no-empty-blocks
}


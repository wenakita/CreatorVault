// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BalancerPoolCreator
 * @notice Helper contract to create and manage Balancer V2 pools
 * 
 * @dev Balancer V2 Pool Types:
 *      1. Composable Stable Pool - For correlated assets (WLFI/USD1)
 *      2. Weighted Pool - For uncorrelated assets (BPT/EAGLE)
 * 
 * @dev Balancer V2 natively supports fee-on-transfer tokens!
 */
contract BalancerPoolCreator is Ownable {
    
    // Balancer V2 Vault (same on all chains)
    IBalancerVault public immutable vault;
    
    // Balancer Pool Factories
    IComposableStablePoolFactory public immutable stablePoolFactory;
    IWeightedPoolFactory public immutable weightedPoolFactory;
    
    // Pool tracking
    mapping(bytes32 => PoolInfo) public pools;
    bytes32[] public poolIds;
    
    struct PoolInfo {
        address poolAddress;
        address[] tokens;
        uint256[] weights;
        PoolType poolType;
        bool active;
    }
    
    enum PoolType {
        Stable,
        Weighted
    }
    
    event PoolCreated(
        bytes32 indexed poolId,
        address indexed poolAddress,
        PoolType poolType,
        address[] tokens
    );
    
    event LiquidityAdded(
        bytes32 indexed poolId,
        address indexed provider,
        uint256[] amounts,
        uint256 bptOut
    );
    
    constructor(
        address _vault,
        address _stablePoolFactory,
        address _weightedPoolFactory,
        address _owner
    ) Ownable(_owner) {
        require(_vault != address(0), "Invalid vault");
        require(_stablePoolFactory != address(0), "Invalid stable factory");
        require(_weightedPoolFactory != address(0), "Invalid weighted factory");
        
        vault = IBalancerVault(_vault);
        stablePoolFactory = IComposableStablePoolFactory(_stablePoolFactory);
        weightedPoolFactory = IWeightedPoolFactory(_weightedPoolFactory);
    }
    
    /**
     * @notice Create a Composable Stable Pool (for WLFI/USD1)
     * @param name Pool name
     * @param symbol Pool symbol
     * @param tokens Token addresses (sorted)
     * @param amplificationParameter Price stability parameter (higher = more stable)
     * @param rateProviders Rate providers for tokens (address(0) if none)
     * @param swapFeePercentage Swap fee (e.g., 0.04e16 = 0.04%)
     * @param owner Pool owner
     */
    function createStablePool(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256 amplificationParameter,
        address[] memory rateProviders,
        uint256 swapFeePercentage,
        address owner
    ) external onlyOwner returns (address pool, bytes32 poolId) {
        require(tokens.length >= 2, "Need at least 2 tokens");
        require(tokens.length <= 5, "Max 5 tokens");
        
        // Create pool via factory
        pool = stablePoolFactory.create(
            name,
            symbol,
            tokens,
            amplificationParameter,
            rateProviders,
            swapFeePercentage,
            owner
        );
        
        // Get pool ID
        poolId = IBalancerPool(pool).getPoolId();
        
        // Store pool info
        uint256[] memory weights = new uint256[](tokens.length);
        // Stable pools have equal weights
        for (uint256 i = 0; i < tokens.length; i++) {
            weights[i] = 1e18 / tokens.length;
        }
        
        pools[poolId] = PoolInfo({
            poolAddress: pool,
            tokens: tokens,
            weights: weights,
            poolType: PoolType.Stable,
            active: true
        });
        
        poolIds.push(poolId);
        
        emit PoolCreated(poolId, pool, PoolType.Stable, tokens);
    }
    
    /**
     * @notice Create a Weighted Pool (for BPT/EAGLE)
     * @param name Pool name
     * @param symbol Pool symbol
     * @param tokens Token addresses (sorted)
     * @param weights Token weights (must sum to 1e18)
     * @param swapFeePercentage Swap fee (e.g., 0.3e16 = 0.3%)
     * @param owner Pool owner
     */
    function createWeightedPool(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory weights,
        uint256 swapFeePercentage,
        address owner
    ) external onlyOwner returns (address pool, bytes32 poolId) {
        require(tokens.length >= 2, "Need at least 2 tokens");
        require(tokens.length <= 8, "Max 8 tokens");
        require(tokens.length == weights.length, "Length mismatch");
        
        // Verify weights sum to 1e18
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == 1e18, "Weights must sum to 1e18");
        
        // Create pool via factory
        pool = weightedPoolFactory.create(
            name,
            symbol,
            tokens,
            weights,
            swapFeePercentage,
            owner
        );
        
        // Get pool ID
        poolId = IBalancerPool(pool).getPoolId();
        
        // Store pool info
        pools[poolId] = PoolInfo({
            poolAddress: pool,
            tokens: tokens,
            weights: weights,
            poolType: PoolType.Weighted,
            active: true
        });
        
        poolIds.push(poolId);
        
        emit PoolCreated(poolId, pool, PoolType.Weighted, tokens);
    }
    
    /**
     * @notice Add liquidity to a pool
     * @param poolId Pool ID
     * @param amounts Token amounts to add
     * @param minBptOut Minimum BPT to receive
     */
    function addLiquidity(
        bytes32 poolId,
        uint256[] memory amounts,
        uint256 minBptOut
    ) external returns (uint256 bptOut) {
        PoolInfo memory poolInfo = pools[poolId];
        require(poolInfo.active, "Pool not active");
        require(amounts.length == poolInfo.tokens.length, "Invalid amounts length");
        
        // Approve tokens
        for (uint256 i = 0; i < poolInfo.tokens.length; i++) {
            if (amounts[i] > 0) {
                IERC20(poolInfo.tokens[i]).transferFrom(
                    msg.sender,
                    address(this),
                    amounts[i]
                );
                IERC20(poolInfo.tokens[i]).approve(address(vault), amounts[i]);
            }
        }
        
        // Join pool
        IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest({
            assets: _toAssets(poolInfo.tokens),
            maxAmountsIn: amounts,
            userData: abi.encode(
                IBalancerVault.JoinKind.INIT,
                amounts
            ),
            fromInternalBalance: false
        });
        
        vault.joinPool(
            poolId,
            address(this),
            msg.sender, // BPT goes to sender
            request
        );
        
        // Get BPT balance
        bptOut = IERC20(poolInfo.poolAddress).balanceOf(msg.sender);
        require(bptOut >= minBptOut, "Insufficient BPT out");
        
        emit LiquidityAdded(poolId, msg.sender, amounts, bptOut);
    }
    
    /**
     * @notice Get pool info
     */
    function getPoolInfo(bytes32 poolId) external view returns (PoolInfo memory) {
        return pools[poolId];
    }
    
    /**
     * @notice Get all pool IDs
     */
    function getAllPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }
    
    /**
     * @notice Helper to convert addresses to IAsset[]
     */
    function _toAssets(address[] memory tokens) internal pure returns (IAsset[] memory assets) {
        assets = new IAsset[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            assets[i] = IAsset(tokens[i]);
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
    
    function getPool(bytes32 poolId) external view returns (address, uint8);
}

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);
}

interface IComposableStablePoolFactory {
    function create(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256 amplificationParameter,
        address[] memory rateProviders,
        uint256 swapFeePercentage,
        address owner
    ) external returns (address);
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


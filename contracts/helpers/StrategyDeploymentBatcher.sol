// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AjnaStrategy} from "../strategies/AjnaStrategy.sol";
import {CreatorCharmStrategy} from "../strategies/CreatorCharmStrategy.sol";

/**
 * @title StrategyDeploymentBatcher
 * @notice Deploy and configure all vault strategies in a single transaction
 * @dev Designed for use with Account Abstraction (ERC-4337) for 1-click deployment
 */
contract StrategyDeploymentBatcher {
    // ============================================
    // Events
    // ============================================
    
    event StrategiesDeployed(
        address indexed vault,
        address ajnaStrategy,
        address charmWethStrategy,
        address charmUsdcStrategy
    );

    // ============================================
    // Errors
    // ============================================
    
    error InvalidVault();
    error InvalidToken();
    error DeploymentFailed();

    // ============================================
    // Structs
    // ============================================
    
    struct DeploymentParams {
        address vault;
        address creatorToken;
        address ajnaFactory;
        address charmVault;
        address weth;
        address usdc;
        address zora;
        address uniswapV3Factory;
        uint256 ajnaBucketIndex;
        uint24 wethFee;  // e.g., 10000 for 1%
        uint24 usdcFee;  // e.g., 10000 for 1%
        uint256 ajnaWeight;      // e.g., 100
        uint256 charmWethWeight; // e.g., 100
        uint256 charmUsdcWeight; // e.g., 100
        uint256 minimumIdle;     // e.g., 12.5M tokens
    }

    // ============================================
    // Main Deployment Function
    // ============================================
    
    /**
     * @notice Deploy all strategies for a creator vault in one transaction
     * @param params Complete deployment parameters
     * @return ajnaStrategy Address of deployed Ajna strategy
     * @return charmWethStrategy Address of deployed Charm WETH LP strategy
     * @return charmUsdcStrategy Address of deployed Charm USDC LP strategy
     */
    function deployAllStrategies(DeploymentParams calldata params) 
        external 
        returns (
            address ajnaStrategy,
            address charmWethStrategy,
            address charmUsdcStrategy
        ) 
    {
        // Validate inputs
        if (params.vault == address(0)) revert InvalidVault();
        if (params.creatorToken == address(0)) revert InvalidToken();

        // ============================================
        // 1. Deploy Ajna Strategy (CREATOR/WETH lending)
        // ============================================
        
        ajnaStrategy = address(new AjnaStrategy(
            params.vault,
            params.creatorToken,
            params.ajnaFactory,
            params.weth,
            msg.sender  // Owner
        ));

        // ============================================
        // 2. Deploy Charm WETH LP Strategy
        // ============================================
        
        charmWethStrategy = address(new CreatorCharmStrategy(
            params.vault,
            params.creatorToken,
            params.weth,
            params.charmVault,
            params.uniswapV3Factory,
            params.wethFee,
            msg.sender  // Owner
        ));

        // ============================================
        // 3. Deploy Charm USDC LP Strategy
        // ============================================
        
        charmUsdcStrategy = address(new CreatorCharmStrategy(
            params.vault,
            params.creatorToken,
            params.usdc,
            params.charmVault,
            params.uniswapV3Factory,
            params.usdcFee,
            msg.sender  // Owner
        ));

        // ============================================
        // 4. Configure Ajna Strategy
        // ============================================
        
        // Find or deploy Ajna pool
        address ajnaPool = _findAjnaPool(
            params.ajnaFactory,
            params.creatorToken,
            params.weth
        );
        
        if (ajnaPool == address(0)) {
            // Deploy new Ajna pool with 5% interest rate
            ajnaPool = IAjnaFactory(params.ajnaFactory).deployPool(
                params.creatorToken,
                params.weth,
                50000000000000000 // 5%
            );
        }

        // Configure Ajna strategy
        AjnaStrategy(ajnaStrategy).setAjnaPool(ajnaPool);
        if (params.ajnaBucketIndex != 3696) {
            AjnaStrategy(ajnaStrategy).setBucketIndex(params.ajnaBucketIndex);
        }
        AjnaStrategy(ajnaStrategy).initializeApprovals();

        // ============================================
        // 5. Configure Charm Strategies
        // ============================================
        
        // Initialize approvals for both Charm strategies
        CreatorCharmStrategy(charmWethStrategy).initializeApprovals();
        CreatorCharmStrategy(charmUsdcStrategy).initializeApprovals();

        // ============================================
        // 6. Add strategies to vault
        // ============================================
        
        IVault(params.vault).addStrategy(ajnaStrategy, params.ajnaWeight);
        IVault(params.vault).addStrategy(charmWethStrategy, params.charmWethWeight);
        IVault(params.vault).addStrategy(charmUsdcStrategy, params.charmUsdcWeight);

        // ============================================
        // 7. Set minimum idle
        // ============================================
        
        if (params.minimumIdle > 0) {
            IVault(params.vault).setMinimumTotalIdle(params.minimumIdle);
        }

        // Transfer ownership of strategies to msg.sender
        AjnaStrategy(ajnaStrategy).transferOwnership(msg.sender);
        CreatorCharmStrategy(charmWethStrategy).transferOwnership(msg.sender);
        CreatorCharmStrategy(charmUsdcStrategy).transferOwnership(msg.sender);

        emit StrategiesDeployed(
            params.vault,
            ajnaStrategy,
            charmWethStrategy,
            charmUsdcStrategy
        );

        return (ajnaStrategy, charmWethStrategy, charmUsdcStrategy);
    }

    // ============================================
    // Helper Functions
    // ============================================
    
    /**
     * @notice Find existing Ajna pool or return address(0)
     */
    function _findAjnaPool(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (address) {
        // Try different interest rates
        uint256[3] memory rates = [
            uint256(50000000000000000),   // 5%
            uint256(100000000000000000),  // 10%
            uint256(150000000000000000)   // 15%
        ];

        for (uint256 i = 0; i < rates.length; i++) {
            bytes32 poolKey = keccak256(
                abi.encode(tokenA, tokenB, rates[i])
            );
            address pool = IAjnaFactory(factory).deployedPools(poolKey, factory);
            if (pool != address(0)) {
                return pool;
            }
        }

        return address(0);
    }

    // ============================================
    // View Functions
    // ============================================
    
    /**
     * @notice Calculate deployment gas estimate
     */
    function estimateDeploymentGas(DeploymentParams calldata params) 
        external 
        view 
        returns (uint256) 
    {
        // Rough estimate:
        // - 3 contract deployments: ~1.5M gas each = 4.5M
        // - Configuration calls: ~500K gas
        // - Vault operations: ~500K gas
        // Total: ~5.5M gas
        return 5_500_000;
    }

    /**
     * @notice Simulate deployment (for testing)
     */
    function simulateDeployment(DeploymentParams calldata params)
        external
        view
        returns (bool canDeploy, string memory reason)
    {
        if (params.vault == address(0)) {
            return (false, "Invalid vault address");
        }
        if (params.creatorToken == address(0)) {
            return (false, "Invalid creator token address");
        }
        if (params.ajnaFactory == address(0)) {
            return (false, "Invalid Ajna factory address");
        }
        if (params.charmVault == address(0)) {
            return (false, "Invalid Charm vault address");
        }
        
        return (true, "Deployment ready");
    }
}

// ============================================
// Interfaces
// ============================================

interface IVault {
    function addStrategy(address strategy, uint256 weight) external;
    function setMinimumTotalIdle(uint256 amount) external;
}

interface IAjnaFactory {
    function deployPool(
        address collateral,
        address quote,
        uint256 interestRate
    ) external returns (address pool);
    
    function deployedPools(
        bytes32 subsetHash,
        address factory
    ) external view returns (address);
}


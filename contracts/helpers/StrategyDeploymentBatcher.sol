// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../strategies/CreatorCharmStrategyV2.sol";
import "../strategies/AjnaStrategy.sol";
import "../charm/CharmAlphaVault.sol";
import "../charm/CharmAlphaVaultSimple.sol";
import "../charm/CharmAlphaStrategy.sol";
import "../interfaces/v3/IUniswapV3Factory.sol";
import "../interfaces/v3/IUniswapV3Pool.sol";

/**
 * @title StrategyDeploymentBatcher
 * @notice Deploy and configure all yield strategies in one AA transaction
 * @dev Deploys in a single transaction:
 *  1. Uniswap V3 Pool (CREATOR/USDC) - creates if doesn't exist
 *  2. Charm Alpha Vault - for automated LP management
 *  3. Charm Alpha Strategy - rebalancer for Charm vault
 *  4. Creator Charm Strategy V2 - vault integration with swap support
 *  5. Ajna Strategy (optional) - lending protocol integration
 * 
 * Features:
 *  - ✅ Creates V3 pool if doesn't exist
 *  - ✅ Single-sided deposits supported (swaps CREATOR → USDC)
 *  - ✅ Auto-initializes approvals for swapping
 *  - ✅ Returns all addresses for vault.addStrategy() calls
 * 
 * Usage with Account Abstraction:
 * 1. Call batchDeployStrategies() with CREATOR token, USDC, vault, factory
 * 2. All contracts deploy in one transaction
 * 3. Use returned addresses to call vault.addStrategy()
 */
contract StrategyDeploymentBatcher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Base Network Constants
    address public constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address public constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    struct DeploymentResult {
        address charmVault;
        address charmStrategy;
        address creatorCharmStrategy;
        address ajnaStrategy;
        address v3Pool;
    }

    event StrategiesDeployed(
        address indexed creator,
        address indexed underlyingToken,
        DeploymentResult result
    );

    /**
     * @notice Deploy all strategies for a creator vault (FULLY AUTOMATED)
     * @param underlyingToken The creator token (e.g., CREATOR)
     * @param quoteToken The quote token for LP (e.g., USDC - 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param creatorVault The vault that will use these strategies
     * @param _ajnaFactory The Ajna ERC20Pool factory address (if using Ajna)
     * @param v3FeeTier The Uniswap V3 fee tier (e.g., 3000 for 0.3%)
     * @param initialSqrtPriceX96 Initial price for V3 pool (e.g., for 99/1 CREATOR/USDC)
     * @param owner The creator coin owner who will own all strategies (typically the creator)
     * @param vaultName Standard name for the Charm vault (e.g., "CreatorVault: akita/USDC")
     * @param vaultSymbol Standard symbol for the Charm vault (e.g., "CV-akita-USDC")
     * @return result All deployed contract addresses
     * 
     * @dev This function is FULLY AUTOMATED:
     * - Deploys CharmAlphaVault, sets strategy, and transfers ownership atomically
     * - Calls rebalance() automatically after deployment
     * - No manual acceptance needed!
     * - Owner gets immediate control of all contracts
     */
    function batchDeployStrategies(
        address underlyingToken,
        address quoteToken,
        address creatorVault,
        address _ajnaFactory,
        uint24 v3FeeTier,
        uint160 initialSqrtPriceX96,
        address owner,
        string memory vaultName,
        string memory vaultSymbol
    ) external nonReentrant returns (DeploymentResult memory result) {
        require(owner != address(0), "Invalid owner address");
        require(bytes(vaultName).length > 0, "Invalid vault name");
        require(bytes(vaultSymbol).length > 0, "Invalid vault symbol");
        require(underlyingToken != address(0), "Zero underlying");
        require(quoteToken != address(0), "Zero quote");
        require(creatorVault != address(0), "Zero vault");

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Create or Get V3 Pool
        // ═══════════════════════════════════════════════════════════
        IUniswapV3Factory factory = IUniswapV3Factory(V3_FACTORY);
        result.v3Pool = factory.getPool(underlyingToken, quoteToken, v3FeeTier);
        
        if (result.v3Pool == address(0)) {
            // Create pool if it doesn't exist
            result.v3Pool = factory.createPool(underlyingToken, quoteToken, v3FeeTier);
            
            // Initialize pool
            IUniswapV3Pool(result.v3Pool).initialize(initialSqrtPriceX96);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Deploy Charm Alpha Vault (batcher is temp governance)
        // ═══════════════════════════════════════════════════════════
        result.charmVault = address(new CharmAlphaVaultSimple(
            result.v3Pool,
            10000,              // 1% protocol fee
            type(uint256).max,  // No supply cap (unlimited)
            vaultName,          // Standard name (e.g., "CreatorVault: akita/USDC")
            vaultSymbol         // Standard symbol (e.g., "CV-akita-USDC")
        ));

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Deploy Charm Alpha Strategy (Rebalancer)
        // ═══════════════════════════════════════════════════════════
        result.charmStrategy = address(new CharmAlphaStrategy(
            result.charmVault,
            3000,   // Base threshold
            6000,   // Limit threshold
            100,    // Max TWAP deviation
            1800,   // 30 min TWAP
            result.charmVault  // Keeper = vault initially (so vault can call rebalance)
        ));
        
        // Initialize vault: set strategy, rebalance, transfer keeper, transfer governance
        // This all happens atomically in one call
        CharmAlphaVaultSimple(result.charmVault).initializeAndTransfer(
            result.charmStrategy,
            owner,  // Transfer governance to creator
            owner   // Transfer keeper to creator
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Deploy Creator Charm Strategy V2 (Vault Integration)
        // ═══════════════════════════════════════════════════════════
        result.creatorCharmStrategy = address(new CreatorCharmStrategyV2(
            creatorVault,           // vault
            underlyingToken,        // CREATOR token
            quoteToken,             // USDC
            UNISWAP_ROUTER,         // SwapRouter
            result.charmVault,      // CharmAlphaVault
            result.v3Pool,          // CREATOR/USDC V3 pool for pricing
            owner                   // owner (can be multisig)
        ));
        
        // Initialize approvals for swapping
        CreatorCharmStrategyV2(result.creatorCharmStrategy).initializeApprovals();

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Deploy Ajna Strategy (if factory provided)
        // ═══════════════════════════════════════════════════════════
        if (_ajnaFactory != address(0)) {
            result.ajnaStrategy = address(new AjnaStrategy(
                creatorVault,        // vault
                underlyingToken,     // CREATOR token
                _ajnaFactory,        // Ajna ERC20Pool factory
                quoteToken,          // USDC (quote token)
                owner                // owner (can be multisig)
            ));
        }

        emit StrategiesDeployed(msg.sender, underlyingToken, result);
    }

    /**
     * @notice Deploy all strategies, using the FULL CharmAlphaVault (not CharmAlphaVaultSimple).
     * @dev Difference vs `batchDeployStrategies`:
     * - Deploys `CharmAlphaVault` directly (original implementation).
     * - Sets `pendingGovernance = owner` (owner must later call `acceptGovernance()`).
     * - Still does an initial `rebalance()` by setting keeper to this batcher temporarily.
     *
     * This is the path to use if you want the canonical Charm vault bytecode deployed onchain.
     */
    function batchDeployStrategiesFullCharmVault(
        address underlyingToken,
        address quoteToken,
        address creatorVault,
        address _ajnaFactory,
        uint24 v3FeeTier,
        uint160 initialSqrtPriceX96,
        address owner,
        string memory vaultName,
        string memory vaultSymbol
    ) external nonReentrant returns (DeploymentResult memory result) {
        require(owner != address(0), "Invalid owner address");
        require(bytes(vaultName).length > 0, "Invalid vault name");
        require(bytes(vaultSymbol).length > 0, "Invalid vault symbol");
        require(underlyingToken != address(0), "Zero underlying");
        require(quoteToken != address(0), "Zero quote");
        require(creatorVault != address(0), "Zero vault");

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Create or Get V3 Pool
        // ═══════════════════════════════════════════════════════════
        IUniswapV3Factory factory = IUniswapV3Factory(V3_FACTORY);
        result.v3Pool = factory.getPool(underlyingToken, quoteToken, v3FeeTier);

        if (result.v3Pool == address(0)) {
            result.v3Pool = factory.createPool(underlyingToken, quoteToken, v3FeeTier);
            IUniswapV3Pool(result.v3Pool).initialize(initialSqrtPriceX96);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Deploy FULL Charm Alpha Vault (batcher is governance)
        // ═══════════════════════════════════════════════════════════
        result.charmVault = address(new CharmAlphaVault(
            result.v3Pool,
            10000,              // 1% protocol fee
            type(uint256).max,  // No supply cap
            vaultName,
            vaultSymbol
        ));

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Deploy Charm Alpha Strategy
        // ═══════════════════════════════════════════════════════════
        // Keeper = this batcher so we can run an initial rebalance, then we hand keeper off to `owner`.
        result.charmStrategy = address(new CharmAlphaStrategy(
            result.charmVault,
            3000,
            6000,
            100,
            1800,
            address(this)
        ));

        // Wire vault → strategy while we're governance
        CharmAlphaVault(result.charmVault).setStrategy(result.charmStrategy);

        // Initial rebalance (as keeper)
        CharmAlphaStrategy(result.charmStrategy).rebalance();

        // Hand keeper off to owner (allowed because we're vault.governance)
        CharmAlphaStrategy(result.charmStrategy).setKeeper(owner);

        // Set pending governance (owner must accept later)
        CharmAlphaVault(result.charmVault).setGovernance(owner);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Deploy Creator Charm Strategy V2 (Vault Integration)
        // ═══════════════════════════════════════════════════════════
        result.creatorCharmStrategy = address(new CreatorCharmStrategyV2(
            creatorVault,
            underlyingToken,
            quoteToken,
            UNISWAP_ROUTER,
            result.charmVault,
            result.v3Pool,
            owner
        ));

        CreatorCharmStrategyV2(result.creatorCharmStrategy).initializeApprovals();

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Deploy Ajna Strategy (optional)
        // ═══════════════════════════════════════════════════════════
        if (_ajnaFactory != address(0)) {
            result.ajnaStrategy = address(new AjnaStrategy(
                creatorVault,
                underlyingToken,
                _ajnaFactory,
                quoteToken,
                owner
            ));
        }

        emit StrategiesDeployed(msg.sender, underlyingToken, result);
    }

    /**
     * @notice Helper to encode vault.addStrategy() calls for AA
     * @dev Returns calldata for batched execution
     */
    function encodeAddStrategyBatch(
        address vault,
        DeploymentResult memory result,
        uint256 charmAllocation,  // e.g., 690000000000000000 for 69%
        uint256 ajnaAllocation    // e.g., 213900000000000000 for 21.39%
    ) external pure returns (bytes[] memory calls) {
        uint256 numCalls = result.ajnaStrategy != address(0) ? 2 : 1;
        calls = new bytes[](numCalls);
        
        // Charm strategy
        calls[0] = abi.encodeWithSignature(
            "addStrategy(address,uint256)",
            result.creatorCharmStrategy,
            charmAllocation
        );
        
        // Ajna strategy (if exists)
        if (result.ajnaStrategy != address(0)) {
            calls[1] = abi.encodeWithSignature(
                "addStrategy(address,uint256)",
                result.ajnaStrategy,
                ajnaAllocation
            );
        }
    }
}

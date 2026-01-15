// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../vault/strategies/univ3/CreatorCharmStrategy.sol";
import "../../vault/strategies/AjnaStrategy.sol";
import "../../vault/strategies/univ3/CharmAlphaVaultDeploy.sol";
import "../../interfaces/uniswap/IUniswapV3Factory.sol";
import "../../interfaces/uniswap/IUniswapV3Pool.sol";

/**
 * @title StrategyDeploymentBatcher
 * @author 0xakita.eth
 * @notice Batches deployment and wiring of CreatorVault strategies.
 * @dev Used by AA deployment flows to create pools, vaults, and adapters.
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
        result.charmVault = address(new CharmAlphaVaultDeploy(
            result.v3Pool,
            10000,              // 1% protocol fee
            type(uint256).max,  // No supply cap (unlimited)
            vaultName,          // Standard name (e.g., "CreatorVault: akita/USDC")
            vaultSymbol         // Standard symbol (e.g., "CV-akita-USDC")
        ));

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Initialize embedded rebalance logic (Atomic / Simple path)
        // ═══════════════════════════════════════════════════════════
        // No separate CharmAlphaStrategy contract is needed here; CharmAlphaVaultDeploy embeds it.
        result.charmStrategy = address(0);

        // Initialize vault: configure embedded params, do initial rebalance, transfer keeper, transfer governance.
        CharmAlphaVaultDeploy(result.charmVault).initializeAndTransfer(
            owner,  // Transfer governance to creator
            owner,  // Transfer keeper to creator
            3000,   // Base threshold
            6000,   // Limit threshold
            100,    // Max TWAP deviation
            1800    // 30 min TWAP
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Deploy Creator Charm Strategy V2 (Vault Integration)
        // ═══════════════════════════════════════════════════════════
        result.creatorCharmStrategy = address(new CreatorCharmStrategy(
            creatorVault,           // vault
            underlyingToken,        // CREATOR token
            quoteToken,             // USDC
            UNISWAP_ROUTER,         // SwapRouter
            result.charmVault,      // CharmAlphaVault
            result.v3Pool,          // CREATOR/USDC V3 pool for pricing
            owner                   // owner (can be multisig)
        ));

        // Initialize approvals for swapping
        CreatorCharmStrategy(result.creatorCharmStrategy).initializeApprovals();

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
     * @notice Helper to encode vault.addStrategy() calls for AA
     * @dev Returns calldata for batched execution
     */
    function encodeAddStrategyBatch(
        address /* vault */,
        DeploymentResult memory result,
        uint256 charmWeightBps,  // e.g., 6900 for 69.00%
        uint256 ajnaWeightBps    // e.g., 2139 for 21.39%
    ) external pure returns (bytes[] memory calls) {
        uint256 numCalls = result.ajnaStrategy != address(0) ? 2 : 1;
        calls = new bytes[](numCalls);

        // Charm strategy
        calls[0] = abi.encodeWithSignature(
            "addStrategy(address,uint256)",
            result.creatorCharmStrategy,
            charmWeightBps
        );

        // Ajna strategy (if exists)
        if (result.ajnaStrategy != address(0)) {
            calls[1] = abi.encodeWithSignature(
                "addStrategy(address,uint256)",
                result.ajnaStrategy,
                ajnaWeightBps
            );
        }
    }
}

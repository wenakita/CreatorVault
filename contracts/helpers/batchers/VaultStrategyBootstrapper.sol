// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultStrategyBootstrapper
 * @author 0xakita.eth
 * @notice Bootstraps vault strategy and admin settings.
 * @dev Used by deployment scripts for initial wiring.
 */
import {StrategyDeploymentBatcher} from "./StrategyDeploymentBatcher.sol";

/// @notice Minimal interface subset of CreatorOVault for bootstrap wiring.
interface ICreatorOVault {
    function setGaugeController(address _gaugeController) external;
    function setWhitelist(address user, bool allowed) external;
    function addStrategy(address strategy, uint256 weight) external;
    function setMinimumTotalIdle(uint256 _minimumTotalIdle) external;

    function setKeeper(address _keeper) external;
    function setEmergencyAdmin(address _emergencyAdmin) external;
    function setPerformanceFeeRecipient(address _performanceFeeRecipient) external;
    function setPendingManagement(address _management) external;

    function transferOwnership(address newOwner) external;
}

contract VaultStrategyBootstrapper {
    error Unauthorized();
    error AlreadyFinalized();

    address public immutable finalOwner;
    bool public finalized;

    constructor(address _finalOwner) {
        require(_finalOwner != address(0), "Invalid owner");
        finalOwner = _finalOwner;
    }

    function finalize(
        address vault,
        address wrapper,
        address gaugeController,
        address creatorToken,
        address usdc,
        address ajnaFactory,
        uint24 v3FeeTier,
        uint160 initialSqrtPriceX96,
        string calldata charmVaultName,
        string calldata charmVaultSymbol,
        uint256 charmWeightBps,
        uint256 ajnaWeightBps,
        uint256 minimumTotalIdle
    ) external {
        if (msg.sender != finalOwner) revert Unauthorized();
        if (finalized) revert AlreadyFinalized();
        finalized = true;

        // 1) Deploy yield strategies (Charm + Ajna) and any required pool/vault plumbing.
        StrategyDeploymentBatcher batcher = new StrategyDeploymentBatcher();
        StrategyDeploymentBatcher.DeploymentResult memory result = batcher.batchDeployStrategies(
            creatorToken,
            usdc,
            vault,
            ajnaFactory,
            v3FeeTier,
            initialSqrtPriceX96,
            finalOwner,
            charmVaultName,
            charmVaultSymbol
        );

        // 2) Wire vault for core infra
        ICreatorOVault(vault).setGaugeController(gaugeController);
        ICreatorOVault(vault).setWhitelist(wrapper, true);

        // 3) Add strategies to vault allocations (basis points, total <= 10_000)
        if (charmWeightBps > 0) {
            ICreatorOVault(vault).addStrategy(result.creatorCharmStrategy, charmWeightBps);
        }
        if (result.ajnaStrategy != address(0) && ajnaWeightBps > 0) {
            ICreatorOVault(vault).addStrategy(result.ajnaStrategy, ajnaWeightBps);
        }

        // 4) Set idle reserve (how much underlying stays liquid in the vault)
        ICreatorOVault(vault).setMinimumTotalIdle(minimumTotalIdle);

        // 5) Hand off vault roles and ownership to final owner
        ICreatorOVault(vault).setKeeper(finalOwner);
        ICreatorOVault(vault).setEmergencyAdmin(finalOwner);
        ICreatorOVault(vault).setPerformanceFeeRecipient(finalOwner);
        ICreatorOVault(vault).setPendingManagement(finalOwner);
        ICreatorOVault(vault).transferOwnership(finalOwner);
    }
}

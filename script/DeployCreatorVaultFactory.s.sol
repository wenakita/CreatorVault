// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/factories/CreatorVaultFactory.sol";

/**
 * @title DeployCreatorVaultFactory
 * @notice Deploys the CreatorVaultFactory to Base
 * 
 * Usage:
 * forge script script/DeployCreatorVaultFactory.s.sol:DeployCreatorVaultFactory \
 *   --rpc-url base \
 *   --broadcast \
 *   --verify
 */
contract DeployCreatorVaultFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy CreatorVaultFactory
        // registry = address(0) for now (can be set later)
        // owner = deployer
        CreatorVaultFactory factory = new CreatorVaultFactory(
            address(0),  // registry (optional)
            deployer     // owner
        );
        
        vm.stopBroadcast();
        
        console.log("\n");
        console.log("========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("CreatorVaultFactory:", address(factory));
        console.log("VaultActivationBatcher:", factory.VAULT_ACTIVATION_BATCHER());
        console.log("\n");
        console.log("FEATURES:");
        console.log("- CREATE2 deployment (deterministic addresses)");
        console.log("- Auto-approves VaultActivationBatcher");
        console.log("- Deploys 5 contracts in 1 tx");
        console.log("\n");
        console.log("NEXT STEPS:");
        console.log("1. Save the factory address");
        console.log("2. Call deployCreatorVaultAuto(token, creator)");
        console.log("3. Vault deploys with same address on ALL chains!");
        console.log("4. CCA auto-approved for 1-click launch");
        console.log("========================================");
    }
}



import "forge-std/Script.sol";
import "../contracts/factories/CreatorVaultFactory.sol";

/**
 * @title DeployCreatorVaultFactory
 * @notice Deploys the CreatorVaultFactory to Base
 * 
 * Usage:
 * forge script script/DeployCreatorVaultFactory.s.sol:DeployCreatorVaultFactory \
 *   --rpc-url base \
 *   --broadcast \
 *   --verify
 */

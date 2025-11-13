// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title TransferVaultToMultisig
 * @notice Transfer vault management to multisig for team governance
 */
contract TransferVaultToMultisig is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("TRANSFER VAULT MANAGEMENT TO MULTISIG");
        console.log("===============================================");
        console.log("Vault:", VAULT);
        console.log("Current Management:", deployer);
        console.log("New Management (Multisig):", MULTISIG);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        address currentManagement = vault.management();
        require(deployer == currentManagement, "Not current management");
        
        console.log("Step 1: Setting pending management to multisig...");
        console.log("");
        
        vm.startBroadcast(pk);
        
        vault.setPendingManagement(MULTISIG);
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("PENDING MANAGEMENT SET!");
        console.log("===============================================");
        console.log("");
        console.log("Step 2: Multisig must accept management");
        console.log("  Multisig:", MULTISIG);
        console.log("");
        console.log("Your team needs to propose and execute:");
        console.log("  Contract: 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953");
        console.log("  Function: acceptManagement()");
        console.log("  Calldata: 0xb437c6e7");
        console.log("");
        console.log("After accepting, the multisig can collectively:");
        console.log("  - Execute forceDeployToStrategies()");
        console.log("  - Add/remove/update strategies");
        console.log("  - Update vault parameters");
        console.log("");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {VaultActivator} from "../contracts/factories/VaultActivator.sol";

contract DeployLauncher is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        VaultActivator activator = new VaultActivator();
        
        console.log("");
        console.log("=== VAULT ACTIVATOR DEPLOYED ===");
        console.log("Address:", address(activator));
        console.log("");
        console.log("Two-Step Launch:");
        console.log("1. Deploy via: forge script DeployCreatorVault");
        console.log("2. Activate via: activator.activate(vault, wrapper, cca, amount, %, raise)");
        
        vm.stopBroadcast();
    }
}


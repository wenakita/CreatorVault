// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";

interface IEagleOVault {
    function forceDeployToStrategies() external;
    function wlfiBalance() external view returns (uint256);
    function usd1Balance() external view returns (uint256);
}

contract DeployFunds is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        IEagleOVault vault = IEagleOVault(VAULT);
        
        console.log("=== Before Deployment ===");
        console.log("Vault wlfiBalance:", vault.wlfiBalance());
        console.log("Vault usd1Balance:", vault.usd1Balance());
        console.log("");
        
        vm.startBroadcast(pk);
        
        console.log("Calling forceDeployToStrategies()...");
        vault.forceDeployToStrategies();
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== After Deployment ===");
        console.log("Vault wlfiBalance:", vault.wlfiBalance());
        console.log("Vault usd1Balance:", vault.usd1Balance());
        console.log("");
        console.log("SUCCESS! Funds deployed to strategies.");
    }
}


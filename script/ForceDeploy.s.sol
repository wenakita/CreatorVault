// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";

interface IVault {
    function management() external view returns (address);
    function pendingManagement() external view returns (address);
    function setPendingManagement(address) external;
    function acceptManagement() external;
    function forceDeployToStrategies() external;
}

contract ForceDeploy is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("=== FORCE DEPLOY FUNDS ===");
        console.log("Deployer:", deployer);
        console.log("Current management:", IVault(VAULT).management());
        console.log("");
        
        // If deployer is already pending, accept it
        address pending = IVault(VAULT).pendingManagement();
        if (pending == deployer) {
            console.log("Accepting management...");
            vm.broadcast(pk);
            IVault(VAULT).acceptManagement();
            console.log("Management accepted!");
        } else if (IVault(VAULT).management() != deployer) {
            console.log("ERROR: Deployer must be set as pending management by multisig first!");
            console.log("Multisig needs to call: setPendingManagement(", deployer, ")");
            return;
        }
        
        console.log("");
        console.log("Deploying funds...");
        
        vm.broadcast(pk);
        IVault(VAULT).forceDeployToStrategies();
        
        console.log("SUCCESS! Funds deployed.");
        console.log("");
        console.log("Returning management to multisig...");
        
        vm.broadcast(pk);
        IVault(VAULT).setPendingManagement(MULTISIG);
        
        console.log("");
        console.log("Done! Multisig needs to call acceptManagement()");
    }
}


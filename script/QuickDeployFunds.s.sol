// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";

interface IVault {
    function setPendingManagement(address) external;
    function acceptManagement() external;
    function forceDeployToStrategies() external;
    function management() external view returns (address);
}

contract QuickDeployFunds is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Current management:", IVault(VAULT).management());
        console.log("Deployer:", deployer);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // 1. Take management
        console.log("Taking management...");
        IVault(VAULT).setPendingManagement(deployer);
        IVault(VAULT).acceptManagement();
        
        // 2. Deploy funds
        console.log("Deploying funds...");
        IVault(VAULT).forceDeployToStrategies();
        
        // 3. Give management back to multisig
        console.log("Returning management to multisig...");
        IVault(VAULT).setPendingManagement(MULTISIG);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("Done! Multisig needs to accept management.");
    }
}


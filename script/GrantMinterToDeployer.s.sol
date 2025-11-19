// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

contract GrantMinterToDeployer is Script {
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant DEPLOYER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    function run() external view {
        console.log("=================================");
        console.log("Grant Minter Permission");
        console.log("=================================");
        console.log("");
        console.log("Contract:", EAGLE_SHARE_OFT);
        console.log("New Minter:", DEPLOYER);
        console.log("");
        
        // Generate calldata
        bytes memory calldata_ = abi.encodeWithSignature(
            "setMinter(address,bool)",
            DEPLOYER,
            true
        );
        
        console.log("=================================");
        console.log("Safe Transaction");
        console.log("=================================");
        console.log("");
        console.log("To:", EAGLE_SHARE_OFT);
        console.log("Value: 0");
        console.log("Data:", vm.toString(calldata_));
        console.log("");
        console.log("Function: setMinter(address,bool)");
        console.log("  minter:", DEPLOYER);
        console.log("  status: true");
        console.log("");
        console.log("Go to: https://app.safe.global/transactions/queue?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
    }
}


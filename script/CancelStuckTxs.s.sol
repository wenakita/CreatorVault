// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

contract CancelStuckTxs is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        // Get the account's current nonce
        console.log("This script will send 0 ETH to yourself at nonce 956");
        console.log("to cancel the stuck transactions.");
        console.log("");
        console.log("Run this with --broadcast and current gas prices");
        
        vm.startBroadcast(pk);
        
        address deployer = vm.addr(pk);
        
        // Send 0 ETH to yourself to cancel tx at nonce 956
        payable(deployer).transfer(0);
        
        vm.stopBroadcast();
    }
}


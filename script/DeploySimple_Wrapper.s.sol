// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleVaultWrapper.sol";

/**
 * @title DeploySimple_Wrapper
 * @notice Deploy EagleVaultWrapper WITHOUT vanity address
 */
contract DeploySimple_Wrapper is Script {
    // UPDATE THESE WITH ACTUAL DEPLOYED ADDRESSES!
    address constant VAULT_ADDRESS = 0xAb2BBa11C00baFe6e3be241Ca0765Ce150e9361F;
    address constant OFT_ADDRESS = 0x0000000000000000000000000000000000000000; // UPDATE AFTER OFT DEPLOYMENT
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY: EagleVaultWrapper (No Vanity)");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Vault:", VAULT_ADDRESS);
        console.log("OFT:", OFT_ADDRESS);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        require(OFT_ADDRESS != address(0), "ERROR: Update OFT_ADDRESS first!");
        
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        EagleVaultWrapper wrapper = new EagleVaultWrapper(
            VAULT_ADDRESS,
            OFT_ADDRESS,
            deployer, // feeRecipient
            deployer  // owner
        );
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("WRAPPER DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Address:", address(wrapper));
        console.log("");
    }
}


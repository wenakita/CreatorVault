// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title DeploySimple_OFT
 * @notice Deploy EagleShareOFT WITHOUT vanity address (regular deployment)
 */
contract DeploySimple_OFT is Script {
    // EagleRegistry address
    address constant EAGLE_REGISTRY = 0x47c2e78bCCCdF3E4Ad835c1c2df3Fb760b0EA91E;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY: EagleShareOFT (No Vanity)");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Registry:", EAGLE_REGISTRY);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Verify registry exists
        uint256 registryCodeSize;
        assembly {
            registryCodeSize := extcodesize(EAGLE_REGISTRY)
        }
        require(registryCodeSize > 0, "ERROR: EagleRegistry not deployed!");
        
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Regular deployment (no CREATE2)
        EagleShareOFT oft = new EagleShareOFT("Eagle", "EAGLE", EAGLE_REGISTRY, deployer);
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("OFT DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Address:", address(oft));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Note this address for wrapper deployment");
        console.log("2. Verify on Etherscan");
        console.log("3. Transfer ownership to multisig");
        console.log("");
    }
}


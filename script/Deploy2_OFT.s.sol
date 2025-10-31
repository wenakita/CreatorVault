// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title Deploy2_OFT
 * @notice Deploy ONLY EagleShareOFT with PREMIUM vanity address
 */
contract Deploy2_OFT is Script {
    // EagleRegistry address (must be deployed first)
    address constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    // Vanity salt and expected address (Forge CREATE2 Deployer) - PREMIUM VANITY!
    bytes32 constant OFT_SALT = 0x000000000000000000000000000000000000000000000000200000000c9234d8;
    address constant EXPECTED_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY 2/4: EagleShareOFT");
        console.log("Pattern: 0x47...ea91e [PREMIUM]");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Registry:", EAGLE_REGISTRY);
        console.log("Expected Address:", EXPECTED_OFT);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Verify registry exists
        uint256 registryCodeSize;
        assembly {
            registryCodeSize := extcodesize(EAGLE_REGISTRY)
        }
        require(registryCodeSize > 0, "ERROR: EagleRegistry not deployed!");
        
        console.log("Registry verified: OK");
        console.log("");
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory bytecode = abi.encodePacked(
            type(EagleShareOFT).creationCode,
            abi.encode("Eagle", "EAGLE", EAGLE_REGISTRY, deployer)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), OFT_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("OFT DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Deployed:", deployed);
        console.log("Expected:", EXPECTED_OFT);
        
        if (deployed == EXPECTED_OFT) {
            console.log("Status: ADDRESS MATCH! [PREMIUM VANITY]");
        } else {
            console.log("Status: ADDRESS MISMATCH! [ERROR]");
        }
        
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Verify on Etherscan");
        console.log("2. Deploy Wrapper: forge script script/Deploy3_Wrapper.s.sol");
        console.log("");
    }
}


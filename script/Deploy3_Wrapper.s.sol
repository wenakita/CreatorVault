// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleVaultWrapper.sol";

/**
 * @title Deploy3_Wrapper
 * @notice Deploy ONLY EagleVaultWrapper with vanity address
 */
contract Deploy3_Wrapper is Script {
    // REAL DEPLOYED ADDRESSES
    address constant VAULT_ADDRESS = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant OFT_ADDRESS = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Vanity salt and expected address (with real deployed addresses)
    bytes32 constant WRAPPER_SALT = 0x000000000000000000000000000000000000000000000000000000000000006c;
    address constant EXPECTED_WRAPPER = 0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY 3/4: EagleVaultWrapper");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Vault:", VAULT_ADDRESS);
        console.log("OFT:", OFT_ADDRESS);
        console.log("Expected Address:", EXPECTED_WRAPPER);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Verify vault and OFT exist
        uint256 vaultCodeSize;
        uint256 oftCodeSize;
        assembly {
            vaultCodeSize := extcodesize(VAULT_ADDRESS)
            oftCodeSize := extcodesize(OFT_ADDRESS)
        }
        require(vaultCodeSize > 0, "ERROR: Vault not deployed!");
        require(oftCodeSize > 0, "ERROR: OFT not deployed!");
        
        console.log("Vault verified: OK");
        console.log("OFT verified: OK");
        console.log("");
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory bytecode = abi.encodePacked(
            type(EagleVaultWrapper).creationCode,
            abi.encode(VAULT_ADDRESS, OFT_ADDRESS, deployer, deployer)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), WRAPPER_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("WRAPPER DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Deployed:", deployed);
        console.log("Expected:", EXPECTED_WRAPPER);
        
        if (deployed == EXPECTED_WRAPPER) {
            console.log("Status: ADDRESS MATCH! [OK]");
        } else {
            console.log("Status: ADDRESS MISMATCH! [ERROR]");
        }
        
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Verify on Etherscan");
        console.log("2. Deploy Strategy: forge script script/Deploy4_Strategy.s.sol");
        console.log("");
    }
}


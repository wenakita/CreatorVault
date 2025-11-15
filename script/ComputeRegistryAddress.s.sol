// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title ComputeRegistryAddress
 * @notice Compute the EagleRegistry address WITHOUT deploying
 * 
 * @dev USE THIS FIRST to verify the address will be the same on all chains!
 * 
 * @dev USAGE:
 *      forge script script/ComputeRegistryAddress.s.sol:ComputeRegistryAddress
 */
contract ComputeRegistryAddress is Script {
    // Salt (MUST match DeployRegistryCreate2.s.sol)
    bytes32 constant SALT = 0x0000000000000000000000000000000000000000000000000000000000004747;
    
    // Owner address (MUST match DeployRegistryCreate2.s.sol)
    address constant INITIAL_OWNER = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external view {
        console.log("=============================================");
        console.log("COMPUTE: EagleRegistry Address (CREATE2)");
        console.log("=============================================");
        console.log("");
        
        // Prepare bytecode
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(INITIAL_OWNER)
        );
        
        bytes32 bytecodeHash = keccak256(bytecode);
        
        // Compute address
        address predicted = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            CREATE2_FACTORY,
            SALT,
            bytecodeHash
        )))));
        
        console.log("CREATE2 Configuration:");
        console.log("  Factory:       ", CREATE2_FACTORY);
        console.log("  Salt:          ", vm.toString(SALT));
        console.log("  Owner:         ", INITIAL_OWNER);
        console.log("  Bytecode Hash: ", vm.toString(bytecodeHash));
        console.log("");
        
        console.log("=============================================");
        console.log("PREDICTED ADDRESS:");
        console.log(predicted);
        console.log("=============================================");
        console.log("");
        
        console.log("This address will be the SAME on:");
        console.log("  - Ethereum Mainnet");
        console.log("  - Arbitrum");
        console.log("  - Base");
        console.log("  - Optimism");
        console.log("  - Polygon");
        console.log("  - Any other EVM chain with CREATE2 factory");
        console.log("");
        
        console.log("To deploy, run:");
        console.log("  forge script script/DeployRegistryCreate2.s.sol --rpc-url <RPC> --broadcast");
        console.log("");
    }
}


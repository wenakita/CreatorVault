// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/WLFIOFT.sol";

/**
 * @title ComputeWLFIOFTHash
 * @notice Compute init code hash for WLFI OFT
 * 
 * Usage:
 *   forge script script/layerzero/ComputeWLFIOFTHash.s.sol
 */
contract ComputeWLFIOFTHash is Script {
    
    // Constructor arguments (will be same on all chains)
    string constant NAME = "World Liberty Financial";
    string constant SYMBOL = "WLFI";
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e; // EagleRegistry (same on all chains)
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031; // Your address
    
    function run() external view {
        console.log("==============================================");
        console.log("WLFI OFT - INIT CODE HASH COMPUTATION");
        console.log("==============================================");
        console.log("");
        
        // Get creation code
        bytes memory creationCode = type(WLFIOFT).creationCode;
        console.log("Creation code length:", creationCode.length);
        console.log("");
        
        // Encode constructor args
        bytes memory constructorArgs = abi.encode(NAME, SYMBOL, REGISTRY, OWNER);
        console.log("Constructor args length:", constructorArgs.length);
        console.log("");
        
        // Combine creation code + constructor args
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        console.log("Full init code length:", initCode.length);
        console.log("");
        
        // Compute hash
        bytes32 initCodeHash = keccak256(initCode);
        
        console.log("==============================================");
        console.log("RESULT");
        console.log("==============================================");
        console.log("");
        console.log("Init Code Hash:");
        console.logBytes32(initCodeHash);
        console.log("");
        console.log("Copy this hash to create2-miner-wlfi/src/main.rs:");
        console.log("const INIT_CODE_HASH: &str = \"%s\";", vm.toString(initCodeHash));
        console.log("");
        console.log("==============================================");
        console.log("NEXT STEPS");
        console.log("==============================================");
        console.log("");
        console.log("1. Update INIT_CODE_HASH in create2-miner-wlfi/src/main.rs");
        console.log("2. Run: cd create2-miner-wlfi && cargo run --release");
        console.log("3. Wait for 0x47... address (may take 1-5 minutes)");
        console.log("4. Use the salt in DeployWLFIOFTExact.s.sol");
        console.log("");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title DebugCreate2
 * @notice Debug CREATE2 address calculation
 */
contract DebugCreate2 is Script {
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant USD1_PRICE_FEED = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    address constant WLFI_USD1_POOL = 0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    bytes32 constant TEST_SALT = 0x000000000000000000000000000000000000000000000000b800000000a5166f;
    
    function run() external view {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        
        console.log("==============================================");
        console.log("DEBUG CREATE2 CALCULATION");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Salt:", vm.toString(TEST_SALT));
        console.log("");
        
        // Get the init code
        bytes memory initCode = abi.encodePacked(
            type(EagleOVault).creationCode,
            abi.encode(WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer)
        );
        
        bytes32 initCodeHash = keccak256(initCode);
        console.log("Init Code Hash:", vm.toString(initCodeHash));
        console.log("Init Code Length:", initCode.length);
        console.log("");
        
        // Calculate CREATE2 address manually
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                deployer,
                TEST_SALT,
                initCodeHash
            )
        );
        
        address predicted = address(uint160(uint256(hash)));
        console.log("Predicted Address:", predicted);
        console.log("");
        
        // Now deploy with actual CREATE2 and see what we get
        console.log("==============================================");
        console.log("TESTING ACTUAL CREATE2 DEPLOYMENT");
        console.log("==============================================");
        console.log("");
        
        // Show what we expect from vanity generator
        console.log("Expected from vanity-addresses-forge.json:");
        console.log("  0x47E0E593AF3534f93F9816b5243e6554425Ea91e");
        console.log("");
        console.log("If predicted != expected, there's a mismatch!");
    }
}


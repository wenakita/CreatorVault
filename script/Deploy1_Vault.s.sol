// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";

/**
 * @title Deploy1_Vault
 * @notice Deploy ONLY EagleOVault with vanity address
 */
contract Deploy1_Vault is Script {
    // Mainnet token addresses
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant USD1_PRICE_FEED = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    address constant WLFI_USD1_POOL = 0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    // Vanity salt and expected address (Forge CREATE2 Deployer)
    bytes32 constant VAULT_SALT = 0x0000000000000000000000000000000000000000000000000000000000000027;
    address constant EXPECTED_VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY 1/4: EagleOVault");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Expected Address:", EXPECTED_VAULT);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory bytecode = abi.encodePacked(
            type(EagleOVault).creationCode,
            abi.encode(WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), VAULT_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("VAULT DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Deployed:", deployed);
        console.log("Expected:", EXPECTED_VAULT);
        
        if (deployed == EXPECTED_VAULT) {
            console.log("Status: ADDRESS MATCH! [OK]");
        } else {
            console.log("Status: ADDRESS MISMATCH! [ERROR]");
        }
        
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Verify on Etherscan");
        console.log("2. Deploy OFT: forge script script/Deploy2_OFT.s.sol");
        console.log("");
    }
}


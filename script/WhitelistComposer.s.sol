// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { EagleOVault } from "../contracts/EagleOVault.sol";

/**
 * @notice Whitelist the Composer contract in the vault
 * @dev Run with: forge script script/WhitelistComposer.s.sol --rpc-url $RPC_URL --broadcast
 */
contract WhitelistComposer is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant COMPOSER = 0x3A91B3e863C0bd6948088e8A0A9B1D22d6D05da9;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("========================================");
        console.log("Whitelisting Composer in Vault");
        console.log("========================================");
        console.log("Vault:", address(vault));
        console.log("Composer:", COMPOSER);
        console.log("");
        
        // Check current status
        bool isWhitelisted = vault.whitelist(COMPOSER);
        console.log("Current whitelist status:", isWhitelisted);
        
        if (!isWhitelisted) {
            console.log("\nAdding Composer to whitelist...");
            vault.setWhitelist(COMPOSER, true);
            console.log("SUCCESS: Composer whitelisted!");
        } else {
            console.log("\nSUCCESS: Composer already whitelisted");
        }
        
        vm.stopBroadcast();
        
        console.log("\n========================================");
        console.log("Done!");
        console.log("========================================");
    }
}


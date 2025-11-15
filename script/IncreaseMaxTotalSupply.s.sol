// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { EagleOVault } from "../contracts/EagleOVault.sol";

/**
 * @notice Increase the vault's max total supply
 * @dev Run with: forge script script/IncreaseMaxTotalSupply.s.sol --rpc-url $RPC_URL --broadcast
 */
contract IncreaseMaxTotalSupply is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    uint256 constant NEW_MAX = 100_000_000 ether; // 100M shares
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("========================================");
        console.log("Increasing Vault Max Total Supply");
        console.log("========================================");
        console.log("Vault:", address(vault));
        console.log("");
        
        // Check current values
        uint256 currentMax = vault.maxTotalSupply();
        uint256 currentSupply = vault.totalSupply();
        
        console.log("Current Max Total Supply:", currentMax / 1e18, "M shares");
        console.log("Current Total Supply:", currentSupply / 1e18, "M shares");
        console.log("New Max Total Supply:", NEW_MAX / 1e18, "M shares");
        console.log("");
        
        if (currentSupply >= currentMax) {
            console.log("WARNING: Vault is at or above max capacity!");
        }
        
        console.log("Setting new max total supply...");
        vault.setMaxTotalSupply(NEW_MAX);
        console.log("SUCCESS: Max total supply increased!");
        
        vm.stopBroadcast();
        
        console.log("\n========================================");
        console.log("Done!");
        console.log("========================================");
    }
}


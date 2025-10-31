// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

/**
 * @title Deploy4_Strategy
 * @notice Deploy ONLY CharmStrategyUSD1 with vanity address
 */
contract Deploy4_Strategy is Script {
    // REAL DEPLOYED VAULT ADDRESS
    address constant VAULT_ADDRESS = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    
    // Mainnet addresses
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    // Vanity salt and expected address (with real deployed vault)
    bytes32 constant STRATEGY_SALT = 0x00000000000000000000000000000000000000000000000000000000000000d4;
    address constant EXPECTED_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY 4/4: CharmStrategyUSD1");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Vault:", VAULT_ADDRESS);
        console.log("Expected Address:", EXPECTED_STRATEGY);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Verify vault exists
        uint256 vaultCodeSize;
        assembly {
            vaultCodeSize := extcodesize(VAULT_ADDRESS)
        }
        require(vaultCodeSize > 0, "ERROR: Vault not deployed!");
        
        console.log("Vault verified: OK");
        console.log("");
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory bytecode = abi.encodePacked(
            type(CharmStrategyUSD1).creationCode,
            abi.encode(VAULT_ADDRESS, CHARM_VAULT, WLFI, USD1, UNISWAP_ROUTER, deployer)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), STRATEGY_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("STRATEGY DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Deployed:", deployed);
        console.log("Expected:", EXPECTED_STRATEGY);
        
        if (deployed == EXPECTED_STRATEGY) {
            console.log("Status: ADDRESS MATCH! [OK]");
        } else {
            console.log("Status: ADDRESS MISMATCH! [ERROR]");
        }
        
        console.log("");
        console.log("===============================================");
        console.log("ALL CONTRACTS DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("CRITICAL NEXT STEPS:");
        console.log("1. Verify all contracts on Etherscan");
        console.log("2. Transfer ownership to multisig:");
        console.log("   0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
        console.log("3. Test with small amounts (max 100 WLFI)");
        console.log("");
    }
}


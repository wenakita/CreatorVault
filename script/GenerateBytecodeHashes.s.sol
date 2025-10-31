// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title GenerateBytecodeHashes
 * @notice Generate init code hashes using Forge (for CREATE2 vanity address generation)
 */
contract GenerateBytecodeHashes is Script {
    // Mainnet addresses
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant USD1_PRICE_FEED = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    address constant WLFI_USD1_POOL = 0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // Placeholder addresses (will be replaced with vanity addresses later)
    address constant VAULT_PLACEHOLDER = 0x4792348B352E1118DDC252664c977477f30EA91E;
    address constant OFT_PLACEHOLDER = 0x4700000000000000000000000000000000Ea91e0;
    
    function run() external view {
        console.log("==============================================");
        console.log("GENERATING BYTECODE HASHES WITH FORGE");
        console.log("==============================================");
        console.log("");
        
        // Use deployer address from environment
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        console.log("Deployer (owner):", deployer);
        console.log("");
        
        // 1. EagleOVault
        console.log("1. EagleOVault");
        bytes memory vaultInitCode = abi.encodePacked(
            type(EagleOVault).creationCode,
            abi.encode(WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer)
        );
        bytes32 vaultHash = keccak256(vaultInitCode);
        console.log("   Init Code Hash:", vm.toString(vaultHash));
        console.log("");
        
        // 2. CharmStrategyUSD1
        console.log("2. CharmStrategyUSD1");
        bytes memory strategyInitCode = abi.encodePacked(
            type(CharmStrategyUSD1).creationCode,
            abi.encode(VAULT_PLACEHOLDER, CHARM_VAULT, WLFI, USD1, UNISWAP_ROUTER, deployer)
        );
        bytes32 strategyHash = keccak256(strategyInitCode);
        console.log("   Init Code Hash:", vm.toString(strategyHash));
        console.log("");
        
        // 3. EagleVaultWrapper
        console.log("3. EagleVaultWrapper");
        bytes memory wrapperInitCode = abi.encodePacked(
            type(EagleVaultWrapper).creationCode,
            abi.encode(VAULT_PLACEHOLDER, OFT_PLACEHOLDER, deployer, deployer)
        );
        bytes32 wrapperHash = keccak256(wrapperInitCode);
        console.log("   Init Code Hash:", vm.toString(wrapperHash));
        console.log("");
        
        // 4. EagleShareOFT
        console.log("4. EagleShareOFT");
        bytes memory oftInitCode = abi.encodePacked(
            type(EagleShareOFT).creationCode,
            abi.encode("Eagle Vault Shares", "EAGLE", LZ_ENDPOINT, deployer)
        );
        bytes32 oftHash = keccak256(oftInitCode);
        console.log("   Init Code Hash:", vm.toString(oftHash));
        console.log("");
        
        console.log("==============================================");
        console.log("COPY THESE HASHES TO bytecode-hashes-forge.json");
        console.log("==============================================");
        console.log("");
        console.log("Then run vanity generator with these hashes!");
    }
}


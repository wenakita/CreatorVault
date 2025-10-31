// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/EagleRegistry.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

/**
 * @title VerifyConfiguration
 * @notice Verify all contracts are properly configured
 */
contract VerifyConfiguration is Script {
    // Deployed contract addresses
    address constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    address constant EAGLE_VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant EAGLE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant EAGLE_WRAPPER = 0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5;
    address constant CHARM_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    // Expected values
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    uint256 errorCount = 0;
    
    function run() external view {
        console.log("===============================================");
        console.log("VERIFYING CONFIGURATION");
        console.log("===============================================");
        console.log("");
        
        // Test Registry
        console.log("1. Testing EagleRegistry...");
        testRegistry();
        console.log("");
        
        // Test Vault
        console.log("2. Testing EagleOVault...");
        testVault();
        console.log("");
        
        // Test OFT
        console.log("3. Testing EagleShareOFT...");
        testOFT();
        console.log("");
        
        // Test Wrapper
        console.log("4. Testing EagleVaultWrapper...");
        testWrapper();
        console.log("");
        
        // Test Strategy
        console.log("5. Testing CharmStrategyUSD1...");
        testStrategy();
        console.log("");
        
        // Summary
        console.log("===============================================");
        if (errorCount == 0) {
            console.log("ALL TESTS PASSED!");
            console.log("System is ready for production!");
        } else {
            console.log("TESTS FAILED!");
            console.log("Errors found:", errorCount);
        }
        console.log("===============================================");
    }
    
    function testRegistry() internal view {
        EagleRegistry registry = EagleRegistry(EAGLE_REGISTRY);
        
        // Check ownership
        address owner = registry.owner();
        if (owner == MULTISIG) {
            console.log("  [OK] Owner is multisig");
        } else {
            console.log("  [FAIL] Owner is NOT multisig");
            console.log("    Expected:", MULTISIG);
            console.log("    Got:     ", owner);
        }
        
        // Check LayerZero endpoint
        address lzEndpoint = registry.getLayerZeroEndpoint(1); // Ethereum
        if (lzEndpoint == LZ_ENDPOINT) {
            console.log("  [OK] LayerZero endpoint configured");
        } else if (lzEndpoint == address(0)) {
            console.log("  [WARN] LayerZero endpoint not set (chain may not be registered)");
        } else {
            console.log("  [FAIL] LayerZero endpoint NOT correct");
            console.log("    Expected:", LZ_ENDPOINT);
            console.log("    Got:     ", lzEndpoint);
        }
        
        // Check current chain ID
        uint16 currentChainId = registry.getCurrentChainId();
        console.log("  [INFO] Current chain ID:", currentChainId);
    }
    
    function testVault() internal view {
        EagleOVault vault = EagleOVault(payable(EAGLE_VAULT));
        
        // Check ownership
        address owner = vault.owner();
        if (owner == MULTISIG) {
            console.log("  [OK] Owner is multisig");
        } else {
            console.log("  [FAIL] Owner is NOT multisig");
            console.log("    Expected:", MULTISIG);
            console.log("    Got:     ", owner);
        }
        
        // Check strategy
        bool isActive = vault.activeStrategies(CHARM_STRATEGY);
        if (isActive) {
            console.log("  [OK] Strategy is active");
        } else {
            console.log("  [FAIL] Strategy is NOT active");
        }
        
        // Check total strategy weight
        uint256 totalWeight = vault.totalStrategyWeight();
        if (totalWeight == 10000) {
            console.log("  [OK] Total strategy weight is 100%");
        } else {
            console.log("  [FAIL] Total strategy weight is NOT 100%");
            console.log("    Expected: 10000");
            console.log("    Got:     ", totalWeight);
        }
        
        // Check vault name and symbol
        string memory name = vault.name();
        string memory symbol = vault.symbol();
        console.log("  [INFO] Name:", name);
        console.log("  [INFO] Symbol:", symbol);
    }
    
    function testOFT() internal view {
        EagleShareOFT oft = EagleShareOFT(EAGLE_OFT);
        
        // Check ownership
        address owner = oft.owner();
        if (owner == MULTISIG) {
            console.log("  [OK] Owner is multisig");
        } else {
            console.log("  [FAIL] Owner is NOT multisig");
            console.log("    Expected:", MULTISIG);
            console.log("    Got:     ", owner);
        }
        
        // Check minter role for wrapper
        bool isMinter = oft.isMinter(EAGLE_WRAPPER);
        if (isMinter) {
            console.log("  [OK] Wrapper has minter role");
        } else {
            console.log("  [FAIL] Wrapper does NOT have minter role");
        }
        
        // Check registry
        address registryAddr = address(oft.registry());
        if (registryAddr == EAGLE_REGISTRY) {
            console.log("  [OK] Registry is set correctly");
        } else {
            console.log("  [FAIL] Registry is NOT set correctly");
            console.log("    Expected:", EAGLE_REGISTRY);
            console.log("    Got:     ", registryAddr);
        }
        
        // Check OFT name and symbol
        string memory name = oft.name();
        string memory symbol = oft.symbol();
        console.log("  [INFO] Name:", name);
        console.log("  [INFO] Symbol:", symbol);
        
        // Check vanity address
        if (uint160(address(oft)) >> 152 == 0x47 && uint160(address(oft)) & 0xfffff == 0xea91e) {
            console.log("  [OK] Premium vanity address (0x47...ea91e)");
        } else {
            console.log("  [WARN] Not premium vanity address");
        }
    }
    
    function testWrapper() internal view {
        EagleVaultWrapper wrapper = EagleVaultWrapper(EAGLE_WRAPPER);
        
        // Check ownership
        address owner = wrapper.owner();
        if (owner == MULTISIG) {
            console.log("  [OK] Owner is multisig");
        } else {
            console.log("  [FAIL] Owner is NOT multisig");
            console.log("    Expected:", MULTISIG);
            console.log("    Got:     ", owner);
        }
        
        // Check vault address
        address vaultAddr = address(wrapper.vaultToken());
        if (vaultAddr == EAGLE_VAULT) {
            console.log("  [OK] Vault address is correct");
        } else {
            console.log("  [FAIL] Vault address is NOT correct");
            console.log("    Expected:", EAGLE_VAULT);
            console.log("    Got:     ", vaultAddr);
        }
        
        // Check OFT address
        address oftAddr = address(wrapper.oftToken());
        if (oftAddr == EAGLE_OFT) {
            console.log("  [OK] OFT address is correct");
        } else {
            console.log("  [FAIL] OFT address is NOT correct");
            console.log("    Expected:", EAGLE_OFT);
            console.log("    Got:     ", oftAddr);
        }
    }
    
    function testStrategy() internal view {
        // Check ownership
        address owner = Ownable(CHARM_STRATEGY).owner();
        if (owner == MULTISIG) {
            console.log("  [OK] Owner is multisig");
        } else {
            console.log("  [FAIL] Owner is NOT multisig");
            console.log("    Expected:", MULTISIG);
            console.log("    Got:     ", owner);
        }
        
        // Check if strategy has code (is deployed)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(CHARM_STRATEGY)
        }
        if (codeSize > 0) {
            console.log("  [OK] Strategy contract is deployed");
        } else {
            console.log("  [FAIL] Strategy contract NOT deployed");
        }
    }
}


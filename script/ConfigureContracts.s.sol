// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

/**
 * @title ConfigureContracts
 * @notice Configure all deployed contracts (WITHOUT ownership transfer)
 * 
 * CONFIGURATION STEPS:
 * 1. Set minter role on OFT (allow Wrapper to mint)
 * 2. Add Strategy to Vault
 */
contract ConfigureContracts is Script {
    // Deployed contract addresses
    address constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    address constant EAGLE_VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant EAGLE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant EAGLE_WRAPPER = 0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5;
    address constant CHARM_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    function run() external {
        console.log("===============================================");
        console.log("CONFIGURING CONTRACTS (NO OWNERSHIP TRANSFER)");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Configure OFT - Add Wrapper as minter
        console.log("Step 1: Configuring EagleShareOFT...");
        EagleShareOFT oft = EagleShareOFT(EAGLE_OFT);
        oft.setMinter(EAGLE_WRAPPER, true);
        console.log("  [OK] Wrapper added as minter");
        
        // Step 2: Configure Vault - Add Strategy (100% weight = 10000)
        console.log("");
        console.log("Step 2: Configuring EagleOVault...");
        EagleOVault vault = EagleOVault(payable(EAGLE_VAULT));
        vault.addStrategy(CHARM_STRATEGY, 10000); // 100% allocation
        console.log("  [OK] Strategy added to vault (100% weight)");
        
        // Step 3: Configure Wrapper - Already configured via constructor
        console.log("");
        console.log("Step 3: EagleVaultWrapper...");
        console.log("  [OK] Already configured (vault + OFT set in constructor)");
        
        // Step 4: Configure Strategy - Already configured via constructor
        console.log("");
        console.log("Step 4: CharmStrategyUSD1...");
        console.log("  [OK] Already configured (vault set in constructor)");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Contract Status:");
        console.log("  - Registry:  ", EAGLE_REGISTRY);
        console.log("  - Vault:     ", EAGLE_VAULT);
        console.log("  - OFT:       ", EAGLE_OFT);
        console.log("  - Wrapper:   ", EAGLE_WRAPPER);
        console.log("  - Strategy:  ", CHARM_STRATEGY);
        console.log("");
        console.log("All contracts are configured and ready for testing!");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Test deposits with small amounts");
        console.log("2. Verify all functions work correctly");
        console.log("3. Monitor for 24-48 hours");
        console.log("4. Transfer ownership to multisig when ready");
        console.log("");
    }
}


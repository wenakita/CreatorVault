// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

/**
 * @title ConfigureAll
 * @notice Configure all deployed contracts
 * 
 * CONFIGURATION STEPS:
 * 1. Set minter role on OFT (allow Wrapper to mint)
 * 2. Add Strategy to Vault
 * 3. Transfer ownership to multisig
 */
contract ConfigureAll is Script {
    // Deployed contract addresses
    address constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    address constant EAGLE_VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant EAGLE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant EAGLE_WRAPPER = 0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5;
    address constant CHARM_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    // Multisig address (final owner)
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external {
        console.log("===============================================");
        console.log("CONFIGURING ALL CONTRACTS");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Multisig:", MULTISIG);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Configure OFT - Add Wrapper as minter
        console.log("Step 1: Configuring EagleShareOFT...");
        EagleShareOFT oft = EagleShareOFT(EAGLE_OFT);
        oft.setMinter(EAGLE_WRAPPER, true);
        console.log("  - Wrapper added as minter");
        
        // Step 2: Configure Vault - Add Strategy (100% weight = 10000)
        console.log("");
        console.log("Step 2: Configuring EagleOVault...");
        EagleOVault vault = EagleOVault(payable(EAGLE_VAULT));
        vault.addStrategy(CHARM_STRATEGY, 10000); // 100% allocation
        console.log("  - Strategy added to vault (100% weight)");
        
        // Step 3: Configure Wrapper - Already configured via constructor
        console.log("");
        console.log("Step 3: EagleVaultWrapper...");
        console.log("  - Already configured (vault + OFT set in constructor)");
        
        // Step 4: Configure Strategy - Already configured via constructor
        console.log("");
        console.log("Step 4: CharmStrategyUSD1...");
        console.log("  - Already configured (vault set in constructor)");
        
        console.log("");
        console.log("===============================================");
        console.log("TRANSFERRING OWNERSHIP TO MULTISIG");
        console.log("===============================================");
        console.log("");
        
        // Transfer ownership of all contracts to multisig
        console.log("Transferring Registry ownership...");
        Ownable(EAGLE_REGISTRY).transferOwnership(MULTISIG);
        console.log("  - Registry ownership transferred");
        
        console.log("");
        console.log("Transferring Vault ownership...");
        vault.transferOwnership(MULTISIG);
        console.log("  - Vault ownership transferred");
        
        console.log("");
        console.log("Transferring OFT ownership...");
        oft.transferOwnership(MULTISIG);
        console.log("  - OFT ownership transferred");
        
        console.log("");
        console.log("Transferring Wrapper ownership...");
        Ownable(EAGLE_WRAPPER).transferOwnership(MULTISIG);
        console.log("  - Wrapper ownership transferred");
        
        console.log("");
        console.log("Transferring Strategy ownership...");
        Ownable(CHARM_STRATEGY).transferOwnership(MULTISIG);
        console.log("  - Strategy ownership transferred");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("All contracts configured and ownership transferred to:");
        console.log(MULTISIG);
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Test deposits with small amounts");
        console.log("2. Verify all functions work correctly");
        console.log("3. Monitor for 24-48 hours before larger deposits");
        console.log("");
    }
}


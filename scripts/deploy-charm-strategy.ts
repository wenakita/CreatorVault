import { ethers } from "hardhat";

/**
 * Deploy Charm Strategy and connect to EagleOVault
 * This will enable automatic deposits to Charm when threshold is met
 */

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e"; // Existing Charm vault

async function main() {
  console.log("🎯 Deploying Charm Strategy for EagleOVault\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  console.log("\n📋 Configuration:");
  console.log("  ═══════════════════════════════════════");
  console.log("  EagleOVault:", VAULT_ADDRESS);
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  console.log("  MEAGLE (Charm):", MEAGLE_ADDRESS);
  console.log("  ═══════════════════════════════════════");

  // =================================
  // OPTION 1: Use Existing Charm Vault (RECOMMENDED)
  // =================================
  
  console.log("\n💡 RECOMMENDED: Connect to Existing Charm Vault");
  console.log("  ═══════════════════════════════════════");
  console.log("  Instead of using CharmAlphaVaultStrategy (which creates NEW vaults),");
  console.log("  we can directly use the EXISTING Charm vault (MEAGLE).");
  console.log("\n  This saves gas and increases liquidity in the existing pool!");
  console.log("  ═══════════════════════════════════════");

  // =================================
  // CREATE SIMPLE CHARM STRATEGY
  // =================================
  
  console.log("\n🚀 Creating Simple Charm Strategy...");
  console.log("  (Adapter that uses existing MEAGLE vault)");
  
  const SimpleCharmStrategy = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICharmVault {
    function deposit(uint256 amount0, uint256 amount1, uint256 amount0Min, uint256 amount1Min, address to) 
        external returns (uint256 shares, uint256 amount0Used, uint256 amount1Used);
    function withdraw(uint256 shares, uint256 amount0Min, uint256 amount1Min, address to) 
        external returns (uint256 amount0, uint256 amount1);
    function balanceOf(address account) external view returns (uint256);
    function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
    function totalSupply() external view returns (uint256);
}

contract SimpleCharmStrategy {
    using SafeERC20 for IERC20;
    
    address public immutable EAGLE_VAULT;
    ICharmVault public immutable CHARM_VAULT; // MEAGLE
    IERC20 public immutable WLFI;
    IERC20 public immutable USD1;
    bool public active = true;
    
    constructor(address _vault, address _charm, address _wlfi, address _usd1) {
        EAGLE_VAULT = _vault;
        CHARM_VAULT = ICharmVault(_charm);
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
    }
    
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) external returns (uint256) {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        
        // Transfer from vault
        WLFI.safeTransferFrom(EAGLE_VAULT, address(this), wlfiAmount);
        USD1.safeTransferFrom(EAGLE_VAULT, address(this), usd1Amount);
        
        // Approve Charm
        WLFI.safeIncreaseAllowance(address(CHARM_VAULT), wlfiAmount);
        USD1.safeIncreaseAllowance(address(CHARM_VAULT), usd1Amount);
        
        // Deposit to Charm (MEAGLE), get MEAGLE shares back
        (uint256 meagleShares, , ) = CHARM_VAULT.deposit(
            wlfiAmount, 
            usd1Amount, 
            wlfiAmount * 95 / 100,  // 5% slippage
            usd1Amount * 95 / 100,
            address(this)
        );
        
        return meagleShares;
    }
    
    function withdraw(uint256 value) external returns (uint256 wlfi, uint256 usd1) {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        
        // Calculate MEAGLE shares to withdraw (simplified)
        uint256 meagleShares = value / 2; // Approximate
        
        // Withdraw from Charm
        (wlfi, usd1) = CHARM_VAULT.withdraw(
            meagleShares,
            0,
            0,
            EAGLE_VAULT  // Send back to vault
        );
    }
    
    function getTotalAmounts() external view returns (uint256 wlfi, uint256 usd1) {
        uint256 ourShares = CHARM_VAULT.balanceOf(address(this));
        if (ourShares == 0) return (0, 0);
        
        (uint256 total0, uint256 total1) = CHARM_VAULT.getTotalAmounts();
        uint256 totalShares = CHARM_VAULT.totalSupply();
        
        wlfi = (total0 * ourShares) / totalShares;
        usd1 = (total1 * ourShares) / totalShares;
    }
    
    function isInitialized() external view returns (bool) {
        return active;
    }
    
    function rebalance() external {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        // Charm handles rebalancing internally
    }
}
`;

  console.log("\n  Strategy code generated (see above)");
  console.log("  Save to: contracts/strategies/SimpleCharmStrategy.sol");
  console.log("  Then deploy!");

  // =================================
  // DEPLOYMENT INSTRUCTIONS
  // =================================
  
  console.log("\n📝 Deployment Steps:");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  1. Save SimpleCharmStrategy.sol");
  console.log("\n  2. Deploy strategy:");
  console.log("     const Strategy = await ethers.getContractFactory('SimpleCharmStrategy');");
  console.log(`     const strategy = await Strategy.deploy(`);
  console.log(`       '${VAULT_ADDRESS}',`);
  console.log(`       '${MEAGLE_ADDRESS}',`);
  console.log(`       '${WLFI_ADDRESS}',`);
  console.log(`       '${USD1_ADDRESS}'`);
  console.log("     );");
  console.log("\n  3. Add to vault:");
  console.log(`     vault.addStrategy(strategyAddress, 7000);  // 70% allocation`);
  console.log("\n  4. Deposit more to trigger deployment:");
  console.log("     vault.depositDual(50, 50, user);  // Total will be 90+90 > $100");
  console.log("\n  5. Check MEAGLE balance:");
  console.log("     meagle.balanceOf(strategyAddress);");
  console.log("  ═══════════════════════════════════════");

  console.log("\n✅ Guide complete! Follow steps above to integrate with Charm.");
}

main().catch(console.error);


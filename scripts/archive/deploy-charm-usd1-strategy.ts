import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying CharmStrategyUSD1 (Simplified!) ===\n');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const VAULT = '0xF87299c517116Df23EdD0DE485387a79AA2175A2';
  const CHARM_VAULT_USD1_WLFI = '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71'; // USD1/WLFI Charm vault
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('Eagle Vault:', VAULT);
  console.log('Charm Vault (USD1/WLFI):', CHARM_VAULT_USD1_WLFI);
  console.log('Strategy Type: Simplified (no WETH swaps!)\n');
  
  const CharmStrategyUSD1 = await ethers.getContractFactory('CharmStrategyUSD1');
  
  console.log('🚀 Deploying...');
  const strategy = await CharmStrategyUSD1.deploy(
    VAULT,
    CHARM_VAULT_USD1_WLFI,
    WLFI,
    USD1,
    deployer.address
  );
  
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  
  console.log('\n✅ CharmStrategyUSD1 deployed!');
  console.log('Address:', strategyAddress);
  
  // Verify
  const isActive = await strategy.active();
  const vault = await strategy.charmVault();
  
  console.log('\nVerification:');
  console.log('  Active:', isActive);
  console.log('  Charm Vault:', vault);
  console.log('  Owner:', await strategy.owner());
  
  console.log('\n💾 SAVE THIS ADDRESS:', strategyAddress);
  console.log('\nNext: Connect to Eagle vault and test!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


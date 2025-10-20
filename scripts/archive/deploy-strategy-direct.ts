import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying CharmStrategyUSD1 (No Vanity) ===\n');
  
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e';
  const CHARM_VAULT = '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address, '\n');
  
  const CharmStrategyUSD1 = await ethers.getContractFactory('CharmStrategyUSD1');
  
  console.log('🚀 Deploying CharmStrategyUSD1...');
  const strategy = await CharmStrategyUSD1.deploy(
    VAULT,
    CHARM_VAULT,
    USD1,
    WLFI,
    UNISWAP_ROUTER,
    { gasLimit: 5000000 }
  );
  
  const tx = strategy.deploymentTransaction();
  console.log('TX:', tx?.hash);
  console.log('Waiting...\n');
  
  // Wait and ignore Hardhat parsing error
  try {
    await strategy.waitForDeployment();
    const address = await strategy.getAddress();
    console.log('✅ DEPLOYED!');
    console.log('Address:', address);
  } catch (e: any) {
    console.log('Hardhat error (checking manually):', e.message.slice(0, 50));
    
    // Check if it actually deployed
    const receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
    if (receipt?.contractAddress) {
      console.log('\n✅ ACTUALLY DEPLOYED (Hardhat was wrong again!)');
      console.log('Address:', receipt.contractAddress);
    }
  }
}

main().catch(console.error);


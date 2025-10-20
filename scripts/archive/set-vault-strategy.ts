import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x1e6049cC14a484049392FEd9077c0931A71F8285';
  const STRATEGY = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e'; // CharmStrategyUSD1 VANITY
  
  console.log('=== Setting Vault Strategy ===\n');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY);
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Check current strategy
  const currentStrategy = await vault.currentStrategy();
  console.log('\nCurrent Strategy:', currentStrategy);
  
  if (currentStrategy.toLowerCase() === STRATEGY.toLowerCase()) {
    console.log('✅ Strategy already set!');
    return;
  }
  
  // Check ownership
  const owner = await vault.owner();
  const [signer] = await ethers.getSigners();
  console.log('\nVault Owner:', owner);
  console.log('Your Address:', signer.address);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log('❌ You are not the owner! Cannot set strategy.');
    return;
  }
  
  // Set the strategy
  console.log('\n🚀 Setting strategy...');
  const tx = await vault.setStrategy(STRATEGY, {
    gasLimit: 200000
  });
  
  console.log('Transaction:', tx.hash);
  console.log('Waiting for confirmation...');
  
  const receipt = await tx.wait();
  console.log('\n✅ Strategy set successfully!');
  console.log('Gas used:', receipt.gasUsed.toString());
  console.log('\nYou can now deposit into the vault! 🦅');
}

main().catch(console.error);


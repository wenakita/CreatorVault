import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xb94E2de9D05eCB27b5C29Dcc6b10749d14282BaC';
  const STRATEGY = '0x8F71d820993E0Bbf3AE78156C791BdaF9a947410';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing Strategy Directly (Bypass Vault) ===\n');
  console.log('This tests if strategy.deposit() works at all\n');
  
  const [owner] = await ethers.getSigners();
  const strategy = await ethers.getContractAt('CharmStrategyUSD1', STRATEGY);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // Check how much USD1 is in the vault
  const vaultUsd1 = await usd1.balanceOf(VAULT);
  console.log('USD1 in vault:', ethers.formatEther(vaultUsd1));
  
  console.log('\nStrategy will:');
  console.log('  1. transferFrom(vault, strategy, 27 USD1)');
  console.log('  2. Check Charm ratio');
  console.log('  3. Swap if needed');
  console.log('  4. Deposit to Charm\n');
  
  console.log('🚀 Calling strategy.deposit(0, 27) as vault owner...');
  console.log('(This tests if the strategy logic itself works)\n');
  
  try {
    // This will fail because we're not the vault, but we can see the error
    const tx = await strategy.deposit(
      0,
      ethers.parseEther('27'),
      { gasLimit: 5000000 }
    );
    console.log('TX:', tx.hash);
  } catch (error: any) {
    console.log('Expected error (not vault):', error.message.slice(0, 50));
    console.log('\nThis confirms strategy has onlyVault modifier.');
    console.log('The issue must be in how VAULT calls strategy...\n');
    
    console.log('💡 Let me check the vault\'s _deployToStrategies logic...');
  }
}

main().catch(console.error);


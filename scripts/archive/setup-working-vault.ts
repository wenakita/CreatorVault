import { ethers } from 'hardhat';

async function main() {
  console.log('=== Setting Up Working Vault ===\n');
  
  const VAULT = '0x1e6049cC14a484049392FEd9077c0931A71F8285';
  const STRATEGY = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e';
  const WEIGHT = 10000; // 100% to Charm
  
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY, '(Charm USD1/WLFI VANITY ✨)');
  console.log('Weight:', WEIGHT, '(100%)\n');
  
  const [deployer] = await ethers.getSigners();
  console.log('Your Address:', deployer.address);
  
  // Get vault (use old ABI that was actually deployed)
  const vaultABI = [
    'function owner() view returns (address)',
    'function addStrategy(address strategy, uint256 weight) external',
    'function activeStrategies(address) view returns (bool)',
    'function totalAssets() view returns (uint256)'
  ];
  
  const vault = new ethers.Contract(VAULT, vaultABI, deployer);
  
  try {
    const owner = await vault.owner();
    console.log('Vault Owner:', owner);
    console.log('You are owner:', owner.toLowerCase() === deployer.address.toLowerCase() ? 'YES ✅' : 'NO ❌\n');
    
    // Check if strategy already added
    const isActive = await vault.activeStrategies(STRATEGY);
    if (isActive) {
      console.log('✅ Strategy already connected!');
      console.log('\nYour vault is ready for deposits! 🦅');
      return;
    }
    
    console.log('🚀 Adding strategy...');
    const tx = await vault.addStrategy(STRATEGY, WEIGHT, {
      gasLimit: 300000
    });
    
    console.log('TX:', tx.hash);
    await tx.wait();
    
    console.log('\n✅ VAULT IS READY!');
    console.log('  ✅ Strategy connected');
    console.log('  ✅ Charm Finance enabled');
    console.log('  ✅ Ready for deposits! 🦅');
    
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
    
    if (error.message.includes('addStrategy is not a function')) {
      console.log('\n⚠️  The vault doesn\'t have addStrategy function.');
      console.log('We need to use the OPTIMIZED vault once it deploys.');
    }
  }
}

main().catch(console.error);


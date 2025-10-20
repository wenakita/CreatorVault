import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Final Vanity Vault ===\n');
  
  const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';  // Arachnid's public factory
  const SALT = '0x000000000000000000000000000000000000000000000000a400000002a45bb1';  // OPTIMIZED vault (with simplified TWAP)
  const EXPECTED_ADDRESS = '0x4792348b352e1118ddc252664c977477f30ea91e';  // Vanity: 0x47...ea91e ✅
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  
  console.log('🎯 Vanity Address:', EXPECTED_ADDRESS);
  console.log('Pattern: 0x47...ea91e ✅');
  console.log('Salt:', SALT);
  console.log('Factory:', FACTORY, '\n');
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const deployTx = await EagleOVault.getDeployTransaction(
    WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer.address
  );
  
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    FACTORY
  );
  
  console.log('🚀 Deploying via CREATE2...\n');
  
  const tx = await factory.deploy(deployTx.data, SALT, {
    gasLimit: 30000000, // 30M gas - block limit
  });
  console.log('TX sent:', tx.hash);
  console.log('Waiting...\n');
  
  const receipt = await tx.wait();
  
  if (receipt?.status === 0) {
    console.log('❌ Failed!');
    return;
  }
  
  console.log('🎉 VANITY VAULT DEPLOYED!');
  console.log('Address:', EXPECTED_ADDRESS);
  console.log('Cost:', ethers.formatEther(receipt!.gasPrice * receipt!.gasUsed), 'ETH');
  
  // Verify
  const vault = await ethers.getContractAt('EagleOVault', EXPECTED_ADDRESS);
  console.log('Owner:', await vault.owner());
  
  console.log('\n💾 SAVE THIS:', EXPECTED_ADDRESS);
}

main().catch(console.error);


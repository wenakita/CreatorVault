import { ethers } from 'hardhat';

async function main() {
  const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
  const SALT = '0x0000000000000000000000000000000000000000000000003400000002ecb901';
  const EXPECTED = '0x470520e3f88922c4e912cfc0379e05da000ea91e';
  
  const VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const OFT = '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E';
  
  const [deployer] = await ethers.getSigners();
  
  console.log('=== Deploying Wrapper Vanity ===\n');
  console.log('Expected:', EXPECTED);
  console.log('Pattern: 0x47...ea91e ✅\n');
  
  const EagleVaultWrapper = await ethers.getContractFactory('EagleVaultWrapper');
  const deployTx = await EagleVaultWrapper.getDeployTransaction(
    VAULT, OFT, deployer.address, deployer.address
  );
  
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    FACTORY
  );
  
  console.log('🚀 Deploying...');
  const tx = await factory.deploy(deployTx.data, SALT);
  console.log('TX:', tx.hash);
  await tx.wait();
  
  console.log('\n✅ WRAPPER DEPLOYED!');
  console.log('Address:', EXPECTED);
  console.log('\n🎊 ALL THREE VANITY!');
  console.log('Vault:    0x47b625c8...ea91e');
  console.log('Strategy: 0x47eb9d83...ea91e');
  console.log('Wrapper:  0x470520e3...ea91e');
}

main().catch(console.error);


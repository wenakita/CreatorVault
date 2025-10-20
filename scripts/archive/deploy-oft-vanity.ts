import { ethers } from 'hardhat';

async function main() {
  const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
  const SALT = '0x000000000000000000000000000000000000000000000000d5000000150d6888';
  const EXPECTED = '0x47972a305b7776a3012339977d8988dc770ea91e';
  
  const NAME = 'Eagle';
  const SYMBOL = 'EAGLE';
  const LZ_ENDPOINT = '0x1a44076050125825900e736c501f859c50fE728c';
  const REGISTRY = '0x25d91c67b66c8ea3a8c55f7b8be60ac4bbd4a3da';
  
  const [deployer] = await ethers.getSigners();
  
  const FEE_CONFIG = {
    buyFee: 0,
    sellFee: 200,
    treasuryShare: 5000,
    vaultShare: 5000,
    treasury: deployer.address,
    vaultBeneficiary: deployer.address,
    feesEnabled: true
  };
  
  console.log('=== Deploying OFT Vanity ===\n');
  console.log('Expected:', EXPECTED);
  console.log('Pattern: 0x47...ea91e ✅\n');
  
  const EagleShareOFT = await ethers.getContractFactory('EagleShareOFT');
  const deployTx = await EagleShareOFT.getDeployTransaction(
    NAME, SYMBOL, LZ_ENDPOINT, REGISTRY, deployer.address, FEE_CONFIG
  );
  
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    FACTORY
  );
  
  console.log('🚀 Deploying...');
  const tx = await factory.deploy(deployTx.data, SALT);
  console.log('TX:', tx.hash);
  await tx.wait();
  
  console.log('\n✅ OFT DEPLOYED!');
  console.log('Address:', EXPECTED);
  console.log('\n🎊 ALL FOUR VANITY!');
  console.log('Vault:    0x47b625c8...ea91e');
  console.log('Strategy: 0x47eb9d83...ea91e');
  console.log('Wrapper:  0x470520e3...ea91e');
  console.log('OFT:      0x47972a30...ea91e');
}

main().catch(console.error);


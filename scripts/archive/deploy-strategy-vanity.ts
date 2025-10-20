import { ethers } from 'hardhat';

async function main() {
  const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
  const SALT = '0x00000000000000000000000000000000000000000000000080000000013ed784';
  const EXPECTED = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e';
  
  const VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const CHARM_VAULT = '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  const [deployer] = await ethers.getSigners();
  
  console.log('=== Deploying CharmStrategyUSD1 Vanity ===\n');
  console.log('Expected:', EXPECTED);
  console.log('Pattern: 0x47...ea91e ✅\n');
  
  const CharmStrategyUSD1 = await ethers.getContractFactory('CharmStrategyUSD1');
  const deployTx = await CharmStrategyUSD1.getDeployTransaction(
    VAULT, CHARM_VAULT, WLFI, USD1, deployer.address
  );
  
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    FACTORY
  );
  
  console.log('🚀 Deploying...');
  const tx = await factory.deploy(deployTx.data, SALT);
  console.log('TX:', tx.hash);
  await tx.wait();
  
  console.log('\n✅ STRATEGY DEPLOYED!');
  console.log('Address:', EXPECTED);
  
  const strategy = await ethers.getContractAt('CharmStrategyUSD1', EXPECTED);
  console.log('Active:', await strategy.active());
  
  console.log('\n💾 SAVE:', EXPECTED);
}

main().catch(console.error);


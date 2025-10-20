import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const OFT = '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E';
  const FEE_RECIPIENT = deployer.address;
  
  const EagleVaultWrapper = await ethers.getContractFactory('EagleVaultWrapper');
  const deployTx = await EagleVaultWrapper.getDeployTransaction(
    VAULT,
    OFT,
    FEE_RECIPIENT,
    deployer.address
  );
  
  const initCodeHash = ethers.keccak256(deployTx.data);
  
  console.log('EagleVaultWrapper Bytecode Hash:');
  console.log(initCodeHash);
  console.log('\nUse this in Rust miner for wrapper vanity address!');
}

main().catch(console.error);


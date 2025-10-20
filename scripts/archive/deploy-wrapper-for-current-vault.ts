import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Wrapper for Current Vault ===\n');
  
  const [deployer] = await ethers.getSigners();
  
  const CURRENT_VAULT = '0x1e6049cC14a484049392FEd9077c0931A71F8285';
  const OFT = '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E';
  const FEE_RECIPIENT = deployer.address;
  
  console.log('Vault:', CURRENT_VAULT);
  console.log('OFT:', OFT);
  console.log('Fee Recipient:', FEE_RECIPIENT);
  
  const EagleVaultWrapper = await ethers.getContractFactory('EagleVaultWrapper');
  
  console.log('\n🚀 Deploying wrapper...');
  const wrapper = await EagleVaultWrapper.deploy(
    CURRENT_VAULT,
    OFT,
    FEE_RECIPIENT,
    deployer.address
  );
  
  await wrapper.waitForDeployment();
  const wrapperAddress = await wrapper.getAddress();
  
  console.log('\n✅ Wrapper deployed!');
  console.log('Address:', wrapperAddress);
  
  console.log('\n💾 Update frontend with:', wrapperAddress);
}

main().catch(console.error);


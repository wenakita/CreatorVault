import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying EagleVaultWrapper ===\n');
  
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e';
  const OFT = '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E';
  
  const [deployer] = await ethers.getSigners();
  const FEE_RECIPIENT = deployer.address; // Owner receives fees
  
  console.log('Deployer:', deployer.address);
  console.log('Vault:', VAULT);
  console.log('OFT:', OFT);
  console.log('Fee Recipient:', FEE_RECIPIENT);
  console.log('\n🚀 Deploying wrapper...\n');
  
  const EagleVaultWrapper = await ethers.getContractFactory('EagleVaultWrapper');
  const wrapper = await EagleVaultWrapper.deploy(
    VAULT, 
    OFT, 
    FEE_RECIPIENT, 
    deployer.address,
    { gasLimit: 2000000 }
  );
  
  const tx = wrapper.deploymentTransaction();
  console.log('TX:', tx?.hash);
  
  // Ignore Hardhat parsing error
  try {
    await wrapper.waitForDeployment();
    const address = await wrapper.getAddress();
    console.log('\n✅ DEPLOYED!');
    console.log('Address:', address);
  } catch (e: any) {
    console.log('Hardhat error (checking manually)...\n');
    const receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
    
    if (receipt?.status === 1 && receipt?.contractAddress) {
      console.log('✅ ACTUALLY DEPLOYED!');
      console.log('Address:', receipt.contractAddress);
      console.log('\n🎉 Wrapper is ready!');
      console.log('Users can now: vEAGLE → EAGLE (for trading/bridging)');
    } else {
      console.log('❌ Deployment failed');
      console.log('Status:', receipt?.status);
    }
  }
}

main().catch(console.error);


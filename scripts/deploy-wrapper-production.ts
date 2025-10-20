import { ethers } from 'hardhat';

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🚀 DEPLOYING WRAPPER FOR PRODUCTION VAULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const [deployer] = await ethers.getSigners();
  
  // Production addresses
  const VAULT = '0x32a2544De7a644833fE7659dF95e5bC16E698d99';  // EagleOVault (current production)
  const OFT = '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E';    // EagleShareOFT
  const FEE_RECIPIENT = deployer.address;                      // Send fees to deployer
  const OWNER = deployer.address;                              // Deployer owns wrapper
  
  console.log('📋 Configuration:');
  console.log('  Vault Address:    ', VAULT);
  console.log('  OFT Address:      ', OFT);
  console.log('  Fee Recipient:    ', FEE_RECIPIENT);
  console.log('  Owner:            ', OWNER);
  console.log('  Deployer:         ', deployer.address);
  
  // Check ETH balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('\n💰 ETH Balance:     ', ethers.formatEther(balance), 'ETH');
  
  if (balance < ethers.parseEther('0.003')) {
    console.log('⚠️  Warning: Low ETH balance. Need ~0.005 ETH for deployment\n');
  }
  
  console.log('\n🔨 Deploying EagleVaultWrapper...');
  
  const EagleVaultWrapper = await ethers.getContractFactory('EagleVaultWrapper');
  
  const wrapper = await EagleVaultWrapper.deploy(
    VAULT,
    OFT,
    FEE_RECIPIENT,
    OWNER,
    {
      gasLimit: 2000000 // Set explicit gas limit
    }
  );
  
  console.log('⏳ Waiting for deployment...');
  await wrapper.waitForDeployment();
  
  const wrapperAddress = await wrapper.getAddress();
  
  console.log('\n✅ Wrapper deployed successfully!');
  console.log('📍 Address:', wrapperAddress);
  console.log('🔗 Etherscan:', `https://etherscan.io/address/${wrapperAddress}`);
  
  // Verify configuration
  console.log('\n🔍 Verifying deployment...');
  const vaultEagle = await wrapper.VAULT_EAGLE();
  const oftEagle = await wrapper.OFT_EAGLE();
  const owner = await wrapper.owner();
  const depositFee = await wrapper.depositFee();
  const withdrawFee = await wrapper.withdrawFee();
  
  console.log('  Vault EAGLE:      ', vaultEagle, vaultEagle === VAULT ? '✅' : '❌');
  console.log('  OFT EAGLE:        ', oftEagle, oftEagle === OFT ? '✅' : '❌');
  console.log('  Owner:            ', owner, owner === OWNER ? '✅' : '❌');
  console.log('  Deposit Fee:      ', depositFee.toString(), 'basis points (1%)');
  console.log('  Withdraw Fee:     ', withdrawFee.toString(), 'basis points (2%)');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 DEPLOYMENT COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📝 Next Steps:\n');
  console.log('1. Update frontend configuration:');
  console.log(`   VITE_WRAPPER_ADDRESS=${wrapperAddress}`);
  console.log('');
  console.log('2. Update frontend/src/config/contracts.ts:');
  console.log(`   WRAPPER: '${wrapperAddress}',`);
  console.log('');
  console.log('3. Grant minter/burner role to wrapper on OFT:');
  console.log(`   OFT.grantRole(MINTER_ROLE, "${wrapperAddress}")`);
  console.log(`   OFT.grantRole(BURNER_ROLE, "${wrapperAddress}")`);
  console.log('');
  console.log('4. Test wrapping:');
  console.log('   - Approve vault shares to wrapper');
  console.log('   - Call wrapper.wrap(amount)');
  console.log('   - Verify OFT tokens received');
  console.log('');
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: 'ethereum',
    wrapper: wrapperAddress,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    configuration: {
      vault: VAULT,
      oft: OFT,
      feeRecipient: FEE_RECIPIENT,
      owner: OWNER,
      depositFee: depositFee.toString(),
      withdrawFee: withdrawFee.toString()
    }
  };
  
  try {
    fs.mkdirSync('deployments', { recursive: true });
    fs.writeFileSync(
      'deployments/wrapper-production.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log('💾 Deployment info saved to: deployments/wrapper-production.json\n');
  } catch (e) {
    console.log('⚠️  Could not save deployment info:', e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });


import { ethers } from 'hardhat';

async function main() {
  console.log('=== Debugging CREATE2 Factory ===\n');
  
  const FACTORY = '0xAA28020DDA6b954D16208eccF873D79AC6533833';
  
  // Check if factory exists
  const code = await ethers.provider.getCode(FACTORY);
  console.log('Factory:', FACTORY);
  console.log('Has code:', code !== '0x');
  console.log('Code length:', code.length);
  
  if (code === '0x') {
    console.log('\n❌ FACTORY DOES NOT EXIST!');
    console.log('   This address has no contract deployed');
    return;
  }
  
  console.log('\n✅ Factory exists\n');
  
  // Try to read factory functions
  const factory = await ethers.getContractAt(
    [
      'function deploy(bytes memory code, bytes32 salt) returns (address)',
      'function owner() external view returns (address)',
      'function computeAddress(bytes32 salt, bytes32 codeHash) external view returns (address)'
    ],
    FACTORY
  );
  
  try {
    const owner = await factory.owner();
    console.log('Factory owner:', owner);
  } catch (e: any) {
    console.log('⚠️  No owner() function or reverted');
  }
  
  // Test with our bytecode
  const SALT = '0x0000000000000000000000000000000000000000000000008480000000768713';
  const EXPECTED = '0x47cf4797a92f0cb43276f3a044b812cf640ea91e';
  
  const [deployer] = await ethers.getSigners();
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const deployTx = await EagleOVault.getDeployTransaction(
    '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
    '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
    '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d',
    '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d',
    '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    deployer.address
  );
  
  const initCode = deployTx.data;
  console.log('\nBytecode size:', initCode.length, 'bytes');
  console.log('Expected address:', EXPECTED);
  
  // Check if address already has code
  const existingCode = await ethers.provider.getCode(EXPECTED);
  if (existingCode !== '0x') {
    console.log('\n❌ ADDRESS ALREADY HAS A CONTRACT!');
    console.log('   Cannot deploy to:', EXPECTED);
    console.log('   This is why CREATE2 reverts');
    return;
  }
  
  console.log('\n✅ Address is available');
  
  // Try static call to see exact error
  console.log('\nTrying static call to factory.deploy...');
  try {
    await factory.deploy.staticCall(initCode, SALT);
    console.log('✅ Static call succeeded!');
    console.log('   The deployment SHOULD work');
  } catch (error: any) {
    console.log('❌ Static call failed:', error.message);
    
    if (error.data) {
      console.log('\nError data:', error.data);
      
      // Try to decode
      try {
        // Common CREATE2 errors
        if (error.data === '0xfb8f41b2') {
          console.log('\n💡 Error: CREATE2: Failed deployment');
          console.log('   Factory tried to deploy but something failed');
        } else if (error.data.startsWith('0x')) {
          console.log('\n💡 Custom error:', error.data);
        }
      } catch (e) {}
    }
    
    console.log('\n🔍 Possible reasons:');
    console.log('1. Factory has restrictions (ownership, etc.)');
    console.log('2. Bytecode too large for factory');
    console.log('3. Constructor reverts');
    console.log('4. Out of gas in factory context');
  }
}

main().catch(console.error);


import { ethers } from 'hardhat';

async function main() {
  console.log('=== Testing Minimal Contract Deployment ===\n');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const TestMinimal = await ethers.getContractFactory('TestMinimal');
  
  console.log('\n1️⃣ Testing DIRECT deployment...');
  const direct = await TestMinimal.deploy(deployer.address);
  await direct.waitForDeployment();
  const directAddr = await direct.getAddress();
  console.log('✅ Direct works:', directAddr);
  
  console.log('\n2️⃣ Testing CREATE2 deployment...');
  const deployTx = await TestMinimal.getDeployTransaction(deployer.address);
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    '0x4e59b44847b379578588920cA78FbF26c0B4956C'
  );
  
  const salt = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const tx = await factory.deploy(deployTx.data, salt, { gasLimit: 1000000 });
  console.log('TX:', tx.hash);
  const receipt = await tx.wait();
  
  if (receipt.status === 1) {
    console.log('✅ CREATE2 works!');
    console.log('\\nCONCLUSION: CREATE2 factory is fine.');
    console.log('The issue is SPECIFIC to EagleOVault constructor.');
  } else {
    console.log('❌ CREATE2 also fails');
  }
}

main().catch(console.error);


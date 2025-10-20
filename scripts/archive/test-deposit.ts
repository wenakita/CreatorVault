import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xe399A4976fFad9C1414dC71139a1A5cF46d44428';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing Deposit ===\n');
  
  const [user] = await ethers.getSigners();
  console.log('User:', user.address);
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  const balance = await usd1.balanceOf(user.address);
  console.log('USD1 Balance:', ethers.formatEther(balance), '\n');
  
  const amount = ethers.parseEther('27.188063957121806665');
  
  console.log('Attempting deposit of', ethers.formatEther(amount), 'USD1...\n');
  
  try {
    const tx = await vault.depositDual(0, amount, user.address, {
      gasLimit: 5000000
    });
    console.log('TX sent:', tx.hash);
    try { await tx.wait(); } catch (e) {}
    
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
    
    if (receipt?.status === 1) {
      console.log('\n🎉 DEPOSIT WORKED!');
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    if (error.data) {
      console.log('Error data:', error.data);
    }
  }
}

main().catch(console.error);


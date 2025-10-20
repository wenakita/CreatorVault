import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11'; // Latest vault with fixed order
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  
  console.log('=== Approve and Deposit Test ===\n');
  console.log('Vault:', VAULT, '\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  const wlfi = await ethers.getContractAt('IERC20', WLFI);
  
  // 1. Approve WLFI
  console.log('1️⃣ Approving WLFI to vault...');
  let tx = await wlfi.approve(VAULT, ethers.MaxUint256);
  try { await tx.wait(); } catch (e) {}
  console.log('✅ WLFI approved\n');
  
  // 2. Approve USD1
  console.log('2️⃣ Approving USD1 to vault...');
  tx = await usd1.approve(VAULT, ethers.MaxUint256);
  try { await tx.wait(); } catch (e) {}
  console.log('✅ USD1 approved\n');
  
  // 3. Get balances
  const [wlfiBal, usd1Bal] = await Promise.all([
    wlfi.balanceOf(user.address),
    usd1.balanceOf(user.address)
  ]);
  
  console.log('Your balances:');
  console.log('  WLFI:', ethers.formatEther(wlfiBal));
  console.log('  USD1:', ethers.formatEther(usd1Bal), '\n');
  
  // 4. Deposit
  console.log('3️⃣ Depositing...');
  tx = await vault.depositDual(wlfiBal, usd1Bal, user.address, { gasLimit: 2000000 });
  console.log('TX:', tx.hash);
  try { await tx.wait(); } catch (e) {}
  const r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r?.status === 1) {
    const shares = await vault.balanceOf(user.address);
    console.log('🎉 DEPOSIT WORKED!');
    console.log('Your shares:', ethers.formatEther(shares), 'vEAGLE\n');
    console.log('Now test manual Charm deployment!');
  }
}

main().catch(console.error);


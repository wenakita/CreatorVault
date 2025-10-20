import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xcd033522d822d8A127d04f1812a6Ba8C0DA798ae';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  
  console.log('=== Pre-Approving Vault → Strategy (As Owner) ===\n');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY, '\n');
  
  const [owner] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('Owner:', owner.address);
  console.log('\nThis will manually approve USD1/WLFI from vault to strategy');
  console.log('So _deployToStrategies() won\'t need to approve!\n');
  
  // Create approve calldata
  const usd1Interface = new ethers.Interface(['function approve(address,uint256) returns (bool)']);
  const wlfiInterface = new ethers.Interface(['function approve(address,uint256) returns (bool)']);
  
  const usd1Data = usd1Interface.encodeFunctionData('approve', [STRATEGY, ethers.MaxUint256]);
  const wlfiData = wlfiInterface.encodeFunctionData('approve', [STRATEGY, ethers.MaxUint256]);
  
  console.log('Method 1: Using vault\'s rescueToken to call approve');
  console.log('(This won\'t work - rescueToken is for ERC20 transfers)\n');
  
  console.log('Method 2: Deploy vault with pre-approved allowances in constructor');
  console.log('(Would need new vault)\n');
  
  console.log('Method 3: Modify vault to have setApproval() function');
  console.log('(Cleanest solution!)\n');
  
  console.log('💡 BEST SOLUTION:');
  console.log('Add a function to vault: approveStrategy(address token, address strategy, uint256 amount)');
  console.log('Owner calls it once, then _deployToStrategies() works!');
}

main().catch(console.error);


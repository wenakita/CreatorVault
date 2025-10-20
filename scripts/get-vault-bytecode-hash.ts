import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const deployTx = await EagleOVault.getDeployTransaction(
    WLFI,
    USD1,
    USD1_PRICE_FEED,
    WLFI_USD1_POOL,
    UNISWAP_ROUTER,
    deployer.address
  );
  
  const initCodeHash = ethers.keccak256(deployTx.data);
  
  console.log('Latest EagleOVault Bytecode Hash:');
  console.log(initCodeHash);
  console.log('\nUse this in the Rust vanity miner!');
}

main().catch(console.error);


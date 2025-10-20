import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const CHARM_VAULT = '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  const CharmStrategyUSD1 = await ethers.getContractFactory('CharmStrategyUSD1');
  const deployTx = await CharmStrategyUSD1.getDeployTransaction(
    VAULT,
    CHARM_VAULT,
    WLFI,
    USD1,
    deployer.address
  );
  
  const initCodeHash = ethers.keccak256(deployTx.data);
  
  console.log('CharmStrategyUSD1 Bytecode Hash:');
  console.log(initCodeHash);
  console.log('\nUse this in Rust miner for strategy vanity address!');
}

main().catch(console.error);


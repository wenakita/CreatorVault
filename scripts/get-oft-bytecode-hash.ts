import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const NAME = 'Eagle';
  const SYMBOL = 'EAGLE';
  const LZ_ENDPOINT = '0x1a44076050125825900e736c501f859c50fE728c'; // Ethereum LZ V2
  const REGISTRY = '0x25d91c67b66c8ea3a8c55f7b8be60ac4bbd4a3da'; // EagleRegistry (lowercase)
  const DELEGATE = deployer.address;
  const FEE_CONFIG = { 
    buyFee: 0,                      // No buy fee
    sellFee: 200,                   // 2% sell fee  
    treasuryShare: 5000,            // 50% to treasury
    vaultShare: 5000,               // 50% to vault
    treasury: deployer.address,     // Treasury address
    vaultBeneficiary: deployer.address, // Vault beneficiary
    feesEnabled: true               // Fees enabled
  };
  
  const EagleShareOFT = await ethers.getContractFactory('EagleShareOFT');
  const deployTx = await EagleShareOFT.getDeployTransaction(
    NAME,
    SYMBOL,
    LZ_ENDPOINT,
    REGISTRY,
    DELEGATE,
    FEE_CONFIG
  );
  
  const initCodeHash = ethers.keccak256(deployTx.data);
  
  console.log('EagleShareOFT Bytecode Hash:');
  console.log(initCodeHash);
  console.log('\nUse this in Rust miner for OFT vanity address!');
}

main().catch(console.error);


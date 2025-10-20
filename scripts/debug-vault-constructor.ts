import { ethers } from 'hardhat';

async function main() {
  console.log('=== Debugging Vault Constructor ===\n');
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  
  console.log('Step 1: Check all addresses are valid contracts\n');
  
  const checks = [
    ['WLFI', WLFI],
    ['USD1', USD1],
    ['USD1_PRICE_FEED', USD1_PRICE_FEED],
    ['WLFI_USD1_POOL', WLFI_USD1_POOL],
    ['UNISWAP_ROUTER', UNISWAP_ROUTER],
  ];
  
  for (const [name, address] of checks) {
    const code = await ethers.provider.getCode(address);
    console.log(`${name.padEnd(20)} ${address}  ${code !== '0x' ? '✅' : '❌'}`);
  }
  
  console.log('\nStep 2: Test ERC4626 initialization\n');
  
  // Try to create IERC20 interface for WLFI
  try {
    const wlfi = await ethers.getContractAt('IERC20', WLFI);
    const name = await wlfi.name();
    const symbol = await wlfi.symbol();
    const decimals = await wlfi.decimals();
    console.log('WLFI Token:', name, `(${symbol}), ${decimals} decimals ✅`);
  } catch (e: any) {
    console.log('❌ WLFI interface failed:', e.message);
  }
  
  console.log('\nStep 3: Check if WLFI_USD1_POOL is actually IUniswapV3Pool\n');
  
  try {
    const pool = await ethers.getContractAt('IUniswapV3Pool', WLFI_USD1_POOL);
    const slot0 = await pool.slot0();
    console.log('Pool slot0:', slot0.sqrtPriceX96.toString(), '✅');
    console.log('Pool is valid IUniswapV3Pool ✅');
  } catch (e: any) {
    console.log('❌ POOL interface failed:', e.message);
    console.log('\n⚠️  THIS IS THE ISSUE! Pool address might not be IUniswapV3Pool');
  }
  
  console.log('\nStep 4: Test USD1 Price Feed\n');
  
  try {
    const priceFeed = await ethers.getContractAt('AggregatorV3Interface', USD1_PRICE_FEED);
    const latestRound = await priceFeed.latestRoundData();
    console.log('USD1 Price:', ethers.formatUnits(latestRound.answer, 8), 'USD ✅');
  } catch (e: any) {
    console.log('❌ Price feed failed:', e.message);
  }
}

main().catch(console.error);


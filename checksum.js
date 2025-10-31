const { getAddress } = require('ethers');

const addresses = [
  '0x47c81c9a70ca7518d3b911bc8c8b11000e92f59e',
  '0x474ed38c256a7fa0f3b8c48496ce1102ab0ea91e',
  '0x47b3ef629d9cb8dfcf8a6c61058338f4e99d7953',
  '0x47dac5063c526dbc6f157093dd1d62d9de8891c5',
  '0x47b2659747d6a7e00c8251c3c3f7e92625a8cf6f'
];

console.log('Checksummed addresses:');
addresses.forEach((addr, i) => {
  const checksummed = getAddress(addr);
  const names = ['EagleRegistry', 'EagleShareOFT', 'EagleOVault', 'EagleVaultWrapper', 'CharmStrategyUSD1'];
  console.log(`${names[i]}: ${checksummed}`);
});

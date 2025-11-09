// Eagle Protocol Contracts - Ethereum Mainnet
export const CONTRACTS = {
  // Core Protocol Contracts
  VAULT: '0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953',       // EagleOVault
  OFT: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E',         // EagleShareOFT (EAGLE Token)
  WRAPPER: '0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5',     // EagleVaultWrapper
  STRATEGY: '0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f',    // CharmStrategyUSD1
  REGISTRY: '0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e',     // EagleRegistry
  
  // External Contracts
  CHARM_VAULT: '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71',   // Charm USD1/WLFI Vault
  UNISWAP_V3_POOL: '0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d', // Uniswap V3 1% Fee Tier USD1/WLFI Pool
  UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 SwapRouter
  UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
  
  // Token addresses
  EAGLE: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E',      // Eagle Token (EagleShareOFT)
  WLFI: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',       // World Liberty Financial
  USD1: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',       // USD1 Stablecoin
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',       // Wrapped ETH
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',       // USD Coin
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',       // Tether USD
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',        // Dai Stablecoin
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',       // Wrapped BTC
  
  // Governance
  MULTISIG: '0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3',   // Multisig (Owner)
} as const;

// Token metadata for UI
export const TOKENS = {
  VEAGLE: {
    address: '0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953', // Same as VAULT
    symbol: 'vEAGLE',
    name: 'Eagle Vault Shares',
    decimals: 18,
  },
  EAGLE: {
    address: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E', // Same as OFT
    symbol: 'EAGLE',
    name: 'Eagle',
    decimals: 18,
    isPremiumVanity: true,
  },
  WLFI: {
    address: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
    symbol: 'WLFI',
    name: 'World Liberty Financial',
    decimals: 18,
  },
  USD1: {
    address: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
    symbol: 'USD1',
    name: 'USD1',
    decimals: 18,
  },
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
  },
  WBTC: {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
  },
} as const;

export const CHAIN_ID = 1; // Ethereum mainnet
export const CHAIN_NAME = 'Ethereum';
export const EXPLORER_URL = 'https://etherscan.io';


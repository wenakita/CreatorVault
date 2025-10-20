// Deployed contract addresses on Ethereum (PRODUCTION - January 2025)
export const CONTRACTS = {
  VAULT: '0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58',       // EagleOVault (Latest deployment) ✅
  OFT: '0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E',         // EagleShareOFT ✅
  WRAPPER: '0x470520e3f88922c4e912cfc0379e05da000ea91e',     // EagleVaultWrapper (deploy pending)
  STRATEGY: '0x2bF32B2F5F077c7126f8F0289d05352F321f1D67',    // CharmStrategyUSD1 (Matched to vault) ✅
  CHARM_VAULT: '0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71', // Charm USD1/WLFI Vault
  
  // Token addresses (REAL tokens!)
  WLFI: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',  // Real World Liberty Financial
  USD1: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
} as const;

export const CHAIN_ID = 1; // Ethereum mainnet

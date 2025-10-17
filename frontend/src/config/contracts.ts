// Deployed contract addresses on Ethereum (v2 - October 17, 2025)
export const CONTRACTS = {
  VAULT: '0x9e6AFd836fF239e5Ab5fa60DB7c01080bDd964FB',       // v2 - Fixed oracle, 80k multiplier
  OFT: '0xa85287cEBc43e0ebb6CAF135A39079d97fE4d039',         // v2 - Connected to wrapper v2
  WRAPPER: '0xb0e07784c31a19354d420BdA23B6d91Cc250B53C',     // v2 - Connected to vault v2
  STRATEGY: '0x16C0F6696D7129468c455838632455200C1C4152',    // v2 - Connected to vault v2
  CHARM_VAULT: '0x3314e248F3F752Cd16939773D83bEb3a362F0AEF', // Your Charm Alpha Vault
  
  // Token addresses
  WLFI: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
  USD1: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
} as const;

export const CHAIN_ID = 1; // Ethereum mainnet

// v1 Contracts (deprecated - oracle bug)
export const CONTRACTS_V1 = {
  VAULT: '0xf7eDdA9959249D96773BB2858bE1011C7E424855',
  OFT: '0x05D8Fe8B549bC8F45615FDAc1BF77eE7F4033569',
  WRAPPER: '0xA3d9e8f0de77241267A9d162c535C2A69385792A',
  STRATEGY: '0xd548CbC1D0A8723838993a763f1ca20533ed0c12',
} as const;


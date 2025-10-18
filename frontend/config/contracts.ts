// Contract ABIs and Addresses for Eagle Vault V3 Vanity
// Network: Ethereum Mainnet

export const VAULT_ABI = [
  // Read Functions
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
  'function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1)',
  'function getCurrentPrices() external view returns (uint256 wlfiPriceUSD, uint256 usd1PriceUSD)',
  'function getWLFIPrice() public view returns (uint256 price)',
  'function getUSD1Price() public view returns (uint256 price)',
  'function calculateUSDValue(uint256 wlfiAmount, uint256 usd1Amount) public view returns (uint256 usdValue)',
  'function previewDepositDual(uint256 wlfiAmount, uint256 usd1Amount) external view returns (uint256 shares, uint256 usdValue)',
  'function paused() external view returns (bool)',
  'function wlfiBalance() external view returns (uint256)',
  'function usd1Balance() external view returns (uint256)',
  'function strategyList(uint256) external view returns (address)',
  'function activeStrategies(address) external view returns (bool)',
  'function strategyWeights(address) external view returns (uint256)',
  'function totalStrategyWeight() external view returns (uint256)',
  'function manager() external view returns (address)',
  'function twapInterval() external view returns (uint32)',
  'function maxPriceAge() external view returns (uint256)',
  
  // Write Functions
  'function depositDual(uint256 wlfiAmount, uint256 usd1Amount, address receiver) external returns (uint256 shares)',
  'function withdrawDual(uint256 shares, address receiver) external returns (uint256 wlfiAmount, uint256 usd1Amount)',
  'function deposit(uint256 assets, address receiver) public returns (uint256 shares)',
  
  // Events
  'event DualDeposit(address indexed user, uint256 wlfiAmount, uint256 usd1Amount, uint256 wlfiPriceUSD, uint256 usd1PriceUSD, uint256 totalUSDValue, uint256 shares)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
] as const;

export const ERC20_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
] as const;

export const STRATEGY_ABI = [
  'function getTotalAmounts() external view returns (uint256 wlfi, uint256 usd1)',
  'function isInitialized() external view returns (bool)'
] as const;

// Contract Addresses - Ethereum Mainnet (V3 Vanity - All 0x47...ea91e!)
export const ADDRESSES = {
  // Main vault contract (VANITY ADDRESS)
  VAULT: (import.meta.env.VITE_VAULT_ADDRESS || '0x47ff05aaf066f50baefdcfdcadf63d3762eea91e') as `0x${string}`,
  
  // Token contracts
  WLFI: (import.meta.env.VITE_WLFI_ADDRESS || '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6') as `0x${string}`,
  USD1: (import.meta.env.VITE_USD1_ADDRESS || '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d') as `0x${string}`,
  
  // Oracle contracts
  USD1_PRICE_FEED: (import.meta.env.VITE_USD1_PRICE_FEED || '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d') as `0x${string}`,
} as const;

// Chain configuration
export const SUPPORTED_CHAINS = {
  ETHEREUM: {
    id: 1,
    name: 'Ethereum',
    network: 'mainnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: { 
        http: [import.meta.env.VITE_ETHEREUM_RPC || 'https://eth.llamarpc.com'] 
      },
      public: { 
        http: ['https://eth.llamarpc.com'] 
      },
    },
    blockExplorers: {
      default: { 
        name: 'Etherscan', 
        url: 'https://etherscan.io' 
      },
    },
    contracts: {
      vault: ADDRESSES.VAULT,
      wlfi: ADDRESSES.WLFI,
      usd1: ADDRESSES.USD1,
    }
  },
} as const;

// Token Information
export const TOKENS = {
  WLFI: {
    address: ADDRESSES.WLFI,
    symbol: 'WLFI',
    name: 'World Liberty Financial Token',
    decimals: 18,
    logo: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreifvnbzrefx4pdd6mr653dmrgkz2bdcamrwdsl334f7ed75miosaxu',
  },
  USD1: {
    address: ADDRESSES.USD1,
    symbol: 'USD1',
    name: 'USD1 Stablecoin',
    decimals: 18,
    logo: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreic74no55hhm544qjraibffhrb4h7zldae5sfsyipvu6dvfyqubppy',
  },
  ETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logo: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreiagnmvgbx3g7prmcg57pu3safks7ut6j3okopfmji7h5pndz2zeqy',
  },
  EAGLE: {
    address: ADDRESSES.VAULT,
    symbol: 'EAGLE',
    name: 'Eagle Vault Shares',
    decimals: 18,
    logo: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy',
  },
} as const;

// Protocol Logos
export const PROTOCOL_LOGOS = {
  UNISWAP: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreichw4b4wxvinfu4dmkloxajj4mm7672k6q3nyqzvdnvogvlbbycfq',
  CHARM: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreid3difftzksqy3xlummzzobhk674ece35d7drmgo3ftt7wrix6dwu',
  LAYERZERO: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreidp4x62pp27pf6cdtddvas7e3d2cshozgzi3yhmr2whhcefo5anly',
  LAYERZERO_EMBLEM: 'https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreihml3nahd2duwdjg2ltoeixax2xdj2ldp5unnrjwntyicar74nwra',
} as const;

// Explorer URLs
export const getExplorerUrl = (type: 'address' | 'tx', value: string) => {
  const baseUrl = 'https://etherscan.io';
  return `${baseUrl}/${type}/${value}`;
};

// Format address for display
export const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Validate address
export const isValidAddress = (address: string): address is `0x${string}` => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

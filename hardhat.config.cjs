// Hardhat config as CommonJS
require('@nomicfoundation/hardhat-toolbox')
require('hardhat-deploy')
require('dotenv').config()

// LayerZero toolbox plugin
// The plugin supports both CommonJS (dist/index.js) and ESM (dist/index.mjs)
require('@layerzerolabs/toolbox-hardhat')

const accounts = []
if (process.env.PRIVATE_KEY) {
  accounts.push(process.env.PRIVATE_KEY)
}

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.22',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/omeyMm6mGtblMX7rCT-QTGQvTLFD4J9F',
      accounts,
      chainId: 1,
      eid: 30101,
      timeout: 120000,
    },
    bsc: {
      url: 'https://bsc-rpc.publicnode.com',
      accounts,
      chainId: 56,
    },
    arbitrum: {
      url: 'https://arbitrum-rpc.publicnode.com',
      accounts,
      chainId: 42161,
    },
    base: {
      url: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
      accounts,
      chainId: 8453,
      eid: 30184,
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts,
      chainId: 43114,
    },
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      accounts,
      chainId: 11155111,
      timeout: 60000,
    },
    'bsc-testnet': {
      url: process.env.RPC_URL_BSC_TESTNET || 'https://bsc-testnet-rpc.publicnode.com',
      accounts,
      chainId: 97,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
    customChains: []
  },
  sourcify: {
    enabled: true
  }
}


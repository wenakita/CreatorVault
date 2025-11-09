# Eagle Vault - Single-Sided Liquidity Protocol

A sophisticated DeFi application for managing single-sided liquidity positions on Uniswap V3, built for the Eagle token on Ethereum mainnet.

## Overview

Eagle Vault allows users to provide single-sided liquidity to Uniswap V3 pools, eliminating impermanent loss concerns while maximizing capital efficiency. The protocol leverages ERC-4626 vault standards and integrates with LayerZero for cross-chain functionality.

## Features

- **Single-Sided Liquidity**: Deposit only one token instead of paired assets
- **Automated Position Management**: Smart rebalancing of liquidity positions
- **ERC-4626 Vaults**: Standard vault interface for maximum composability
- **Uniswap V3 Integration**: Concentrated liquidity with optimal fee tiers
- **3D Visualization**: Real-time portfolio visualization using Three.js
- **Cross-Chain Ready**: LayerZero integration for omnichain operations

## Technology Stack

- **Frontend**: React, TypeScript, Vite
- **Web3**: ethers.js, viem, Dynamic Labs
- **UI**: Tailwind CSS, Radix UI, PrimeReact
- **3D Graphics**: Three.js, React Three Fiber
- **State Management**: Redux Toolkit, Jotai
- **Data**: The Graph (Uniswap subgraphs)

## Contract Addresses (Ethereum Mainnet)

- **Eagle Vault**: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Eagle Token**: `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E`
- **Vault Wrapper**: `0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5`
- **Registry**: `0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e`

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/eagle-vault-app.git
cd eagle-vault-app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your API keys
# - VITE_DYNAMIC_ENVIRONMENT_ID
# - VITE_GRAPH_API_KEY
# - VITE_ALCHEMY_API_KEY (optional)

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Configuration

See `.env.example` for required environment variables.

Key configurations:
- Dynamic Labs for wallet connection
- The Graph API for Uniswap data
- Alchemy RPC for reliable blockchain access

## Project Structure

```
src/
├── components/     # React components
│   ├── dashboard/  # Main dashboard views
│   ├── layout/     # Layout components
│   └── utilities/  # Utility components
├── config/         # Contract addresses and configuration
├── utils/          # Utility functions and helpers
├── store/          # Redux store configuration
└── types/          # TypeScript type definitions
```

## Documentation

For detailed documentation about the Eagle protocol:
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [Deployment Guide](../CREATE2_DEPLOYMENT_GUIDE.md)
- [Contract Documentation](../contracts/)

## License

MIT

## Support

For questions and support, please open an issue or contact the team.

---

**Note**: This is experimental software. Use at your own risk.

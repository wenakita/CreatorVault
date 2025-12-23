# CreatorVault Frontend

Modern frontend for CreatorVault - an omnichain yield aggregator for creator tokens with LayerZero cross-chain capabilities.

## Features

- **Vault Management** - Deposit creator tokens, withdraw at any time
- **Cross-Chain Bridge** - Send tokens across chains via LayerZero
- **Real-Time Analytics** - Live APY, TVL, and performance metrics
- **Multi-Wallet Support** - MetaMask, WalletConnect, Safe App integration
- **Responsive Design** - Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build

```bash
npm run build
```

Output in `dist/` folder.

## Project Structure

```
frontend/
├── abis/                 # Contract ABIs
├── api/                  # API routes (Vercel)
├── config/               # Configuration
│   └── contracts.ts      # Contract addresses & chain config
├── lib/                  # Utilities
└── index.html
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `VITE_WALLETCONNECT_PROJECT_ID` - Get from [WalletConnect Cloud](https://cloud.walletconnect.com)
- `VITE_BASE_RPC` - Base mainnet RPC URL

### Contract Addresses

Update `config/contracts.ts` with deployed contract addresses.

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Fast build tool
- **Wagmi** + **RainbowKit** - Wallet integration
- **Ethers.js v6** - Ethereum interactions
- **Tailwind CSS** - Styling

## Deployment

### Vercel

```bash
npm run build
# Deploy via Vercel CLI or GitHub integration
```

### Other Platforms

```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

## License

MIT

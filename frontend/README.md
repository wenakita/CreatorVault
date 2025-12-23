# CreatorVault

Turn creator coins into earnings. Built on Base.

Launch vaults. Reward holders. Win jackpots. All onchain.

## What It Does

- **Launch Vaults** - One transaction deploys your vault
- **Cross-Chain** - Works on Base + Solana via bridge
- **Earn From Trades** - 6.9% fee: 90% to holders, 5% burned, 5% protocol
- **Verifiable Randomness** - Chainlink VRF for fair winner selection
- **Mobile-First** - Built for [Base App](https://docs.base.org/mini-apps)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your CDP API key

# Run development server
npm run dev
```

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Fast builds
- **Wagmi v2** + **viem** - Wallet integration
- **OnchainKit** - Coinbase components
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations

## Project Structure

```
frontend/
├── public/
│   └── manifest.json    # Base Mini App manifest
├── src/
│   ├── components/      # UI components
│   ├── config/          # Contract addresses, wagmi config
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Route pages
│   └── main.tsx         # Entry point
├── abis/                # Contract ABIs
└── api/                 # Vercel API routes
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with features |
| `/launch` | One-click vault launcher |
| `/dashboard` | Browse all creator vaults |
| `/vault/:address` | Deposit/withdraw from vault |

## Deployed Contracts (Base)

| Contract | Address |
|----------|---------|
| Registry | `0x777e28d7617ADb6E2fE7b7C49864A173e36881EF` |
| Factory | `0x6205c91941A207A622fD00481b92cA04308a2819` |
| LotteryManager | `0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD` |
| VaultActivator | `0x1bf02C90B226C028720D25dE535b345e5FfB9743` |

## Mini App Integration

This app follows [Base Mini App guidelines](https://docs.base.org/mini-apps/quickstart/building-for-the-base-app):

1. **Manifest** - `public/manifest.json` with Mini App config
2. **Mobile-First** - Responsive design with bottom nav
3. **Simple Flow** - Focus on one action: launch vault
4. **Low Friction** - Coinbase Smart Wallet for gasless txs

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel deploy
```

### Manual

```bash
npm run build
# Deploy dist/ folder
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CDP_API_KEY` | Yes | Coinbase Developer Platform API key |
| `VITE_BASE_RPC` | No | Custom Base RPC (default: public) |

## License

MIT - AKITA, LLC

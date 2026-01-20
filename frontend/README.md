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
cp .env.example .env
# Edit .env with your CDP API key

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
  public/
    manifest.json        # Base Mini App manifest
  src/
    components/          # UI components
    config/              # Contract addresses, wagmi config
    hooks/               # Custom React hooks
    pages/               # Route pages
    main.tsx             # Entry point
  abis/                  # Contract ABIs
  api/                   # Vercel API routes
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with features |
| `/deploy` | Deploy + activate vault (canonical) |
| `/waitlist` | Collect emails for early access |
| `/dashboard` | Browse all creator vaults |
| `/vault/:address` | Deposit/withdraw from vault |
| `/launch` | Redirects to `/deploy` (legacy) |

## Deployed Contracts (Base)

Base mainnet defaults live in `frontend/src/config/contracts.defaults.ts` (and are used by both the SPA and Vercel functions).

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

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `VITE_CDP_API_KEY` | Yes | client | Coinbase Developer Platform API key (public key / key id) |
| `VITE_CDP_PAYMASTER_URL` | Recommended | client | Paymaster/bundler endpoint override (set to `/api/paymaster` to use same-origin proxy) |
| `CDP_PAYMASTER_URL` | Recommended (prod) | server | Real CDP paymaster/bundler endpoint used by `/api/paymaster` (keep secret) |
| `VITE_ZORA_PUBLIC_API_KEY` | Recommended | client | Zora public key (restrict allowed origins) |
| `ZORA_SERVER_API_KEY` | Recommended | server | Zora server key for Vercel Functions |
| `VITE_BASE_RPC` | No | client | Base RPC used by the browser (default: public) |
| `BASE_RPC_URL` | No | server | Base RPC used by Vercel Functions (defaults to `https://mainnet.base.org`) |
| `DATABASE_URL` | Optional | server | Postgres connection string for local dev |
| `AUTH_SESSION_SECRET` | Recommended | server | SIWE session secret (stable in production) |
| `CREATOR_ACCESS_ADMIN_ADDRESSES` | Optional | server | Admin wallets allowed to approve/deny creator access |
| `CREATOR_ALLOWLIST` | Optional | server | Legacy fallback allowlist (env-based, only used if DB is not configured) |
| `PRIVY_APP_ID` | Optional | server | Privy App ID (server-side). Used by `/api/waitlist` when enabled |
| `PRIVY_APP_SECRET` | Optional | server | Privy App Secret (server-side). Used by `/api/waitlist` when enabled |
| `PRIVY_WAITLIST_PREGENERATE` | Optional | server | If true, `/api/waitlist` creates/fetches a Privy user and pregenerates an embedded Ethereum wallet |

## Waitlist (DB)

The waitlist API stores signups in Postgres. Create the table once:

```sql
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  primary_wallet TEXT NULL,
  privy_user_id TEXT NULL,
  embedded_wallet TEXT NULL,
  persona TEXT NULL,
  has_creator_coin BOOLEAN NULL,
  farcaster_fid BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Admin: approve creator access

- Approvals are managed at `/admin/creator-access`.
- Requests are submitted from `/deploy`.
- Admin access is controlled by `CREATOR_ACCESS_ADMIN_ADDRESSES` (comma/space separated).

## License

MIT - AKITA, LLC

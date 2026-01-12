# Strategy Deployment Checklist (Base → Multichain)

## Prereqs
- Deployed/unlocked tokens (creator coin + paired token)
- Uniswap V4 Pool + Position Manager addresses
- Ajna factory + collateral token decided
- Privileged deployer with gas on target chain

## Deploy
1) Deploy strategy contracts
- `CreatorLPManager` (ws token V4)
- `ConcentratedStrategy`
- `LimitOrderStrategy`
- `FullRangeStrategy`
- `AjnaStrategy` (creator coin as quote)

2) Configure V4 dependencies
- Call `configurePool` on LPManager with pool + position manager
- Configure strategies: `configurePool` / `setRebalanceParameters` where applicable

3) Wire addresses
- Set env vars for frontend (`frontend/.env`):
  - `VITE_V4_POOL_MANAGER`, `VITE_V4_TAX_HOOK`, `VITE_V4_POSITION_MANAGER`, `VITE_PERMIT2`, etc.
- Update `frontend/src/config/contracts.ts` if new defaults are permanent

4) Safety checks (on-chain)
- Rebalance guards: `period`, `minTickMove`, `maxTwapDeviation`, `tickSpacing`
- Managers: set `isManager`/`lpManager` addresses
- Fee recipient / treasury set

5) Tests (before mainnet)
- Foundry: `forge test -vvv test/LPStrategiesGuards.t.sol`
- Existing suite: `forge test`

6) Rollout
- Update frontend envs on Vercel
- Smoke test: deposit/withdraw per strategy on staging
- Promote to production

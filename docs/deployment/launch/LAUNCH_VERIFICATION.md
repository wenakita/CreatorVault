# 🚀 AKITA VAULT LAUNCH VERIFICATION (Base)

## Phase 0: Pre-launch (required)
### Strategy configuration (admin)
Before launching, ensure the vault has yield strategies configured (this is **management-only**):
- Deploy strategies via `/admin/deploy-strategies` (uses `StrategyDeploymentBatcher`)
- Set weights:
  - Charm (AKITA/USDC): **6900**
  - Ajna: **2139**
- Set idle reserve:
  - `minimumTotalIdle = 4,805,000 * 1e18` (9.61% of the 50M launch deposit)

### On-chain checks
- `vault.getStrategyCount()` → **2**
- `vault.strategyWeights(charmStrategy)` → **6900**
- `vault.strategyWeights(ajnaStrategy)` → **2139**
- `vault.minimumTotalIdle()` → **4_805_000e18**

## Phase 1: Launch (Day 0)
### What happens
Users launch via the frontend AA flow (`LaunchVaultAA`), which calls the on-chain `VaultActivationBatcher`:
1. `approve(AKITA, VaultActivationBatcher, 50M)`
2. `VaultActivationBatcher.batchActivate(...)`:
   - deposits AKITA into the vault (mints ▢AKITA shares to the batcher)
   - wraps shares to ■AKITA
   - launches the CCA auction with **25M ■AKITA**
   - transfers the remaining **25M ■AKITA** back to the user

### Important note: strategy deployment timing
Activation **does not** call `vault.deployToStrategies()`.
Yield deployment happens when a keeper/owner/management calls `vault.deployToStrategies()` (or `vault.tend()`).

## Phase 2: Auction (Days 0–7)
- Users bid ETH for ■AKITA via the auction UI
- Auction runs until it is **graduated**

## Phase 3: Post-auction completion (Day 7+)
Completion is a **2-step** process reflected in `CompleteAuction.tsx`:
1. **Sweep**: call `CCALaunchStrategy.sweepCurrency()` (permissionless)
   - sweeps raised ETH
   - configures the oracle’s V4 pool reference if configured
2. **Configure hook**: call `TaxHook.setTaxConfig(...)` (**token owner required**)
   - enables the 6.9% tax hook for ■AKITA/ETH trades

Optional (operations):
- Call `vault.deployToStrategies()` after launch to deploy idle AKITA into strategies.

---

## Alternative: Liquidity Launcher-style migration (v4 pool + position at final CCA price)

If using `LBPStrategyWithTaxHook` (`contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol`) instead of `CCALaunchStrategy`:

- **Auction creation** still uses Uniswap CCA, but the **strategy** is the `fundsRecipient` (via `ActionConstants.MSG_SENDER`), so raised currency must be swept to the strategy address.
- **Pool creation + LP minting** happens when calling `LBPStrategyWithTaxHook.migrate()` after `migrationBlock`.
- The pool is initialized with the **existing Base tax hook address** (PoolKey.hooks), so ensure you configure taxes using a poolId computed from the real v4 `PoolKey`.

Operationally:
1. After auction end, call `auction.sweepCurrency()` (permissionless) to move funds to the LBP strategy.
2. After `migrationBlock`, call `LBPStrategyWithTaxHook.migrate()` to initialize the v4 pool at the final clearing price and mint the position.
3. Configure taxes via `TaxHookConfigurator.configureCreatorPool(...)` using the correct `(poolLPFee, tickSpacing)` so the pool id matches.

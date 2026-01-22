# 🚨 PRE-LAUNCH VERIFICATION (Base)

This checklist is the **source of truth** for launching the AKITA vault on Base with the current contracts + frontend.

## 1) Contract addresses (must match reality)
Verify `frontend/src/config/contracts.ts` is correct for:
- `AKITA.token`
- `AKITA.vault`
- `AKITA.wrapper`
- `AKITA.shareOFT`
- `AKITA.gaugeController`
- `AKITA.ccaStrategy`
- `AKITA.oracle`
- `CONTRACTS.vaultActivationBatcher`
- `CONTRACTS.strategyDeploymentBatcher` (required for `/admin/deploy-strategies`)
- `CONTRACTS.poolManager` (Uniswap V4 PoolManager)
- `CONTRACTS.taxHook` (V4 tax hook)

## 2) Symbol grammar (blocking)
Confirm on-chain metadata matches the new standard:
- Vault shares: **▢AKITA**
- Wrapped share token (ShareOFT): **■AKITA**

## 3) Strategy deployment + configuration (required before launch)
The launch flow **does not** create strategies. Strategies must be deployed and added **before** the 50M deposit.

### Use the admin UI (recommended)
- Route: `/admin/deploy-strategies`
- Requires vault **management** permissions (it calls `addStrategy` / `setMinimumTotalIdle`)

### Required parameters (AKITA defaults)
- **Strategy weights**
  - Charm (AKITA/USDC): `6900`
  - Ajna: `2139`
- **Idle reserve**
  - `minimumTotalIdle = 4,805,000 * 1e18` (9.61% of the 50M launch deposit)

### On-chain verification
- `vault.getStrategyCount()` → **2**
- `vault.strategyWeights(charmStrategy)` → **6900**
- `vault.strategyWeights(ajnaStrategy)` → **2139**
- `vault.minimumTotalIdle()` → **4_805_000e18**

## 4) Activation flow (AA-safe, ERC-4626-safe)
Activation uses the on-chain `VaultActivationBatcher` (via the `LaunchVaultAA` frontend component).

Why this matters:
- The vault uses ERC-4626 virtual shares / offsets.
- You **cannot** safely hardcode `wrap(depositAmount)` client-side, because the number of shares minted can differ from assets.
- The batcher correctly uses the **returned share amount** from `deposit()` and wraps that.

What the user does:
1. Approve AKITA to `VaultActivationBatcher`
2. Call `VaultActivationBatcher.batchActivate(...)` (batched in AA when supported)

## 5) Post-activation yield deployment (ops)
Activation does **not** call `vault.deployToStrategies()`.
After launch, a keeper/owner/management should call:
- `vault.deployToStrategies()` (or `vault.tend()`)

## 6) Day-7+ completion (must be executed)
After the auction is graduated:
1. Call `CCALaunchStrategy.sweepCurrency()` (permissionless)
2. Configure the tax hook via `TaxHook.setTaxConfig(...)` (**token owner required**)

The frontend `CompleteAuction.tsx` implements this flow.

---

## 6b) If using `LBPStrategyWithTaxHook` (Liquidity Launcher-style)

If you switch to the `LBPStrategyWithTaxHook` path (auction + `migrate()` into v4), the completion flow changes:
- Raised currency must be swept from the **auction** to the strategy (call `auction.sweepCurrency()`).
- Liquidity is migrated into v4 by calling `LBPStrategyWithTaxHook.migrate()` after `migrationBlock`.
- Tax hook configuration should use a pool id derived from the exact v4 `PoolKey` (fee/tickSpacing/hooks), via `TaxHookConfigurator`.

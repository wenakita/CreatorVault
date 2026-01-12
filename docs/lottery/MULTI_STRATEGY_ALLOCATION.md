# Multi-Strategy Vault Allocation

## Summary
- A `CreatorOVault` holds the underlying Creator Coin (e.g., AKITA) and can deploy idle assets into yield strategies.
- Strategies are **configured by management** via:
  - `vault.addStrategy(strategy, weightBps)`
  - `vault.setMinimumTotalIdle(minIdleAssets)`
- Yield deployment happens when a **keeper/owner/management** calls:
  - `vault.deployToStrategies()`
- Auction activation is separate and is executed via the on-chain `VaultActivationBatcher` (deposit → wrap → launch auction). It does **not** create or configure strategies.

## AKITA default allocation (example: 50,000,000 AKITA deposit)
Target allocation:
- **69.00%** → Charm LP (AKITA/USDC) via `CreatorCharmStrategyV2`
- **21.39%** → Ajna via `AjnaStrategy`
- **9.61%** → idle reserve in the vault (`minimumTotalIdle`)

## How the vault deploys (current on-chain math)
When `vault.deployToStrategies()` runs, the vault computes:
- `deployable = coinBalance - max(minimumTotalIdle, deploymentThreshold)`
- then allocates `deployable` **proportionally across active strategies** by their configured weights:
  - `amount_i = deployable * weight_i / totalStrategyWeight`

## Parameterization to hit 69% / 21.39% / 9.61% on a 50M deposit
Set:
- `charmWeightBps = 6900`
- `ajnaWeightBps = 2139`
- `minimumTotalIdle = 4,805,000 * 1e18` (9.61% of 50,000,000)

Math:
- `deployable = 50,000,000 - 4,805,000 = 45,195,000`
- `totalStrategyWeight = 6900 + 2139 = 9039`
- `Charm = 45,195,000 * (6900 / 9039) = 34,500,000`
- `Ajna  = 45,195,000 * (2139 / 9039) = 10,695,000`
- `Idle  = 4,805,000`

## Operational steps (Base)
1) **Deploy + configure strategies (admin)**
- Use the frontend route: `/admin/deploy-strategies`
- This requires vault **management** permissions (because it calls `addStrategy` / `setMinimumTotalIdle`).

2) **Launch auction (user)**
- Use `ActivateAkita` / `LaunchVaultAA` (AA-friendly) which calls `VaultActivationBatcher.batchActivate(...)`.

3) **Deploy idle assets to strategies (keeper)**
- Call `vault.deployToStrategies()`.

4) **Verify on-chain**
- `vault.getStrategyCount()`
- `vault.minimumTotalIdle()`
- `vault.strategyDebt(strategy)`

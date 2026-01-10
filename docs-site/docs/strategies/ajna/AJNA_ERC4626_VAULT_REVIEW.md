# Ajna “ERC‑4626 Ajna Vault” Review (and how it maps to CreatorVault)

Ajna published an ERC‑4626 wrapper vault design here:
- `https://github.com/ajna-finance/4626-ajna-vault`

Ajna’s core protocol design is explained in their whitepaper:
- `https://www.ajna.finance/pdf/Ajna_Protocol_Whitepaper_10-12-2023.pdf`

## What their vault does (high level)

Ajna’s vault is an **ERC‑4626** vault where the **asset = Ajna pool quote token**.

- Deposits/mints:
  - take quote tokens from the user
  - apply optional deposit fee + deposit cap
  - deposit into a **Buffer** (reserve)
  - keepers then move liquidity from buffer → Ajna buckets for yield

- Withdraws/redeems:
  - **withdraw from the Buffer only**
  - if Buffer can’t satisfy, withdraw **reverts**
  - keepers must rebalance to maintain buffer liquidity

It also centralizes roles/config in a `VaultAuth` (admin/keepers/swapper), and provides keeper ops to move between buckets/buffer.

## License note (important)

At the time of review, `ajna-finance/4626-ajna-vault` files are marked:
- `LicenseRef-SkyAlpha-Proprietary`

So we should treat it as a **reference design**, not code we vendor/copy into CreatorVault, unless/until licensing allows.

## How this compares to our current Ajna integration

### Current strategy in CreatorVault
- **Contract**: `contracts/strategies/AjnaStrategy.sol`
- **Role**: `CreatorOVault` strategy (`IStrategy`)
- **Behavior**: deposits creator coin directly into an Ajna pool bucket (`addQuoteToken` / `removeQuoteToken`)

### Key gap vs the 4626 pattern
Ajna’s ERC‑4626 vault introduces an explicit **liquidity buffer** concept and accepts that **withdrawals can revert** when liquidity isn’t available (buffer insufficient).

In CreatorVault, `CreatorOVault` expects strategies to be able to withdraw in its withdrawal queue. A strategy revert can break user withdrawals.

## Can an ERC‑4626 vault use another ERC‑4626 vault as a “strategy”?

**Yes**, and it’s a common pattern (“vault-of-vault”). Two standard approaches:

1) **Same asset (recommended)**: outer vault’s `asset()` is the same as the inner vault’s `asset()`.
   - Outer vault deposits assets into inner vault and holds inner shares.
   - Outer `totalAssets()` counts:
     - idle assets + `inner.convertToAssets(innerSharesHeld)`
   - Outer withdrawals redeem from inner vault when needed.

2) **Share-as-asset**: outer vault’s `asset()` is the inner vault’s share token.
   - Useful for wrappers/composability, but user-facing asset becomes “shares”, not the underlying token.

In CreatorVault specifically, strategies must implement `IStrategy`, so the practical implementation is an **adapter**:
- `ERC4626StrategyAdapter` implements `IStrategy`
- internally calls `IERC4626.deposit/withdraw/redeem` on the inner vault
- reports `getTotalAssets()` using `convertToAssets(sharesHeld)`

## Recommended path for CreatorVault

Because **CreatorOVault is already ERC‑4626**, we don’t need Ajna’s 4626 wrapper for user deposits. We mainly want:
- better safety around liquidity / withdrawability
- standardized accounting + optional keeper controls

Two viable options:

### Option A (incremental): improve `AjnaStrategy`
- ✅ Implemented: strategy-level “buffer ratio” (keep X% idle inside the strategy) via `idleBufferBps`
- ✅ Implemented: Ajna read/withdraw calls are **best-effort** (no reverts; returns what can be pulled)
- ✅ Implemented: `rebalance()` now tries to restore the idle buffer target (best-effort)
- Still manual/admin: bucket moves (`moveToBucket`) and bucket selection (`setBucketIndex`)

Practical notes:
- Set `idleBufferBps = 0` to restore the previous “try to fully deploy to Ajna” behavior
- Keep it small (e.g. 5–20%) to avoid leaving too much idle (lost yield) while still protecting withdrawals

### Option B (modular): introduce an ERC‑4626 strategy adapter
- Keep `CreatorOVault` unchanged
- ✅ Implemented: a generic `IStrategy` wrapper around a 4626 vault (Ajna‑style or others)
  - Contract: `contracts/strategies/ERC4626StrategyAdapter.sol`
- Future: if Ajna publishes an OSS 4626 vault, we can integrate it without changing `CreatorOVault`



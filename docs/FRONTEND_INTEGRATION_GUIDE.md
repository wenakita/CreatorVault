# 🎨 **FRONTEND INTEGRATION GUIDE (Canonical)**

## 📌 **Important**
This repo **does not** use an onchain factory to deploy vault contracts. `CreatorOVaultFactory` is a **deployment registry** only. Deployments are done via:
- **Account Abstraction batches** (recommended), or
- **Foundry scripts**, then recorded onchain via `CreatorOVaultFactory.registerDeployment(...)`.

If you deploy manually (scripts or direct `forge create`), **remember to register the deployment** so the registry can point to the canonical vault stack.

---

## ✅ **What your frontend should do**

### **1) Deploy + launch (single signature)**
Use the canonical deploy route:
- `/deploy` (`frontend/src/pages/DeployVault.tsx`)

That flow:
- enforces canonical creator identity (prevents fragmented ownership)
- deploys the vault stack deterministically (CREATE2 salts + bytecode store) via `CreatorVaultBatcher`
- launches CCA during deploy
- supports **Permit2** and **operator-funded** AA flows when wallet capabilities allow

Onchain entrypoints used:
- `CreatorVaultBatcher.deployAndLaunch(...)`
- `CreatorVaultBatcher.deployAndLaunchWithPermit2(...)`
- `CreatorVaultBatcher.deployAndLaunchWithPermit2AsOperatorIdentityFunded(...)`
- `CreatorVaultBatcher.deployAndLaunchWithPermit2AsOperatorOperatorFunded(...)`

### **2) Activation-only (already deployed stack)**
If you already have vault/wrapper/CCA deployed and only need activation, use:
- `LaunchVaultAA` (`frontend/src/components/LaunchVaultAA.tsx`)

This calls `VaultActivationBatcher` with either:
- `batchActivate(...)`, or
- Permit2 operator variants (`batchActivateWithPermit2For`, `batchActivateWithPermit2FromOperator`).

### **3) Strategy deployment (optional)**
Use `/status` + `DeployStrategies` to create strategies via:
- `StrategyDeploymentBatcher.batchDeployStrategies(...)`

The UI then wires the strategies into the vault with `addStrategy(...)` and `setMinimumTotalIdle(...)`.

---

## 🧩 **Key contracts your UI interacts with**

- **Deploy + launch**: `contracts/helpers/batchers/CreatorVaultBatcher.sol`
- **Vault activation**: `contracts/helpers/batchers/VaultActivationBatcher.sol`
- **Strategy deployment**: `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`
- **Deployment registry**: `contracts/factories/CreatorOVaultFactory.sol`
- **Canonical registry**: `contracts/core/CreatorRegistry.sol`

---

## 🔍 **Where to read canonical addresses**

### **Onchain registries**
Use **both** of these for a complete view:
- `CreatorRegistry.getAllCreatorCoins()` + `getCreatorCoin(...)` for canonical token/vault metadata
- `CreatorOVaultFactory.deployments(...)` or `getDeployment(...)` for CCA + deployment provenance

The frontend reference implementation is:
- `frontend/src/lib/onchain/creatorVaultIndex.ts`

### **Static config defaults**
The app’s default addresses live in:
- `frontend/src/config/contracts.defaults.ts`
- `deployments/base/contracts/**` (source of truth per chain)

Use env overrides from:
- `frontend/src/config/contracts.ts`

---

## 🧭 **Identity + Farcaster integration**

The deploy flow prefers **verified Farcaster identity** when running inside the Farcaster Mini App or Base app:
- `useFarcasterAuth()` (`frontend/src/hooks/useFarcasterAuth.ts`)
- API endpoints:
  - `GET /api/farcaster/nonce`
  - `POST /api/farcaster/verify`
  - `GET /api/farcaster/me`
  - `GET /api/social/farcaster` (Neynar proxy for profiles)

Frontend usage patterns:
- `DeployVault.tsx` uses Farcaster verification to choose the canonical creator identity.
- `frontend/src/config/wagmi.ts` includes the `farcasterMiniApp()` connector for Mini App wallets.

---

## ✅ **Pages to keep aligned**

- `/deploy` → `frontend/src/pages/DeployVault.tsx`
- `/status` → `frontend/src/pages/Status.tsx`
- Activation-only → `frontend/src/components/LaunchVaultAA.tsx`

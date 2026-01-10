# 🎨 **FRONTEND INTEGRATION GUIDE (Canonical)**

## 📌 **Important**
This repo **does not** use an onchain `CreatorVaultFactory` (it was removed). Vault creation is done via:
- **Account Abstraction batches** (recommended), or
- **Foundry scripts**, then recorded onchain via `CreatorOVaultFactory.registerDeployment(...)`.

---

## ✅ **What your frontend should do**

### **1) Deploy + launch (one signature)**
Use the existing component:
- `frontend/src/components/DeployVaultAA.tsx`

That component:
- deploys the vault stack deterministically (CREATE2 salts)
- launches the CCA (via `VaultActivationBatcher`)
- optionally activates yield immediately (`deployToStrategies()` / `syncBalances()`)

### **2) Read canonical addresses**
Once deployed, read from onchain registries:
- `CreatorOVaultFactory.getDeployment(token)` (historical list + deployments)
- `CreatorRegistry` (canonical “source of truth” pointers used across the app)

### **3) Show health + fixes (creator-only)**
- `/status` UI: `frontend/src/pages/Status.tsx`

---

## 🧩 **Key contracts your UI interacts with**

- **Vault activation**: `contracts/helpers/VaultActivationBatcher.sol`
- **Deployment registry**: `contracts/factories/CreatorOVaultFactory.sol`
- **Canonical registry**: `contracts/core/CreatorRegistry.sol`
- **Strategy deployment (optional)**: `contracts/helpers/StrategyDeploymentBatcher.sol`




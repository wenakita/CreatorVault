# 🎨 **FRONTEND INTEGRATION GUIDE (Canonical)**

## 📌 **Important**
This repo **does not** use an onchain `CreatorVaultFactory` (it was removed). Vault creation is done via:
- **Account Abstraction batches** (recommended), or
- **Foundry scripts**, then recorded onchain via `CreatorOVaultFactory.registerDeployment(...)`.

---

## ✅ **What your frontend should do**

### **1) Deploy + launch (one signature)**
Use the canonical deploy route:
- `/deploy` (`frontend/src/pages/DeployVault.tsx`)

That flow:
- enforces canonical creator identity for existing creator coins (prevents fragmentation)
- deploys the vault stack deterministically (CREATE2 salts) via `CreatorVaultBatcher`
- deposits + launches CCA during deploy

If you already have a deployed vault stack and only need activation, use `LaunchVaultAA`.

### **2) Read canonical addresses**
Once deployed, read from onchain registries:
- `CreatorOVaultFactory.getDeployment(token)` (historical list + deployments)
- `CreatorRegistry` (canonical “source of truth” pointers used across the app)

### **3) Show health + fixes (creator-only)**
- `/status` UI: `frontend/src/pages/Status.tsx`

---

## 🧩 **Key contracts your UI interacts with**

- **Vault activation**: `contracts/helpers/batchers/VaultActivationBatcher.sol`
- **Deploy + launch**: `contracts/helpers/batchers/CreatorVaultBatcher.sol`
- **Deployment registry**: `contracts/factories/CreatorOVaultFactory.sol`
- **Canonical registry**: `contracts/core/CreatorRegistry.sol`
- **Strategy deployment (optional)**: `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`




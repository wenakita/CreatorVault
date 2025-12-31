# 🏗️ **FULL PLATFORM ARCHITECTURE (Canonical)**

## 📌 **Core decision**
There is **no onchain “mega factory”** in the canonical design.

- Deployments happen via **Account Abstraction (one-signature)** or **Foundry scripts**
- Onchain contracts (`CreatorOVaultFactory`, `CreatorRegistry`) store/serve canonical addresses

This keeps contracts **deployable (24KB limit)** and the system **easier to evolve**.

---

## ✅ **Shared infrastructure (deploy once)**

- **`CreatorRegistry`**: canonical lookups (token → vault/wrapper/shareOFT/oracle/gauge)
- **`CreatorOVaultFactory`**: registry of deployments (`registerDeployment(...)`)
- **`VaultActivationBatcher`**: shared batcher to deposit + wrap + launch CCA
- **`StrategyDeploymentBatcher`**: shared batcher to deploy Charm/Ajna strategy stack (optional)

---

## ✅ **Per-creator contracts (deployed per vault)**

- `CreatorOVault` (ERC-4626 vault)
- `CreatorOVaultWrapper`
- `CreatorShareOFT` (LayerZero share token)
- `CreatorGaugeController`
- `CCALaunchStrategy`
- `CreatorOracle`
- Strategies (Charm/Ajna) depending on configuration

---

## 🚀 **Canonical creator flow**

### **Step 1: One-signature deploy (recommended)**
Use the repo’s AA flow:
- **Frontend**: `frontend/src/components/DeployVaultAA.tsx`
- **Script**: `script/deploy-with-aa.ts`

This flow:
- deploys the full vault stack
- wires permissions (including `CCALaunchStrategy.setApprovedLauncher(VaultActivationBatcher, true)`)
- registers addresses (`CreatorOVaultFactory.registerDeployment(...)` + `CreatorRegistry` wiring)

### **Step 2: Launch CCA (also can be in the same AA batch)**
Use `VaultActivationBatcher.batchActivate(...)` (or the AA flow that calls it).

### **Step 3: Strategies**
- If you want **onchain strategy deployment**, deploy via `StrategyDeploymentBatcher.batchDeployStrategies(...)`
- Otherwise strategies can be added/wired by scripts/AA and then funded via vault calls (e.g. `deployToStrategies()`)

---

## 🔎 **Where to look in this repo**

- **Deploy (AA)**: `frontend/src/components/DeployVaultAA.tsx`
- **Activate (batcher)**: `contracts/helpers/VaultActivationBatcher.sol`
- **Deploy strategies (batcher)**: `contracts/helpers/StrategyDeploymentBatcher.sol`
- **Registry**: `contracts/factories/CreatorOVaultFactory.sol`, `contracts/core/CreatorRegistry.sol`



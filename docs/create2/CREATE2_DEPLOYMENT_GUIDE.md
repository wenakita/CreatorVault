# 🎯 **CREATE2 DEPLOYMENT GUIDE (Canonical)**

## ✅ Why CREATE2 matters here
CREATE2 gives you **predictable addresses** for the per-creator vault stack, which is essential for:
- cross-chain share tokens (LayerZero OFT)
- consistent integrations (“official vault address”)
- better UX (preview addresses before deploy)

---

## ✅ How this repo achieves determinism
We deploy the stack via an **Account Abstraction batch** that uses a CREATE2 deployer and **versioned salts**.

Primary implementation:
- `contracts/helpers/batchers/CreatorVaultBatcher.sol`
- `frontend/src/pages/DeployVault.tsx` (calls `CreatorVaultBatcher` from the `/deploy` route)

Supporting helpers:
- `contracts/factories/Create2Deployer.sol`
- `contracts/helpers/infra/OFTBootstrapRegistry.sol`

### **Versioned salts**
Salts are derived from (at minimum):
- creator token address
- owner address
- chainId
- `deploymentVersion` (so you can do a one-time “v2” without breaking v1)

---

## ✅ What is deterministic vs not

- **Deterministic (CREATE2)**: vault, wrapper, shareOFT and other CREATE2-deployed components in the AA flow
- **Not necessarily deterministic**: anything intentionally chain-specific or deployed via plain CREATE in scripts

---

## 🔎 Where to run / inspect
- **Deploy + launch (onchain)**: `/deploy` (`frontend/src/pages/DeployVault.tsx`)
- **Onchain record of deployments**: `contracts/factories/CreatorOVaultFactory.sol`




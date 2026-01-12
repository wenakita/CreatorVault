# 🤖 **CREATOR AUTOMATION GUIDE (Canonical)**

## 📌 Key idea: shared public-goods batchers
These contracts are deployed once and reused by everyone:
- `VaultActivationBatcher` (shared): deposit + wrap + launch CCA
- `StrategyDeploymentBatcher` (shared, optional): deploy Charm/Ajna strategy stack

Per-creator contracts are deployed per vault (vault/wrapper/shareOFT/oracle/gauge/CCA/strategies).

---

## ✅ Recommended creator onboarding flow (one signature)
Use the onchain deploy + launch flow:
- `/deploy` (`frontend/src/pages/DeployVault.tsx`)
- `contracts/helpers/CreatorVaultBatcher.sol`

This flow:
- deploys the full vault stack
- ensures the CCA is launchable by the shared `VaultActivationBatcher`
- launches the CCA as part of the same deploy batch (when configured)
- records the deployment onchain via `CreatorOVaultFactory.registerDeployment(...)`

---

## ✅ After deployment
- **Read canonical addresses** via `CreatorRegistry` / `CreatorOVaultFactory`
- **Show status + creator-only fixes** on `/status` (`frontend/src/pages/Status.tsx`)
- **Run strategy deployment** (optional) via `StrategyDeploymentBatcher` or AA/script wiring




# 🤖 **ACCOUNT ABSTRACTION DEPLOYMENT FLOW**

## ✅ **Current canonical flows**

### **Deploy + Launch (recommended)**
- **Frontend route**: `/deploy` (`frontend/src/pages/DeployVault.tsx`)
- **Onchain primitive**: `contracts/helpers/CreatorVaultBatcher.sol`

This path:
- enforces canonical creator identity for existing Zora Creator Coins (prevents fragmentation)
- deploys the full per-creator stack deterministically (CREATE2 salts + bytecode ids)
- deposits the initial 50M token amount and launches the CCA in the same flow
- prefers **Permit2** signatures; falls back to **approve** when needed

### **Activate existing vaults**
- **Frontend component**: `frontend/src/components/LaunchVaultAA.tsx`
- **Onchain primitive**: `contracts/helpers/VaultActivationBatcher.sol`

This path:
- approves the activation batcher (when needed) and launches the auction
- provides “one-click” UX on wallets supporting `wallet_sendCalls`
- falls back to sequential transactions on EOAs

## 🔎 **Related docs**
- `docs/aa/FULL_AA_SOLUTION.md`
- `docs/aa/AA_ACTIVATION.md`


# ⚠️ **CONTRACT SIZE ISSUE - ONCHAIN “MEGA FACTORY” TOO LARGE**

## 🚨 **PROBLEM (Historical)**

The old `CreatorVaultFactory` approach (a single onchain contract that deploys + wires many contracts) exceeded the EVM **24KB** contract size limit.

**Resolution:** We removed `CreatorVaultFactory.sol` and moved to a script/AA-based deployment flow, with onchain state tracked via `CreatorOVaultFactory` (registry) + `CreatorRegistry` (canonical lookups).

---

## 💡 **Solution we use now**

### **External deployment + registry**
- Deploy contracts via **Foundry scripts** or **Account Abstraction** (CREATE2 deployers), avoiding the onchain size limit entirely.
- Record deployments in `CreatorOVaultFactory` (`registerDeployment`) and wire canonical lookups in `CreatorRegistry`.

---

## ✅ Status
This is already implemented in the repo’s current deployment flow.


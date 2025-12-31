# ⚠️ **CONTRACT SIZE ISSUE - FACTORY TOO LARGE**

## 🚨 **PROBLEM**

The `CreatorVaultFactory` is **141KB** - way over the Ethereum **24KB limit**!

**Cannot deploy as-is.**

---

## 💡 **SOLUTIONS**

### **Option 1: Minimal Factory** ✅ (Recommended)
Create a simplified factory that:
- Only deploys core contracts (Vault, Wrapper, ShareOFT)
- Gauge and CCA deployed separately
- Uses interfaces for configuration

### **Option 2: Factory Split**
Split into multiple factories:
- `CoreVaultFactory` - Vault + Wrapper
- `OFTFactory` - ShareOFT
- `GaugeFactory` - GaugeController
- `CCAFactory` - CCALaunchStrategy

### **Option 3: Proxy Pattern**
Use a factory that deploys clones/proxies instead of new contracts

### **Option 4: External Deployment**
Deploy contracts via scripts, use factory as registry only

---

## 🎯 **RECOMMENDED: MINIMAL FACTORY**

I'll create a streamlined version that:
1. Deploys Vault, Wrapper, ShareOFT via CREATE2
2. Auto-configures permissions
3. Returns addresses for manual Gauge/CCA deployment

**Size target: < 20KB** ✅

---

**Want me to create the minimal factory now?**


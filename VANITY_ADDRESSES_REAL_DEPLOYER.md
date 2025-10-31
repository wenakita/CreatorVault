# ✅ Vanity Addresses Generated - Real Deployer

**Generated:** October 31, 2025  
**Deployer:** `0x7310Dd6EF89b7f829839F140C6840bc929ba2031`  
**Total Time:** 3.64 seconds ⚡

---

## 🎯 Generated Addresses

### 1. EagleShareOFT (PREMIUM VANITY)
```
Address: 0x47d5f37c365d00351185086ebb65e49b5c0ea91e
Pattern: 0x47...ea91e ✅ (FULL MATCH!)
Salt:    0x000000000000000000000000000000000000000000000000e000000000370c81
Time:    3.64 seconds
```

### 2. EagleOVault (PARTIAL VANITY)
```
Address: 0x4789507c48b68bcda769c507d7d3ddd61a581c55
Pattern: 0x47... ✓
Salt:    0x0000000000000000000000000000000000000000000000000c00000000000004
Time:    0.001 seconds
```

### 3. EagleVaultWrapper (PARTIAL VANITY)
```
Address: 0x479c6c86defdec2e5482baebac58a91d7630ad4e
Pattern: 0x47... ✓
Salt:    0x0000000000000000000000000000000000000000000000000000000000000069
Time:    0.001 seconds
```

**⚠️ NOTE:** Wrapper salt is calculated with PLACEHOLDER addresses for vault/OFT.  
The actual deployed address will be DIFFERENT because it depends on real vault/OFT addresses.

### 4. CharmStrategyUSD1 (PARTIAL VANITY)
```
Address: 0x4780f598e171cf3885eebc7b1c45e4b6da9869dc
Pattern: 0x47... ✓
Salt:    0x00000000000000000000000000000000000000000000000000000000000000d0
Time:    0.001 seconds
```

**⚠️ NOTE:** Strategy salt is calculated with PLACEHOLDER vault address.  
The actual deployed address will be DIFFERENT because it depends on real vault address.

---

## ⚠️ IMPORTANT: Deployment Order

Because Wrapper and Strategy salts were calculated with placeholder addresses, we have TWO options:

### Option A: Deploy Without Vanity for Wrapper/Strategy (Recommended)
1. Deploy **EagleOVault** with vanity salt → `0x4789507c...`
2. Deploy **EagleShareOFT** with vanity salt → `0x47d5f37c...ea91e` ✨
3. Deploy **EagleVaultWrapper** WITHOUT vanity (regular deployment)
4. Deploy **CharmStrategyUSD1** WITHOUT vanity (regular deployment)

**Pros:** Simple, fast, OFT gets premium vanity  
**Cons:** Wrapper and Strategy won't have vanity addresses

### Option B: Regenerate Wrapper/Strategy Salts After Vault/OFT Deploy
1. Deploy **EagleOVault** with vanity → `0x4789507c...`
2. Deploy **EagleShareOFT** with vanity → `0x47d5f37c...ea91e` ✨
3. Regenerate vanity salt for Wrapper using REAL vault/OFT addresses
4. Deploy **EagleVaultWrapper** with new vanity salt
5. Regenerate vanity salt for Strategy using REAL vault address
6. Deploy **CharmStrategyUSD1** with new vanity salt

**Pros:** All contracts get vanity addresses  
**Cons:** Takes more time (need to regenerate salts)

---

## 🚀 Recommended: Option A

Deploy Vault and OFT with vanity, deploy Wrapper and Strategy normally.

**Why?**
- The OFT (EAGLE token) is user-facing and gets the premium `0x47...ea91e` address ✨
- Vault also gets a nice `0x47...` address
- Wrapper and Strategy are backend contracts - vanity is less important
- Much faster deployment process

---

## 📝 Next Steps

I'll update the deployment scripts to use these new vanity addresses for Vault and OFT only.



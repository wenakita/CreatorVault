# 🎨 **STANDARD VAULT NAMING PATTERN**

## ✅ **THE PATTERN:**

All CreatorVault Charm vaults use this consistent naming:

```
Name:   "CreatorVault: [token]/USDC"
Symbol: "CV-[token]-USDC"
```

---

## 📋 **EXAMPLES:**

```solidity
// AKITA token vault:
Name:   "CreatorVault: akita/USDC"
Symbol: "CV-akita-USDC"

// DOGE token vault:
Name:   "CreatorVault: doge/USDC"
Symbol: "CV-doge-USDC"

// PEPE token vault:
Name:   "CreatorVault: pepe/USDC"
Symbol: "CV-pepe-USDC"

// SHIB token vault:
Name:   "CreatorVault: shib/USDC"
Symbol: "CV-shib-USDC"
```

---

## 🚀 **DEPLOYMENT:**

```solidity
// Deploy with standard naming
batchDeployStrategies(
    TOKEN_ADDRESS,
    USDC_ADDRESS,
    VAULT_ADDRESS,
    AJNA_FACTORY,
    3000,
    sqrtPriceX96,
    CREATOR_ADDRESS,
    "CreatorVault: [token]/USDC",  // Replace [token] with lowercase symbol
    "CV-[token]-USDC"               // Replace [token] with lowercase symbol
);
```

---

## ✅ **NAMING RULES:**

1. **Always use lowercase** for token symbols (e.g., "akita" not "AKITA")
2. **Always use format:** `CreatorVault: [token]/USDC`
3. **Always use symbol:** `CV-[token]-USDC`
4. **Quote token is always:** `USDC` (uppercase)
5. **No variations** - consistency across all vaults

---

## 🎯 **BENEFITS:**

- ✅ **Consistent branding** across all vaults
- ✅ **Easy to identify** CreatorVault products
- ✅ **Clear token pairing** shown in name
- ✅ **Professional appearance** on block explorers
- ✅ **No confusion** between different vaults

---

**This is the ONLY naming pattern used for all CreatorVault Charm vaults.** 🎉


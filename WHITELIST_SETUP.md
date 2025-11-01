# 🔐 Vault Whitelist Setup Guide

## Overview
Restrict vault deposits to only the multisig address by enabling the whitelist feature.

**Vault Address:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`  
**Multisig Address:** `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3`

---

## Option 1: Using the Setup Script

### Prerequisites
- Node.js installed
- Private key with owner permissions
- RPC URL for Ethereum mainnet

### Run the Script
```bash
# Set environment variables
export PRIVATE_KEY="your_private_key_here"
export RPC_URL="https://eth.llamarpc.com"  # or your preferred RPC

# Run the script
npx tsx scripts/setupWhitelist.ts
```

The script will:
1. ✅ Add multisig to whitelist
2. ✅ Enable whitelist
3. ✅ Verify final state

---

## Option 2: Manual Calls via Gnosis Safe

### Step 1: Add Multisig to Whitelist

**Function:** `setWhitelist(address _account, bool _status)`

**Parameters:**
- `_account`: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3` (multisig address)
- `_status`: `true`

**In Gnosis Safe UI:**
1. Go to "New Transaction" → "Contract Interaction"
2. Enter contract address: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
3. Select method: `setWhitelist`
4. Enter parameters:
   - `_account`: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3`
   - `_status`: `true`
5. Submit and sign transaction

---

### Step 2: Enable Whitelist

**Function:** `setWhitelistEnabled(bool _enabled)`

**Parameters:**
- `_enabled`: `true`

**In Gnosis Safe UI:**
1. Go to "New Transaction" → "Contract Interaction"
2. Enter contract address: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
3. Select method: `setWhitelistEnabled`
4. Enter parameters:
   - `_enabled`: `true`
5. Submit and sign transaction

---

## Option 3: Using Cast (Foundry)

```bash
# Step 1: Add multisig to whitelist
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelist(address,bool)" \
  0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Step 2: Enable whitelist
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelistEnabled(bool)" \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

---

## Verification

### Check Whitelist Status

```bash
# Check if whitelist is enabled
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "whitelistEnabled()(bool)" \
  --rpc-url $RPC_URL

# Check if multisig is whitelisted
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "whitelist(address)(bool)" \
  0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  --rpc-url $RPC_URL
```

---

## What This Does

### ✅ Enabled (Deposits Restricted)
- Only whitelisted addresses can call `deposit()`
- Only whitelisted addresses can call `mint()`
- Only whitelisted addresses can call `depositDual()`
- **Result:** Only the multisig can deposit into the vault

### ⚠️ Not Affected (Still Open)
- `withdraw()` - Anyone can withdraw their shares
- `redeem()` - Anyone can redeem their shares
- `injectCapital()` - Anyone can inject capital (no whitelist check)

---

## Adding More Addresses to Whitelist (Optional)

If you want to whitelist additional addresses in the future:

```bash
# Single address
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelist(address,bool)" \
  <ADDRESS_TO_WHITELIST> \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Multiple addresses at once
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelistBatch(address[],bool)" \
  "[0xAddress1,0xAddress2,0xAddress3]" \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

---

## Removing Addresses from Whitelist

```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelist(address,bool)" \
  <ADDRESS_TO_REMOVE> \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

---

## Disabling Whitelist (Revert to Open Access)

If you want to allow anyone to deposit again:

```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setWhitelistEnabled(bool)" \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

---

## Emergency: Pause the Vault

If you need to stop ALL activity (deposits AND withdrawals):

```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setPaused(bool)" \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

To unpause:

```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "setPaused(bool)" \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

---

## Questions?

For any issues or questions, refer to the contract source code:
`contracts/EagleOVault.sol`

Functions are documented with NatSpec comments explaining their behavior.


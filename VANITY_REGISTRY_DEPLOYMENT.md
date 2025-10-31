# 🎯 Vanity Registry Deployment Plan

**Goal:** Deploy EagleRegistry with vanity address pattern `0x47...ea91e`

---

## 📊 Current Status

### ✅ Completed
- [x] Vanity salt search started (PID: 1315464)
- [x] Background process running
- [x] Expected completion: 2-3 hours

### ⏳ In Progress
- [ ] Vanity salt generation (running in background)
- [ ] Monitoring: `tail -f registry-vanity.log`

### ❌ Old Registry (To Be Ignored)
- Address: `0x138Fb3732B8efd221Ac95fA8aA4276eD749df4aa`
- Status: Deployed but doesn't match vanity pattern
- Action: **DO NOT USE** - will deploy new one

---

## 🔄 Deployment Workflow

### Phase 1: Wait for Vanity Salt (2-3 hours)

**Check progress:**
```bash
# Monitor the search
tail -f registry-vanity.log

# Check if complete (will create this file when done)
ls -la registry-vanity-address.json
```

**When complete, you'll see:**
```json
{
  "salt": "0x...",
  "address": "0x47...ea91e",
  "deployer": "0x7310Dd6EF89b7f829839F140C6840bc929ba2031",
  "attempts": 268000000,
  "timeSeconds": 9000,
  "pattern": "0x47...ea91e",
  "timestamp": "2025-10-31T..."
}
```

---

### Phase 2: Update Deployment Script

Once `registry-vanity-address.json` exists:

```bash
# Extract the salt and address
REGISTRY_SALT=$(cat registry-vanity-address.json | jq -r '.salt')
REGISTRY_ADDRESS=$(cat registry-vanity-address.json | jq -r '.address')

echo "Salt: $REGISTRY_SALT"
echo "Address: $REGISTRY_ADDRESS"
```

**Update `script/DeployRegistryVanity.s.sol`:**
```solidity
// Replace these lines:
bytes32 constant REGISTRY_SALT = 0x0000000000000000000000000000000000000000000000000000000000000001;
address constant EXPECTED_REGISTRY = address(0);

// With the values from registry-vanity-address.json:
bytes32 constant REGISTRY_SALT = <SALT_FROM_JSON>;
address constant EXPECTED_REGISTRY = <ADDRESS_FROM_JSON>;
```

---

### Phase 3: Deploy Vanity Registry

```bash
# Deploy the registry with vanity address
forge script script/DeployRegistryVanity.s.sol:DeployRegistryVanity \
  --rpc-url ethereum \
  --broadcast \
  --verify \
  -vvv
```

**Expected output:**
```
Registry deployed: 0x47...ea91e ✅
Vanity pattern verified! ✅
```

---

### Phase 4: Save Registry Address

```bash
# Add to .env
echo "REGISTRY_ADDRESS=0x47...ea91e" >> .env

# Verify it's deployed
cast code $REGISTRY_ADDRESS --rpc-url https://eth.llamarpc.com
```

---

### Phase 5: Deploy Other Contracts

Now deploy the rest with their vanity addresses:

```bash
# Deploy Vault, Strategy, Wrapper, OFT (all with vanity)
forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url ethereum \
  --broadcast \
  --verify \
  -vvv
```

**All contracts will have vanity pattern `0x47...ea91e`:**
- ✅ Registry: `0x47...ea91e`
- ✅ Vault: `0x47E0E593AF3534f93F9816b5243e6554425Ea91e`
- ✅ Strategy: `0x47120C365eda3d5aC9dDdF19749aA64ceEeeA91E`
- ✅ Wrapper: `0x47048CA688fafA01DFefC84fD10bD493834eA91e`
- ✅ OFT: `0x47841bb8d73936Ae091CA8f20fdc3a7645DeA91E`

---

## 📋 Monitoring Commands

### Check Search Progress
```bash
# Watch the log in real-time
tail -f registry-vanity.log

# Check how many attempts so far
grep "Tried" registry-vanity.log | tail -1

# Check if process is still running
ps aux | grep generate-registry-vanity-salt
```

### Estimate Time Remaining
```bash
# Get current attempts and speed
ATTEMPTS=$(grep "Tried" registry-vanity.log | tail -1 | awk '{print $2}' | sed 's/M//')
SPEED=$(grep "Tried" registry-vanity.log | tail -1 | grep -oP '\d+(?= attempts/sec)')

# Calculate estimated time (268M total attempts needed)
echo "Attempts: ${ATTEMPTS}M"
echo "Speed: ${SPEED} attempts/sec"
echo "Estimated time remaining: ~$((268 - ${ATTEMPTS%.*}))M attempts left"
```

---

## 🚨 Troubleshooting

### If Search Takes Too Long
You can modify the pattern to be easier:

**Option A: Only prefix (faster - 1 second)**
```typescript
// Change in generate-registry-vanity-salt.ts:
if (addressLower.startsWith('0x47')) {  // Remove suffix check
```

**Option B: Only suffix (medium - 30 seconds)**
```typescript
// Change in generate-registry-vanity-salt.ts:
if (addressLower.endsWith('ea91e')) {  // Remove prefix check
```

**Option C: Different pattern (adjust as needed)**
```typescript
// Easier patterns:
if (addressLower.startsWith('0x47') && addressLower.endsWith('e')) {  // ~4k attempts
```

### If Process Dies
```bash
# Restart it
./start-vanity-search.sh

# Or run manually
npx ts-node scripts/generate-registry-vanity-salt.ts > registry-vanity.log 2>&1 &
```

---

## ⏱️ Timeline

| Step | Duration | Status |
|------|----------|--------|
| Vanity salt search | 2-3 hours | 🔄 In Progress |
| Update script | 5 minutes | ⏳ Pending |
| Deploy registry | 2 minutes | ⏳ Pending |
| Deploy other contracts | 5 minutes | ⏳ Pending |
| Configure & test | 10 minutes | ⏳ Pending |
| Transfer ownership | 5 minutes | ⏳ Pending |
| **TOTAL** | **~3 hours** | |

---

## 🎯 Next Steps

**Right now:**
1. Wait for vanity salt search to complete (~2-3 hours)
2. Monitor progress: `tail -f registry-vanity.log`
3. Grab a coffee ☕

**When complete:**
1. Check `registry-vanity-address.json` exists
2. Update `DeployRegistryVanity.s.sol` with salt
3. Deploy registry
4. Deploy other contracts
5. Configure and transfer ownership

---

## 📞 Status Check

**Current search status:**
```bash
tail -f registry-vanity.log
```

**When you see this, it's done:**
```
✅ FOUND VANITY ADDRESS!
═══════════════════════════════════════════════════════
Salt:     0x...
Address:  0x47...ea91e
```

---

**I'll check back in ~30 minutes to see progress!** 🚀


# 🚀 AKITA VAULT LAUNCH VERIFICATION

## Critical Launch Flow Check

### Phase 1: Launch (Day 0) ✅

**What Happens:**
1. User calls `ActivateAkita.tsx` → 1-click batched transaction
2. **Step 1**: Approve + Deposit 50M AKITA to vault
3. **Step 2**: Deploy underlying AKITA to strategies:
   - 12.5M → AKITA/WETH V3 Charm
   - 12.5M → AKITA/USDC V3 Charm
   - 12.5M → Ajna lending
   - 12.5M → Idle reserve
4. **Step 3**: Wrap 50M vault shares → 50M wsAKITA
5. **Step 4**: Approve 25M wsAKITA to CCA Strategy
6. **Step 5**: Launch CCA auction with 25M wsAKITA
7. **Result**: 25M wsAKITA in auction, 25M wsAKITA to creator's wallet

**Contracts Involved:**
- `CreatorOVault.sol` (vault)
- `CreatorOVaultWrapper.sol` (wrapper)
- `CreatorShareOFT.sol` (wsAKITA)
- `CCALaunchStrategy.sol` (CCA)

---

### Phase 2: Auction (Days 0-7) ✅

**What Happens:**
- Users bid ETH for wsAKITA
- Price discovery via continuous clearing
- Auction runs for 7 days
- Anyone can bid on `AuctionBid.tsx`

**Contracts Involved:**
- Uniswap's `ContinuousClearingAuction.sol`
- `CCALaunchStrategy.sol` (manages auction)

---

### Phase 3: Completion (Day 7+) ⚠️ **NEEDS MANUAL COMPLETION**

**What Must Happen:**
1. **Someone must call `completeAuction()` on CCALaunchStrategy**
2. This will:
   - Sweep ETH from auction
   - Create wsAKITA/ETH V4 pool
   - Add initial liquidity
   - Configure 6.9% tax hook
   - Mark strategy as "graduated"

**Manual Steps Required:**
- Go to `CompleteAuction.tsx` page
- Connect wallet
- Follow 3-step wizard:
  1. **Sweep**: Collect ETH from auction
  2. **Configure**: Set up 6.9% tax hook
  3. **Complete**: Create V4 pool + add liquidity

**Contracts Involved:**
- `CCALaunchStrategy.sol`
- Uniswap V4 `PoolManager`
- `TaxHook` (0xca975B9dAF772C71161f3648437c3616E5Be0088)

---

## ⚠️ CRITICAL GAPS IDENTIFIED

### 1. **No Automatic Graduation**
- ❌ The CCA does NOT automatically create the V4 pool after 7 days
- ❌ Someone must manually call `completeAuction()` via `CompleteAuction.tsx`
- ✅ This is by design for safety, but needs to be done

### 2. **Hook Configuration**
- The 6.9% tax hook must be configured with:
  - Token: wsAKITA address
  - Counter: WETH (or ETH)
  - Recipient: Fee recipient address
  - Tax rate: 690 (6.9%)
  - Enabled: true
  - Lock: true (to prevent changes)

### 3. **V4 Pool Creation**
- Must provide:
  - Initial wsAKITA amount
  - Initial ETH amount (from auction)
  - Fee tier: 3000 (0.3%)
  - Hook: 0xca975B9dAF772C71161f3648437c3616E5Be0088
  - Tick spacing: 60

---

## ✅ PRE-LAUNCH CHECKLIST

### Smart Contracts
- [ ] All contracts deployed to Base?
- [ ] Vault has correct strategies configured?
- [ ] Wrapper points to correct vault?
- [ ] ShareOFT (wsAKITA) points to correct wrapper?
- [ ] CCALaunchStrategy has correct parameters?
- [ ] Hook address is correct (0xca975...088)?

### Frontend
- [ ] `ActivateAkita.tsx` has correct contract addresses?
- [ ] `AuctionBid.tsx` shows correct auction info?
- [ ] `CompleteAuction.tsx` is accessible?
- [ ] All RPC endpoints working?

### Post-Launch (After 7 Days)
- [ ] Monitor auction progress daily
- [ ] Prepare to call `completeAuction()` on day 7
- [ ] Have ETH for gas ready
- [ ] Test `CompleteAuction.tsx` flow beforehand

---

## 🔧 RECOMMENDED FIXES

### Option 1: Keep Manual (Current)
**Pros:**
- More control
- Safer
- Can verify everything before pool creation

**Cons:**
- Requires someone to manually complete
- Risk of delay if forgotten

### Option 2: Add Keeper Bot
**What to build:**
- Automated script that monitors CCA end time
- Calls `completeAuction()` automatically after 7 days
- Requires gas funds

**Implementation:**
```typescript
// keeper.ts
while (true) {
  const status = await ccaStrategy.getAuctionStatus()
  if (!status.isActive && !status.isGraduated) {
    // Auction ended but not graduated
    await ccaStrategy.completeAuction()
  }
  await sleep(1 hour)
}
```

### Option 3: Add Permissionless Completion
**What to change:**
- Make `completeAuction()` callable by anyone after 7 days
- Add incentive (e.g., 0.1% of raised ETH to caller)
- This makes it trustless

---

## 📋 LAUNCH DAY ACTIONS

### Before Launch:
1. Verify all contract addresses in `frontend/src/config/contracts.ts`
2. Verify you have 50M AKITA in your wallet
3. Ensure you're connected to Base network
4. Test the UI on testnet first (if possible)

### During Launch:
1. Go to `/activate-akita`
2. Connect your wallet (Coinbase Smart Wallet recommended)
3. Set minimum raise (e.g., 0.1 ETH)
4. Click "Launch Auction (1-Click)"
5. Confirm in wallet
6. Wait for confirmation
7. Verify auction is live on `/auction/bid/{vault}`

### After Launch:
1. Monitor auction at `/auction/bid/{vault}`
2. Share link with community
3. Watch ETH raised amount
4. Prepare for day 7 completion

### Day 7 (Completion):
1. Go to `/complete-auction/{ccaStrategy}`
2. Follow 3-step wizard
3. Step 1: Sweep currency
4. Step 2: Configure hook
5. Step 3: Create V4 pool
6. Verify pool is live on Uniswap V4

---

## 🚨 WHAT TO DO IF SOMETHING GOES WRONG

### If Launch Fails:
- Check transaction on Basescan
- Verify AKITA approval
- Ensure you have enough AKITA
- Try again

### If Auction Doesn't Start:
- Check CCA strategy address
- Verify wsAKITA was transferred
- Check auction contract on Basescan

### If Completion Fails:
- Check each step individually
- Verify auction has ended
- Ensure ETH was raised
- Contact Uniswap support if hook fails

---

## 📞 SUPPORT

If you need help:
1. Check Basescan for transaction details
2. Verify contract addresses
3. Check this doc for troubleshooting
4. Ask in Discord/Telegram

---

**FINAL RECOMMENDATION:**

✅ **You can launch now, BUT:**
1. Make sure you understand the manual completion step on day 7
2. Set a calendar reminder for day 7
3. Have someone else also aware as backup
4. Consider building a keeper bot for automation

The launch itself is automated, but pool creation is manual by design.


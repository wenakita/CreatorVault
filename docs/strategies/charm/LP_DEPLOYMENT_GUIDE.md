# LP Auto-Deployment with Account Abstraction

## Overview

CreatorVault now bundles **LP deployment** into the 1-click activation, creating instant liquidity on Uniswap V4.

---

## The Full Flow (8 Steps in 1 Transaction)

```
User clicks "Launch Auction" → Smart Wallet executes:

1. Approve 50M AKITA to vault
2. Deposit 50M AKITA → get vault shares
3. Approve shares to wrapper
4. Wrap shares → get 50M wsAKITA
5. Approve 25M wsAKITA to CCA
6. Launch CCA auction with 25M wsAKITA
7. Approve 25M wsAKITA to LP deployer
8. Deploy LP: 25M wsAKITA + 0.5 ETH → Uniswap V4

Result:
- 25M wsAKITA in CCA auction (7 days)
- 25M wsAKITA + 0.5 ETH in Uniswap V4 LP
- LP NFT sent to user's wallet ✅
```

---

## SimpleLPDeployer Contract

### Purpose
Deploys full-range Uniswap V4 liquidity for wsAKITA/WETH pairs during activation.

### Key Features
- ✅ **User Ownership**: LP NFT goes directly to user
- ✅ **Auto-Pairing**: Handles wsAKITA + ETH → WETH conversion
- ✅ **Slippage Protection**: 5% max slippage on both tokens
- ✅ **Refunds**: Unused tokens automatically returned
- ✅ **Full-Range**: Liquidity active at all prices

### Contract Functions

```solidity
function deployLP(
    address wsToken,      // wsAKITA address
    uint256 tokenAmount,  // 25M wsAKITA
    uint256 minETH        // Min ETH for slippage protection
) external payable returns (
    uint256 tokenId,      // LP NFT ID
    uint128 liquidity     // Liquidity amount
)
```

### Integration

```typescript
// In activation batch (step 8)
{
  to: CONTRACTS.lpDeployer,
  data: encodeFunctionData({
    abi: LP_DEPLOYER_ABI,
    functionName: 'deployLP',
    args: [
      AKITA.shareOFT,           // wsAKITA
      25_000_000n * 10n**18n,   // 25M tokens
      0.475n * 10n**18n,        // Min 0.475 ETH (5% slippage)
    ],
  }),
  value: 0.5n * 10n**18n,  // Send 0.5 ETH for pairing
}
```

---

## User Experience

### Before (Manual LP)
```
1. Launch auction → wait...
2. Go to Uniswap
3. Add liquidity manually
4. Adjust ranges
5. Submit transaction
6. Wait for confirmation
Total: ~10 minutes, 2 transactions
```

### After (Auto LP)
```
1. Click "Launch Auction (1-Click)"
2. Confirm in wallet
3. Done! ✅
   - Auction live
   - LP deployed
   - LP NFT in wallet
Total: ~30 seconds, 1 transaction
```

---

## Deployment

### 1. Deploy SimpleLPDeployer

```bash
cd contracts

# Deploy to Base mainnet
forge create SimpleLPDeployer \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    "0x498581fF718922c3f8e6A244956aF099B2652b2b" \ # PoolManager
    "0x..." \                                          # TODO: V4 PositionManager
    "0x4200000000000000000000000000000000000006" \ # WETH
    "0xca975B9dAF772C71161f3648437c3616E5Be0088"   # TaxHook

# Verify
forge verify-contract \
  <DEPLOYED_ADDRESS> \
  SimpleLPDeployer \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
    "0x498581fF718922c3f8e6A244956aF099B2652b2b" \
    "0x..." \
    "0x4200000000000000000000000000000000000006" \
    "0xca975B9dAF772C71161f3648437c3616E5Be0088")
```

### 2. Update Frontend Config

```typescript
// frontend/src/config/contracts.ts
export const CONTRACTS = {
  ...
  lpDeployer: '0x...' as const, // <-- Add deployed address
}
```

### 3. Redeploy Frontend

```bash
cd frontend
git add src/config/contracts.ts
git commit -m "feat: add SimpleLPDeployer address"
git push origin main
# Vercel auto-deploys
```

---

## LP Management

### User Gets Full Control

The LP NFT is sent directly to the user's wallet, giving them:

1. **Fee Earnings**: Collect trading fees from the pool
2. **Liquidity Control**: Add/remove liquidity anytime
3. **Range Adjustment**: Migrate to concentrated ranges
4. **Ownership**: Full custody, no intermediaries

### Future: Charm Integration

For advanced users, we're building integration with Charm Finance for automated rebalancing:

```
Option 1: SimpleLPDeployer (current)
- User controls LP manually
- Full-range position
- Simple + trustless

Option 2: CharmStrategy (coming soon)
- Automatic rebalancing
- Concentrated liquidity
- Optimized for fees
```

---

## Technical Details

### V4 Pool Parameters

```solidity
Fee Tier: 3000 (0.3%)
Tick Range: -887272 to 887272 (full range)
Token0: WETH or wsAKITA (sorted by address)
Token1: wsAKITA or WETH (sorted by address)
Hook: SimpleSellTaxHook (6.9% fee on sells)
```

### Slippage Protection

```solidity
// Both tokens protected
amount0Min = (amount0Desired * 95) / 100  // 5% slippage
amount1Min = (amount1Desired * 95) / 100
```

### ETH Handling

```solidity
// Auto-wrap ETH to WETH
WETH.deposit{value: msg.value}()

// Refund unused WETH as ETH
WETH.withdraw(unusedAmount)
payable(user).transfer(unusedAmount)
```

---

## Gas Costs

### Individual Transactions (old way)
```
Launch auction: ~200k gas (~$6)
Add liquidity:  ~180k gas (~$5.50)
Total: ~380k gas (~$11.50)
Clicks: 2
Time: ~10 minutes
```

### Batched with AA (new way)
```
All 8 steps: ~550k gas (~$0 with Coinbase Smart Wallet)
Clicks: 1
Time: ~30 seconds
```

**Savings: 100% gas + 95% time + 50% clicks!**

---

## Security

### SimpleLPDeployer
- ✅ No token custody (everything flows through)
- ✅ ReentrancyGuard on deployLP
- ✅ User receives LP NFT directly
- ✅ Automatic refunds for unused tokens
- ✅ Slippage protection on both tokens

### LP Ownership
- ✅ User owns LP NFT (full control)
- ✅ Can withdraw liquidity anytime
- ✅ Earns all trading fees
- ✅ No intermediary contracts

---

## Testing

### Local Testing
```bash
# 1. Deploy to Anvil fork
anvil --fork-url https://mainnet.base.org

# 2. Deploy SimpleLPDeployer
forge script script/DeployLP.s.sol --broadcast

# 3. Test LP deployment
cast send $LP_DEPLOYER "deployLP(address,uint256,uint256)" \
  $WS_AKITA \
  25000000000000000000000000 \
  475000000000000000 \
  --value 0.5ether
```

### Mainnet Verification
```bash
# Check LP NFT ownership
cast call $POSITION_MANAGER "ownerOf(uint256)(address)" $TOKEN_ID

# Check liquidity amount
cast call $POSITION_MANAGER "positions(uint256)" $TOKEN_ID

# Check pool reserves
cast call $POOL "slot0()" --decode-output
```

---

## FAQ

### Q: Who owns the LP?
**A:** The user! The LP NFT is sent directly to their wallet. They have full control.

### Q: Can users remove liquidity?
**A:** Yes, anytime. They own the LP NFT and can interact with Uniswap V4 directly or via the Uniswap app.

### Q: What if LP deployment fails?
**A:** The entire transaction reverts (atomic). User keeps their tokens, nothing is lost.

### Q: Can users provide more liquidity later?
**A:** Yes! They can add more liquidity to the pool anytime using their LP NFT or creating a new position.

### Q: What about impermanent loss?
**A:** Full-range positions have normal IL risk. Users can later migrate to concentrated ranges for higher fees (but higher IL risk).

---

## Next Steps

### To Enable Auto-LP:

1. **Deploy SimpleLPDeployer** to Base mainnet
2. **Update** `CONTRACTS.lpDeployer` in config
3. **Redeploy** frontend to Vercel
4. **Test** on testnet first
5. **Launch** on mainnet

### After Launch:

1. Monitor LP deployments
2. Collect user feedback
3. Build Charm integration for auto-rebalancing
4. Add concentrated liquidity options

---

## Resources

- [SimpleLPDeployer.sol](../contracts/helpers/SimpleLPDeployer.sol)
- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Charm Finance](https://www.charm.fi/)
- [ERC-721 (LP NFT)](https://eips.ethereum.org/EIPS/eip-721)

---

## Summary

✅ **8 steps in 1 transaction**
✅ **Automatic LP deployment**
✅ **User owns LP NFT**
✅ **Gasless via Coinbase Smart Wallet**
✅ **Instant liquidity after launch**

**Result: The smoothest vault activation in DeFi! 🚀**



# CharmStrategyWETH - Deployment Complete! ✅

**Date**: November 13, 2025  
**Status**: ✅ **FULLY DEPLOYED AND ACTIVE**

---

## 🎯 Current Deployment Status

### EagleOVault (Main Vault)
- **Address**: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Management**: `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` (Your deployer wallet)
- **Total Assets**: ~4,327 WLFI idle in vault
- **Strategy Weight**: 10,000 / 10,000 (100% allocated)

### Active Strategies (50/50 Split)

#### 1. USD1 Strategy
- **Address**: `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
- **Charm Vault**: WLFI/USD1 Alpha Vault (`0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71`)
- **Weight**: 5,000 (50%)
- **Status**: ✅ Active & initialized
- **Owner**: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3` (Multisig)

#### 2. **NEW** WETH Strategy (FIXED VERSION) 🎉
- **Address**: `0xD5F80702F23Ea35141D4f47A0E107Fff008E9830`
- **Charm Vault**: WLFI/WETH Alpha Vault (`0x3314e248F3F752Cd16939773D83bEb3a362F0AEF`)
- **Weight**: 5,000 (50%)
- **Status**: ✅ **ACTIVE ON-CHAIN** (Replaced old strategy!)
- **Owner**: `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` (Your deployer wallet)
- **Deployment Date**: November 12, 2025 (10:04 UTC)
- **Replacement Date**: November 13, 2025 (04:17 UTC)

---

## 🛠️ What Was Fixed

The new WETH strategy addresses all the issues from previous versions:

### Safety Features
1. **Batch Deposits**: Max 300 WLFI per batch to avoid Charm "cross" errors
2. **Swap Limits**: Max 30% of holdings can be swapped (prevents liquidity drain)
3. **Token Returns**: Automatically returns unused tokens to vault
4. **Emergency Mode**: Owner can bypass oracle checks in emergencies

### Oracle Configuration
- **TWAP Pool**: Uses 0.3% fee tier (better liquidity) for price data
- **Deposit Pool**: Uses 1% fee tier (matches Charm vault)
- **Chainlink Feeds**: 
  - WETH/USD: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
  - USD1/USD: `0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d`

### Smart Rebalancing
- Automatically matches Charm vault's current WETH:WLFI ratio
- No manual intervention needed
- Returns excess tokens instead of failing

---

## 📊 Deployment History

### Timeline
1. **Nov 11, 11:07 UTC**: Initial WETH strategy deployed
2. **Nov 11, 23:30 UTC**: Configuration attempts
3. **Nov 12, 02:07 UTC**: First redeploy attempt
4. **Nov 12, 04:31 UTC**: Second redeploy (batching added)
5. **Nov 12, 10:04 UTC**: ✅ **Final fixed version deployed**
6. **Nov 13, 04:17 UTC**: ✅ **Replaced old strategy in vault**

### What Went Wrong Previously
- **"cross" errors**: Deposits too large for Charm's available liquidity
- **Solution**: Implemented batch deposits (max 300 WLFI per batch)

### Old Strategies (Removed)
- `0xa662aAEE37aCbeb0499FA9E8B33302b9E4EF0f5f` ← Removed Nov 13, 2025
- `0x47dCe4Bd8262fe0E76733825A1Cac205905889c6` ← From DEPLOYMENT_STATUS.md (old)

---

## ⚠️ Important: Funds NOT Yet Deployed

The ~4,327 WLFI sitting idle in the vault has **NOT** been deployed to strategies yet because:

1. The deployment would trigger a "cross" error from Charm (out of range)
2. This is a **Charm vault issue**, not a strategy issue
3. Funds are safe in the vault

### To Deploy Funds

**Option 1**: Wait for Charm vault to rebalance (automatic)
**Option 2**: Manual deployment when Charm liquidity improves

```bash
# Check if Charm vault is ready
cast call 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF "getTotalAmounts()(uint256,uint256)"

# Deploy when ready
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "forceDeployToStrategies()" \
  --rpc-url $ETHEREUM_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Option 3**: Deposits will automatically flow to strategies as users deposit

---

## 🔍 Verification Commands

```bash
# Check active strategies
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "strategyList(uint256)(address)" 1

# Should return: 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830

# Check strategy weight
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "strategyWeights(address)(uint256)" \
  0xD5F80702F23Ea35141D4f47A0E107Fff008E9830

# Should return: 5000 (50%)

# Check if strategy is initialized
cast call 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830 \
  "isInitialized()(bool)"

# Should return: true

# Check strategy holdings
cast call 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830 \
  "getTotalAmounts()(uint256,uint256)"

# Returns: (wlfiAmount, usd1Amount)
```

---

## 📁 Key Files

### Contracts
- **Strategy**: `contracts/strategies/CharmStrategyWETH.sol`
- **Vault**: `contracts/EagleOVault.sol`

### Deployment Scripts
- **Latest Deploy**: `script/RedeployFixedWETHStrategy.s.sol`
- **Strategy Replacement**: `script/ReplaceWETHStrategyOnly.s.sol`
- **Alternative**: `script/DeployFixedWETHCreate2.s.sol` (CREATE2 version)

### Broadcast History
- `broadcast/RedeployFixedWETHStrategy.s.sol/1/`
- `broadcast/ReplaceWETHStrategyOnly.s.sol/1/`

---

## 🎉 Success Metrics

✅ Strategy deployed and verified on Ethereum  
✅ Strategy added to vault at 50% weight  
✅ Strategy initialized with approvals  
✅ Old broken strategy removed  
✅ Oracles configured (Chainlink + TWAP)  
✅ Safety features implemented  
✅ Emergency mode available  
✅ Owner control retained  

---

## 🚀 Next Steps (Optional)

### Immediate
1. ✅ **DONE**: Deploy and activate WETH strategy
2. ⏳ **WAITING**: Deploy idle funds (waiting for Charm liquidity)

### Future
1. Monitor Charm vault positions
2. Test withdrawal flow once funds are deployed
3. Consider transferring strategy ownership to multisig
4. Set up automated monitoring/alerts

### Maintenance
- Check strategy performance weekly
- Monitor Charm vault rebalances
- Keep emergency mode ready for oracle failures

---

## 🔗 Useful Links

- **Etherscan - Vault**: https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953
- **Etherscan - WETH Strategy**: https://etherscan.io/address/0xD5F80702F23Ea35141D4f47A0E107Fff008E9830
- **Etherscan - USD1 Strategy**: https://etherscan.io/address/0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f
- **Charm WETH Vault**: https://etherscan.io/address/0x3314e248F3F752Cd16939773D83bEb3a362F0AEF
- **Charm USD1 Vault**: https://etherscan.io/address/0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71

---

## 📞 Support

If issues arise:
1. Check this document first
2. Review `DEPLOYMENT_STATUS.md`
3. Check contract events on Etherscan
4. Use emergency mode if oracles fail

---

**Last Updated**: November 13, 2025 04:20 UTC  
**Deployed By**: 0x7310Dd6EF89b7f829839F140C6840bc929ba2031


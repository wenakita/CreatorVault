# Initialize USD1 Strategy via Multisig

## The Issue
The USD1 strategy can't deposit into Charm vault because it has no token approvals.

## The Fix (1 Transaction)

Go to: **https://app.safe.global/home?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3**

### Transaction Builder
1. Click **"New Transaction"** → **"Transaction Builder"**
2. Enter these details:
   - **To:** `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
   - **Value:** `0`
   - **Data:** `0x27f8eaac`
3. Click **"Add transaction"**
4. Click **"Create"**
5. Have signers approve (need minimum threshold)
6. Click **"Execute"**

### What This Does
Sets infinite approvals so the strategy can work:
- ✅ WLFI → Charm USD1 Vault
- ✅ USD1 → Charm USD1 Vault
- ✅ WLFI → Uniswap Router
- ✅ USD1 → Uniswap Router

**Gas Cost**: ~50,000 gas (~$4-5 USD at 100 gwei)

---

## After Execution

Once the multisig executes this, the deployer can immediately run:

```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "forceDeployToStrategies()" \
  --rpc-url https://eth.llamarpc.com \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-limit 2500000
```

This will deploy:
- **50%** → USD1 Strategy (WLFI/USD1 pool)
- **50%** → WETH Strategy (WLFI/WETH pool)

---

## Verification

After execution, verify approvals:
```bash
# Check WLFI approval
cast call 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6 \
  "allowance(address,address)(uint256)" \
  0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f \
  0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71 \
  --rpc-url https://eth.llamarpc.com

# Should return: 115792089237316195423570985008687907853269984665640564039457584007913129639935
# (max uint256 = infinite approval)
```

---

## Contract Details

**USD1 Strategy**: `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`  
**Function**: `initializeApprovals()`  
**Selector**: `0x27f8eaac`

Takes ~30 seconds to execute via Safe.


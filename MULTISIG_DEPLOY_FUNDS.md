# Deploy Funds via Multisig - Complete Flow

Go to: **https://app.safe.global/home?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3**

## Option A: Batch All 3 Transactions (Recommended)

Use **"Transaction Builder"** to batch all 3:

### Transaction 1: Initialize USD1 Strategy
- **To:** `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
- **Value:** `0`
- **Data:** `0x27f8eaac`

### Transaction 2: Accept Vault Management
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Value:** `0`
- **Data:** `0xc8c2fe6c`

### Transaction 3: Deploy Funds to Strategies
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Value:** `0`
- **Data:** `0x68e5ce84`

**Steps:**
1. Click "New Transaction" → "Transaction Builder"
2. Add all 3 transactions above (click "Add transaction" between each)
3. Review all 3 in the batch
4. Create → Sign → Execute

**What Happens:**
1. USD1 strategy gets approvals to work
2. Multisig takes control of vault
3. Funds deploy: 50% USD1 strategy, 50% WETH strategy

---

## Option B: Just Deploy (Deployer Keeps Control)

If you want the deployer to keep vault control, do these 2:

### Transaction 1: Initialize USD1 Strategy
- **To:** `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
- **Value:** `0`
- **Data:** `0x27f8eaac`

Then have the **deployer** run:
```bash
cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "forceDeployToStrategies()" \
  --rpc-url https://eth.llamarpc.com \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-limit 2500000
```

---

## Calldata Reference

For manual entry or verification:

| Function | Contract | Calldata |
|----------|----------|----------|
| initializeApprovals() | 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f | 0x27f8eaac |
| acceptManagement() | 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 | 0xc8c2fe6c |
| forceDeployToStrategies() | 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 | 0x68e5ce84 |

---

## After Execution

Funds will be deployed:
- **~3,473 WLFI + ~198 USD1** → USD1 Strategy (Charm WLFI/USD1 vault)
- **~3,473 WLFI + ~198 USD1** → WETH Strategy (Charm WLFI/WETH vault)

Both strategies will auto-rebalance and deposit into their respective Charm vaults.

**Total Gas**: ~1.5M gas (~$10-15 for all 3 transactions batched)


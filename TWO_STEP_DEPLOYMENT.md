# Two-Step Deployment (Safe UI)

## Step 1: Deploy to WETH Only

### Transaction 1a: Remove USD1 Strategy
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Value:** `0`
- **Data:** `0xa64c5a4a00000000000000000000000047b2659747d6a7e00c8251c3c3f7e92625a8cf6f`

### Transaction 1b: Deploy Funds (100% to WETH)
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Value:** `0`
- **Data:** `0x68e5ce84`

**Result**: All ~6,945 WLFI + ~396 USD1 deploys to WETH strategy

---

## Step 2: Add USD1 Strategy Back (Later)

### Transaction 2a: Add USD1 Strategy (50% weight)
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Value:** `0`
- **Data:** `0xc83dd2f900000000000000000000000047b2659747d6a7e00c8251c3c3f7e92625a8cf6f0000000000000000000000000000000000000000000000000000000000001388`

**Result**: USD1 strategy added with 5000 weight (50%), WETH auto-adjusts to 50%

---

## Execution in Safe

**Batch 1 (Now):**
1. Create new transaction
2. Transaction Builder
3. Add both 1a and 1b
4. Execute

**Batch 2 (Anytime later):**
1. Execute 2a when ready to balance

This approach guarantees success!


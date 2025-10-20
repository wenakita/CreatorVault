# 📜 Eagle Vault Scripts

## Production Scripts

### Deployment
- `deploy-fixed-charm-strategy.ts` - Deploy CharmStrategyUSD1
- `deploy-wrapper-production.ts` - Deploy EagleVaultWrapper
- `deploy-fixed-strategy.ts` - Deploy strategies

### Monitoring & Health Checks
- `check-current-vault-state.ts` - Check vault balances and status
- `check-charm-success.ts` - Verify Charm integration working
- `check-strategy-approvals.ts` - Verify token approvals
- `check-strategy-balances.ts` - Check strategy holdings
- `check-my-balance.ts` - Check deployer balance

### Configuration
- `set-deployment-threshold.ts` - Set auto-deploy threshold
- `increase-pool-cardinality.ts` - Increase Uniswap pool cardinality for TWAP

### Utilities
- `verify-charm-vault.ts` - Verify Charm vault configuration
- `check-both-pools.ts` - Check both WLFI/USD1 pools
- `find-usd1-wlfi-pools.ts` - Find Uniswap pools
- `simulate-deposit.ts` - Simulate vault deposits
- `check-uniswap-liquidity.ts` - Check pool liquidity

### Build Utilities
- `generate-contract-docs.js` - Generate contract documentation
- `create-docs-index.js` - Create documentation index
- `get-*-bytecode-hash.ts` - Get bytecode hashes for verification

---

## Archived Scripts

Old deployment and test scripts are in `scripts/archive/` directory.
These were used during development but are no longer needed for production.

---

## Usage

```bash
# Check vault status
npx hardhat run scripts/check-current-vault-state.ts --network ethereum

# Check Charm position
npx hardhat run scripts/check-charm-success.ts --network ethereum

# Check approvals
npx hardhat run scripts/check-strategy-approvals.ts --network ethereum
```

---

**Production Addresses:**
- Vault: `0x32a2544De7a644833fE7659dF95e5bC16E698d99`
- Strategy: `0xd286Fdb2D3De4aBf44649649D79D5965bD266df4`
- Wrapper: `0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03`


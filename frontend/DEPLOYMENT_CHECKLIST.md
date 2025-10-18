# Frontend Deployment Checklist

## ✅ Pre-Deployment

- [x] Contract addresses updated to vanity addresses (0x47...ea91e)
- [x] Balance validation added
- [x] Oracle prices verified working
- [x] Charm strategy verified initialized
- [x] Test deposits successful

## 📦 Build Process

```bash
cd frontend
npm install
npm run build
```

## 🔍 Verify Before Deploy

1. **Check contract addresses** in both config files:
   - `src/config/contracts.ts` 
   - `config/contracts.ts`
   - Should be: `0x47ff05aaf066f50baefdcfdcadf63d3762eea91e`

2. **Test locally**:
   ```bash
   npm run dev
   ```
   - Connect wallet (Ethereum Mainnet)
   - Try small deposit
   - Verify balance checks work
   - Check console for correct contract addresses

3. **Build for production**:
   ```bash
   npm run build
   ```

## 🚀 Deploy

### Option 1: Vercel
```bash
vercel --prod
```

### Option 2: Your hosting
Upload `dist/` folder contents

## 🔐 Environment Variables

Make sure these are set (if using):
```bash
VITE_VAULT_ADDRESS=0x47ff05aaf066f50baefdcfdcadf63d3762eea91e
VITE_WLFI_ADDRESS=0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6
VITE_USD1_ADDRESS=0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d
VITE_ETHEREUM_RPC=https://eth.llamarpc.com
```

## ✅ Post-Deployment Tests

1. **Network check**: Verify correct network detected
2. **Balance display**: Check token balances show correctly
3. **Deposit preview**: Verify oracle prices used
4. **Balance validation**: Try depositing more than balance
5. **Successful deposit**: Make actual small test deposit
6. **Large deposit**: Test deposit > $100 (should trigger Charm deployment)

## 📊 Monitor

- Check transaction success rate
- Monitor for error messages
- Verify Charm strategy deploys when deposits > $100
- Check vault total supply increases correctly

---

**Current Status: READY FOR DEPLOYMENT** ✅

All fixes applied, contracts verified, features tested.


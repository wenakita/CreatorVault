# Eagle Vault V2 - Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

All prerequisites are complete:
- ✅ Vercel configuration updated (Vite framework)
- ✅ Environment variables configured with VITE_ prefix
- ✅ V2 contract addresses added
- ✅ TypeScript errors fixed
- ✅ Build tested successfully (450KB bundle)
- ✅ Changes committed and pushed to GitHub

---

## 🚀 Deploy to Vercel (Dashboard Method)

### Step 1: Go to Vercel Dashboard
Visit: **https://vercel.com/new**

### Step 2: Import Your Repository
1. Click **"Add New..."** → **"Project"**
2. Select your Git provider (GitHub)
3. Find and select: **`wenakita/EagleOVaultV2`**
4. **Important**: Make sure you're deploying to **your personal account** (wenakita), NOT the AKITA-LLC team

### Step 3: Configure Project Settings

#### Framework Preset
- Should auto-detect as **Vite** ✅
- If not, manually select **Vite**

#### Root Directory
- Set to: **`frontend`** ✅

#### Build Settings (should be auto-filled)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 4: Add Environment Variables

Click **"Environment Variables"** and add each of these:

#### 🔑 Required Variables

```bash
VITE_WALLETCONNECT_PROJECT_ID=d93762120258cc136c10e2503d26bfdc
```

#### 📝 Contract Addresses (V2 - Ethereum Mainnet)

```bash
VITE_VAULT_ADDRESS=0x9e6AFd836fF239e5Ab5fa60DB7c01080bDd964FB
VITE_WRAPPER_ADDRESS=0xb0e07784c31a19354d420BdA23B6d91Cc250B53C
VITE_OFT_ADDRESS=0xa85287cEBc43e0ebb6CAF135A39079d97fE4d039
VITE_STRATEGY_ADDRESS=0x16C0F6696D7129468c455838632455200C1C4152
VITE_EAGLE_REGISTRY=0x472656c76f45e8a8a63fffd32ab5888898eea91e
VITE_CREATE2_FACTORY=0x695d6B3628B4701E7eAfC0bc511CbAF23f6003eE
```

#### 🪙 Token Addresses

```bash
VITE_WLFI_ADDRESS=0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747
VITE_USD1_ADDRESS=0x8C815948C41D2A87413E796281A91bE91C4a94aB
VITE_WETH_ADDRESS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

#### 🌐 RPC Endpoints

```bash
VITE_ETHEREUM_RPC=https://eu.endpoints.matrixed.link/rpc/ethereum?auth=p886of4gitu82
VITE_ARBITRUM_RPC=https://eu.endpoints.matrixed.link/rpc/arbitrum?auth=p886of4gitu82
VITE_BASE_RPC=https://eu.endpoints.matrixed.link/rpc/base?auth=p886of4gitu82
VITE_AVALANCHE_RPC=https://eu.endpoints.matrixed.link/rpc/avalanche?auth=p886of4gitu82
VITE_BSC_RPC=https://eu.endpoints.matrixed.link/rpc/bsc?auth=p886of4gitu82
```

#### 🔗 Uniswap & Oracles

```bash
VITE_USD1_PRICE_FEED=0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d
VITE_CHARM_VAULT_ADDRESS=0x3314e248f3f752cd16939773d83beb3a362f0aef
VITE_UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
```

#### 🔐 Google OAuth (Optional)

```bash
VITE_GOOGLE_CLIENT_ID=210963243141-0ud7vuqa1p7l2d17s94bam0q4gs65j7v.apps.googleusercontent.com
VITE_ALLOWED_DOMAIN=47eagle.com
```

**Pro Tip**: You can copy all these from `frontend/.env` file - just copy any line that starts with `VITE_`

### Step 5: Deploy! 🚀

1. Click **"Deploy"**
2. Wait ~30-60 seconds for the build to complete
3. Vercel will give you a URL like: `eagle-vault-v2.vercel.app`

---

## 📋 Post-Deployment Checklist

After deployment, test these features:

- [ ] Website loads correctly
- [ ] WalletConnect connects to Ethereum Mainnet
- [ ] Contract addresses are correct (check in browser console)
- [ ] Google Auth works (if enabled)
- [ ] Can view vault stats
- [ ] Deposit/withdraw interfaces load

---

## 🔧 Troubleshooting

### Build Fails
- Check that **Root Directory** is set to `frontend`
- Verify all environment variables are added
- Check build logs for specific errors

### Wrong Network
- Ensure you're using Ethereum Mainnet (Chain ID: 1)
- Check that `VITE_ETHEREUM_RPC` is set correctly

### Missing Contract Addresses
- Double-check all `VITE_*_ADDRESS` variables are set
- Verify addresses match V2 deployment (from V2_DEPLOYMENT.md)

### Environment Variables Not Working
- Make sure all variable names start with `VITE_`
- Redeploy after adding/changing variables

---

## 📝 Notes

- **Network**: Ethereum Mainnet (Chain ID: 1)
- **Deployment**: V2 - Production Ready
- **Build Time**: ~30-60 seconds
- **Bundle Size**: ~450KB (optimized)
- **Framework**: Vite (not Next.js)

---

## 🎉 Success!

Once deployed, your Eagle Vault V2 frontend will be live and accessible worldwide!

**Next Steps**:
1. Test all functionality on the live site
2. Add custom domain (optional)
3. Set up deployment notifications
4. Configure Vercel Analytics (optional)

---

**Deployed**: Ready to deploy!  
**Last Updated**: October 18, 2025  
**Eagle Vault Team** 🦅


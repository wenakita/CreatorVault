# 🚀 Production Deployment Guide

## ✅ Pre-Deployment Checklist

### **1. Smart Contracts** ✓
- [x] All contracts deployed to Base mainnet
- [x] Contract addresses hardcoded in `frontend/src/config/contracts.ts`
- [ ] Contracts verified on Basescan (recommended)

### **2. Environment Variables** 
- [ ] `VITE_CREATOR_VAULT_BATCHER` configured (onchain deploy + launch)
- [ ] Base RPC URL configured (or use default)

### **3. Frontend Code** ✓
- [x] All pages complete and tested
- [x] All ABIs correct and matching contracts
- [x] No console errors
- [x] Mobile responsive

---

## 🔧 Step 1: Set Up Environment Variables

### **Create Production Environment File**

```bash
cd frontend
cp .env.example .env.production
```

### **Edit `.env.production`**

**Required:**
```bash
# Onchain deploy + launch
VITE_CREATOR_VAULT_BATCHER=0xYourCreatorVaultBatcher

# Base mainnet RPC
VITE_BASE_RPC=https://mainnet.base.org
```

**Optional (paymaster sponsorship):**
```bash
# Get from https://portal.cdp.coinbase.com/
VITE_CDP_API_KEY=your_cdp_api_key_here
VITE_CDP_PAYMASTER_URL=...
```

**Optional (already hardcoded in contracts.ts):**
```bash
# Contract addresses - these are already in your code
# Only needed if you want to override them via env vars
VITE_REGISTRY_ADDRESS=0x777e28d7617ADb6E2fE7b7C49864A173e36881EF
VITE_FACTORY_ADDRESS=0x6205c91941A207A622fD00481b92cA04308a2819
# ... etc
```

---

## 📦 Step 2: Build for Production

### **Test Production Build Locally**

```bash
cd frontend

# Install dependencies (if not already)
npm install

# Run production build
npm run build

# Preview production build
npm run preview
```

This will:
1. Compile TypeScript
2. Bundle with Vite
3. Optimize assets
4. Output to `frontend/dist/`

**Expected output:**
```
✓ built in 15s
dist/index.html                   0.50 kB │ gzip:  0.32 kB
dist/assets/index-abc123.js     145.23 kB │ gzip: 45.67 kB
dist/assets/index-def456.css     12.34 kB │ gzip:  3.21 kB
```

### **Fix Any Build Errors**

Common issues:
- Type errors → Fix in TypeScript
- Missing dependencies → `npm install`
- Environment variables → Add to `.env.production`

---

## 🌐 Step 3: Deploy to Hosting

### **Option A: Vercel (Recommended)** ⭐

**Why Vercel?**
- Zero config for Vite apps
- Auto-deploys from GitHub
- Free SSL
- Global CDN
- Best for React apps

**Steps:**

1. **Push to GitHub**
```bash
cd /home/akitav2/projects/CreatorVault
git add -A
git commit -m "Ready for production deployment"
git push origin main
```

2. **Deploy to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repo
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Add Environment Variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add: `VITE_CDP_API_KEY=your_key_here`
   - Add: `VITE_BASE_RPC=https://mainnet.base.org`

4. **Deploy!**
   - Click "Deploy"
   - Wait 1-2 minutes
   - Your site is live at `https://your-project.vercel.app`

5. **Custom Domain (Optional)**
   - Settings → Domains
   - Add your custom domain (e.g., `creatorvault.app`)
   - Update DNS records as instructed

---

### **Option B: Netlify**

**Steps:**

1. **Install Netlify CLI**
```bash
npm install -g netlify-cli
```

2. **Build and Deploy**
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

3. **Or: Deploy via Dashboard**
   - Go to https://app.netlify.com/
   - Drag & drop your `frontend/dist` folder
   - Configure environment variables
   - Done!

---

### **Option C: GitHub Pages**

**Steps:**

1. **Update `vite.config.ts`**
```typescript
export default defineConfig({
  base: '/CreatorVault/', // Replace with your repo name
  // ... rest of config
})
```

2. **Build**
```bash
cd frontend
npm run build
```

3. **Deploy**
```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
"deploy": "gh-pages -d dist"

# Deploy
npm run deploy
```

Your site will be at: `https://yourusername.github.io/CreatorVault/`

---

### **Option D: Custom Server (VPS/AWS/etc)**

**Steps:**

1. **Build**
```bash
cd frontend
npm run build
```

2. **Upload `dist/` folder** to your server

3. **Configure Nginx/Apache**

**Nginx example:**
```nginx
server {
    listen 80;
    server_name creatorvault.app;
    root /var/www/creatorvault/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

4. **Setup SSL** with Let's Encrypt:
```bash
sudo certbot --nginx -d creatorvault.app
```

---

## ✅ Step 4: Post-Deployment Verification

### **1. Test Live Site**

Visit your production URL and test:

- [ ] Homepage loads correctly
- [ ] Connect wallet works
- [ ] Navigate to `/activate-akita`
- [ ] Navigate to `/dashboard`
- [ ] Navigate to `/vault/[address]`
- [ ] Navigate to `/auction/bid/[address]`
- [ ] All images/assets load
- [ ] No console errors

### **2. Test Wallet Connections**

- [ ] MetaMask connects
- [ ] WalletConnect works
- [ ] Coinbase Wallet works
- [ ] All on Base mainnet

### **3. Test Contract Interactions**

**Important: Use SMALL amounts for initial tests!**

- [ ] View vault balances
- [ ] Read auction status
- [ ] Connect Zora wallet
- [ ] Check AKITA balance shows correctly

### **4. Performance Check**

- [ ] Lighthouse score > 90
- [ ] Mobile responsive
- [ ] Fast load time (< 3s)

### **5. Security Check**

- [ ] HTTPS enabled (green padlock)
- [ ] No sensitive data in frontend code
- [ ] Contract addresses are correct
- [ ] API keys are environment variables (not hardcoded)

---

## 🎯 Step 5: Launch the CCA Auction

**After your site is live and tested:**

1. **Connect Your Zora Wallet**
   - Go to your production site
   - Click "Connect Wallet"
   - Select your Zora wallet

2. **Navigate to Activation**
   - Go to: `https://your-site.com/activate-akita`
   - Verify your AKITA balance shows correctly

3. **Launch Auction**
   - Set parameters (100M AKITA, 50%, 0.1 ETH)
   - Click "1. Approve Tokens"
   - Confirm in wallet
   - Click "2. Launch CCA"
   - Confirm in wallet
   - ✅ Auction is LIVE!

4. **Share with Community**
   - Tweet the auction link
   - Post in Discord/Telegram
   - Share on social media

---

## 📊 Step 6: Monitor & Maintain

### **Daily (During 7-Day Auction)**

- [ ] Check auction page: bids coming in?
- [ ] Monitor ETH raised
- [ ] Engage with community
- [ ] Answer questions

### **After 7 Days**

- [ ] Complete auction
- [ ] Winners claim tokens
- [ ] Vault goes live
- [ ] Monitor TVL growth

### **Ongoing**

- [ ] Monitor vault performance
- [ ] Track fee generation
- [ ] Plan future features
- [ ] Scale to more creators

---

## 🚨 Troubleshooting

### **Issue: CDP API Key Not Working**

**Solution:**
1. Verify key is correct in environment variables
2. Check key is active on https://portal.cdp.coinbase.com/
3. Regenerate key if needed
4. Redeploy with new key

### **Issue: Contracts Not Reading Correctly**

**Solution:**
1. Verify you're on Base mainnet (Chain ID: 8453)
2. Check contract addresses in `contracts.ts`
3. Verify RPC URL is working
4. Try alternative RPC (Alchemy, Infura, etc.)

### **Issue: Wallet Won't Connect**

**Solution:**
1. Check network is Base mainnet
2. Verify WalletConnect project ID (if using)
3. Try different wallet
4. Check browser console for errors

### **Issue: Build Fails**

**Solution:**
1. Run `npm install` again
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `npm run lint`
4. Verify all dependencies are installed

---

## 🎉 You're Ready to Deploy When:

- [x] Frontend builds successfully (`npm run build`)
- [x] Preview works locally (`npm run preview`)
- [ ] CDP API key obtained
- [ ] Environment variables configured
- [ ] Hosting platform chosen (Vercel/Netlify/etc)
- [ ] Domain configured (optional)
- [ ] Production site tested
- [ ] Contracts verified on Basescan (optional but recommended)

---

## 📝 Quick Deploy Commands

### **Vercel (Fastest)**
```bash
# One command deployment
cd frontend
npm install -g vercel
vercel --prod
```

### **Netlify**
```bash
cd frontend
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### **Manual**
```bash
cd frontend
npm run build
# Upload dist/ folder to your server
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to git
2. **Always use environment variables** for API keys
3. **Verify contract addresses** are correct
4. **Test with small amounts** first
5. **Enable 2FA** on hosting platform
6. **Use strong passwords** for all accounts
7. **Keep dependencies updated**: `npm audit fix`

---

## 🆘 Need Help?

**Before deploying:**
- Test everything locally first
- Read the build output for errors
- Check browser console for issues

**After deploying:**
- Monitor analytics for errors
- Set up error tracking (Sentry, etc.)
- Keep deployment logs accessible

---

## ✨ Final Checklist

- [ ] Code pushed to GitHub
- [ ] Production build tested locally
- [ ] Environment variables configured
- [ ] Deployed to hosting platform
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] All pages load correctly
- [ ] Wallet connections work
- [ ] Contract interactions tested
- [ ] Mobile responsive verified
- [ ] Performance optimized
- [ ] Security reviewed
- [ ] Ready to launch CCA! 🚀

---

## 🎯 Next Steps After Deployment

1. **Soft Launch** - Test with small group first
2. **Full Launch** - Activate CCA auction
3. **Marketing** - Share with community
4. **Support** - Be available for questions
5. **Iterate** - Gather feedback, improve
6. **Scale** - Onboard more creators

**You're ready to go live! 🚀**



# WalletConnect Setup Guide

Your frontend now uses **RainbowKit** with **WalletConnect v2**, giving users access to:
- 🦊 MetaMask
- 🔵 Coinbase Wallet  
- 🌈 Rainbow Wallet
- 📱 WalletConnect (scan QR with any wallet)
- And 300+ other wallets!

## 🚀 Quick Setup

### 1. Get a WalletConnect Project ID (FREE)

1. Go to [https://cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Sign up / Log in
3. Create a new project
4. Copy your **Project ID**

### 2. Add to Environment Variables

**Local Development** (`.env`):
```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Production** (Vercel):
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - Name: `VITE_WALLETCONNECT_PROJECT_ID`
   - Value: `your_project_id_here`
4. Redeploy

Or add to `frontend/.env.production`:
```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 3. Test It

```bash
cd frontend
npm run dev
```

Click "Connect Wallet" and you'll see all wallet options!

---

## 📦 What's Included

### Installed Packages
- ✅ `@rainbow-me/rainbowkit` - Beautiful wallet connection UI
- ✅ `wagmi` - React hooks for Ethereum
- ✅ `viem` - TypeScript Ethereum library
- ✅ `@tanstack/react-query` - Data fetching

### Features
- 🎨 Dark theme matching your brand
- 📱 Mobile responsive  
- 🔄 Auto network detection
- ⚠️ Wrong network warnings
- 🔌 Multi-wallet support
- 💾 Connection persistence

---

## 🎨 Customization

The theme is configured in `frontend/src/main.tsx`:

```typescript
<RainbowKitProvider theme={darkTheme({
  accentColor: '#3b82f6',  // Blue accent
  accentColorForeground: 'white',
  borderRadius: 'medium',
})}>
```

You can customize:
- `accentColor` - Primary color
- `borderRadius` - 'small' | 'medium' | 'large' | 'none'
- Or use `lightTheme()` instead

---

## 🔧 Troubleshooting

### "Please install MetaMask" message
- This only shows if no wallet is available AND WalletConnect isn't configured
- Add your Project ID to fix

### Wallets not showing
- Make sure `VITE_WALLETCONNECT_PROJECT_ID` is set
- Restart your dev server after adding env vars
- Check console for errors

### Network issues
- The app is configured for Ethereum Mainnet only
- Users will see a warning if on wrong network
- They can switch with one click

---

## 📚 Documentation

- [RainbowKit Docs](https://www.rainbowkit.com/docs/introduction)
- [Wagmi Docs](https://wagmi.sh)
- [WalletConnect Cloud](https://cloud.walletconnect.com)

---

## ✅ Migration Complete

Your app now uses:
- ✅ **Before:** Manual `window.ethereum` connection (MetaMask only)
- ✅ **After:** RainbowKit + WalletConnect (300+ wallets)

No breaking changes to your existing code - all components still work the same!


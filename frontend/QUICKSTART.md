# 🦅 Eagle Vault - Quick Start Guide

## 1️⃣ Install Dependencies (First Time Only)

```bash
cd frontend
npm install
```

This will install all required packages (~2-3 minutes).

## 2️⃣ Start Development Server

```bash
npm run dev
```

The app will open automatically at **http://localhost:3000**

## 3️⃣ Connect Your Wallet

1. Click "Connect Wallet" button
2. Approve MetaMask connection
3. Ensure you're on Ethereum Mainnet

## 4️⃣ Try It Out!

### Deposit to Vault
1. Go to "Deposit / Withdraw" tab
2. Enter WLFI and USD1 amounts
3. Click "Deposit to Vault"
4. Approve tokens and confirm transaction
5. Receive vEAGLE shares!

### Wrap to EAGLE
1. Go to "Wrap / Unwrap" tab
2. Enter vEAGLE amount
3. Click "Wrap to EAGLE"
4. Receive tradable EAGLE tokens!

### View Strategy
1. Go to "Strategy Stats" tab
2. See Charm vault performance
3. Monitor token breakdown

## 🎨 What You'll See

- **Hero Section** - Eagle branding with status badges
- **Live Stats** - 5 cards showing vault metrics (updates every 15s)
- **Interactive Tabs** - Deposit, Wrap, and Strategy views
- **Info Cards** - Learn how Eagle Vault works
- **Dark Theme** - Beautiful eagle-themed colors

## 🚀 Deploy to Production

### Build

```bash
npm run build
```

Creates optimized production build in `dist/` folder.

### Deploy Options

**Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Netlify**
```bash
npm install -g netlify-cli
netlify deploy
```

**GitHub Pages**
1. Push to GitHub
2. Enable Pages in Settings
3. Point to `dist/` folder

**IPFS**
```bash
# Upload dist/ folder to IPFS
# Use Fleek, Pinata, or ipfs-deploy
```

## 🔧 Configuration

### Update Contract Addresses

Edit `src/config/contracts.ts` if you redeploy contracts:

```typescript
export const CONTRACTS = {
  VAULT: '0xYourVaultAddress',
  OFT: '0xYourOFTAddress',
  // ...
}
```

### Change Colors

Edit `tailwind.config.js`:

```js
colors: {
  eagle: {
    500: '#ed721f', // Your primary color
    // ...
  }
}
```

### Add Custom RPC

Create `.env` file:

```env
VITE_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Then update code to use it:

```typescript
const provider = new BrowserProvider(
  window.ethereum || process.env.VITE_RPC_URL
);
```

## 📱 Mobile Support

The frontend is fully responsive and works on:
- 📱 Mobile phones
- 📱 Tablets
- 💻 Desktop
- 🖥️ Large screens

## 🐛 Troubleshooting

### Wallet won't connect?
- Install MetaMask extension
- Switch to Ethereum Mainnet
- Refresh page

### Transactions failing?
- Check you have enough tokens
- Ensure token approvals worked
- Check gas prices

### Stats not loading?
- Check console for errors (F12)
- Verify contract addresses
- Check RPC connection

### Build errors?
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📚 Learn More

- **React Docs:** https://react.dev
- **Vite Docs:** https://vitejs.dev
- **ethers.js Docs:** https://docs.ethers.org
- **Tailwind Docs:** https://tailwindcss.com

## 🎯 Development Tips

### Hot Reload
Changes auto-refresh in browser! Edit any component and see updates instantly.

### Component Structure
```
App.tsx (Main)
├── Header (Navigation)
├── VaultStats (5 stat cards)
└── Tabs
    ├── DepositTab
    ├── WrapTab
    └── StrategyTab
```

### Adding New Features
1. Create component in `src/components/`
2. Import in `App.tsx`
3. Add to UI
4. Test with MetaMask

### Debugging
- Open console (F12)
- Check network tab for transactions
- Use `console.log()` liberally

## 🎉 You're Ready!

Your Eagle Vault frontend is production-ready:
- ✅ Beautiful UI
- ✅ Full functionality
- ✅ Mobile responsive
- ✅ Wallet integration
- ✅ Real-time stats

**Start building:** `npm run dev`

**Questions?** Check the main README.md for detailed docs!

---

Built with ❤️ for Eagle Vault 🦅


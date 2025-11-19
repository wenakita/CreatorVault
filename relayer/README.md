# 🌉 EAGLE Bridge Relayer

**Automatic bridge between Ethereum and Solana for EAGLE tokens**

---

## 📋 Overview

This relayer automatically detects EAGLE burns on Ethereum and mints the equivalent amount on Solana for linked wallet addresses.

**Flow**:
```
User burns EAGLE on Ethereum
    ↓
Relayer detects burn event
    ↓
Relayer mints EAGLE on Solana
    ↓
User receives EAGLE in Phantom wallet
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
nano .env
```

**Required Variables**:
```env
# Ethereum
ETHEREUM_RPC=https://eth.llamarpc.com
ETHEREUM_PRIVATE_KEY=your_relayer_private_key

# Solana
SOLANA_RPC=https://api.mainnet-beta.solana.com
SOLANA_PROGRAM_ID=3973MRkbN9E3GW4TnE9A8VzAgNxWAVRSAFVW4QQktAkb
SOLANA_MINT=5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j
SOLANA_WALLET_PATH=/home/user/.config/solana/relayer.json

# Contract
EAGLE_SHARE_OFT_ADDRESS=0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
```

### 3. Test Connection
```bash
npm test
```

**Expected Output**:
```
🧪 Testing Bridge Connections
==================================================

📡 Testing Ethereum Connection...
✅ Connected to Ethereum
   RPC: https://eth.llamarpc.com
   Block: 21234567
   EAGLE Total Supply: 1000000.0

📡 Testing Solana Connection...
✅ Connected to Solana
   RPC: https://api.mainnet-beta.solana.com
   Version: 1.18.22
   EAGLE Mint: 5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j
   Decimals: 9
   Supply: 0 EAGLE

==================================================
✅ Connection test complete!
```

### 4. Link User Wallets
```bash
# Link your wallet
npm run link link 0xYOUR_ETH_ADDRESS YOUR_SOLANA_ADDRESS

# List all linked wallets
npm run link list

# Remove a link
npm run link unlink 0xYOUR_ETH_ADDRESS
```

### 5. Start Relayer
```bash
# Development mode (with logs)
npm start

# Production mode (with PM2)
pm2 start npm --name "eagle-bridge" -- start
pm2 logs eagle-bridge
```

---

## 📁 Project Structure

```
relayer/
├── src/
│   ├── ethereum-to-solana.ts    # Main relayer service
│   ├── link-wallets.ts          # Wallet linking CLI tool
│   └── test-connection.ts       # Connection testing
├── package.json
├── .env.example                 # Environment template
└── user-mappings.json           # User wallet links (auto-created)
```

---

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start relayer in foreground |
| `npm run dev` | Start with auto-reload (development) |
| `npm test` | Test Ethereum + Solana connections |
| `npm run link link <ETH> <SOL>` | Link user wallets |
| `npm run link list` | Show all linked wallets |
| `npm run link unlink <ETH>` | Remove wallet link |

---

## 🧪 Testing

### Test Ethereum → Solana Bridge

1. **Link your wallet**:
```bash
npm run link link 0xYOUR_ADDRESS YOUR_SOLANA_ADDRESS
```

2. **Start relayer**:
```bash
npm start
```

3. **Burn EAGLE on Ethereum**:
```bash
cast send 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E \
  "burn(address,uint256)" \
  YOUR_ADDRESS \
  "1000000000000000000" \
  --rpc-url https://eth.llamarpc.com \
  --private-key YOUR_PRIVATE_KEY
```

4. **Watch relayer logs**:
```
🔥 EAGLE Burn Detected!
   User: 0xYOUR_ADDRESS
   Amount: 1.0 EAGLE
   Block: 21234567
   Tx: 0x...

🌉 Bridging to Solana...
   Amount: 1.0 EAGLE
   Solana recipient: YOUR_SOLANA_ADDRESS
   Token account: ABC...xyz
   Minting 1000000000 EAGLE (9 decimals)...
✅ Minted on Solana!
   Signature: 5Q7...abc
   Explorer: https://solscan.io/tx/5Q7...abc
```

5. **Verify on Solana**:
```bash
spl-token accounts 5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j
```

---

## 📊 Monitoring

### Check Balances
```bash
# Relayer SOL balance
solana balance $(solana-keygen pubkey ~/.config/solana/relayer.json)

# Relayer ETH balance
cast balance YOUR_RELAYER_ADDRESS
```

### View Logs (PM2)
```bash
pm2 logs eagle-bridge
pm2 monit
```

### Check Supply
```bash
# Ethereum EAGLE supply
cast call 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E "totalSupply()"

# Solana EAGLE supply
spl-token supply 5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j
```

---

## ⚙️ Configuration

### Decimal Conversion
- **Ethereum**: 18 decimals (1 EAGLE = 10^18 wei)
- **Solana**: 9 decimals (1 EAGLE = 10^9 base units)
- **Conversion**: `solanaAmount = ethAmount / 10^9`

### Rate Limiting
- Max operations per day: 1000 (configurable)
- Cooldown between operations: 60s (configurable)

### Gas Requirements
- **Ethereum**: User pays gas (~$5-30 to burn)
- **Solana**: Relayer pays (~$0.000005 to mint)

---

## 🐛 Troubleshooting

### "No Solana wallet linked"
**Fix**: User must link wallets first
```bash
npm run link link ETH_ADDRESS SOLANA_ADDRESS
```

### "Connection timeout"
**Fix**: Check RPC endpoints
```bash
npm test  # Test connections
```

### "Insufficient funds for mint"
**Fix**: Add SOL to relayer wallet
```bash
solana balance RELAYER_ADDRESS
# Send 0.1 SOL if balance is low
```

### "Not authorized to mint"
**Fix**: Transfer mint authority to relayer
```bash
spl-token authorize \
  5uCkww45tQ3BSninZHpPEvj22bs294SAPoQSgFpUid5j \
  mint \
  RELAYER_PUBKEY
```

---

## 🔒 Security

### Best Practices
- ✅ Keep relayer private key secure
- ✅ Use dedicated wallet for relayer
- ✅ Monitor balances regularly
- ✅ Set up alerts for low balances
- ✅ Review linked wallets periodically

### Permissions
- **Ethereum**: Relayer needs minter role (for reverse bridge)
- **Solana**: Relayer must be mint authority

---

## 📈 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start relayer
pm2 start npm --name "eagle-bridge" -- start

# Set up auto-restart
pm2 save
pm2 startup

# Monitor
pm2 monit
pm2 logs eagle-bridge
```

### Using systemd
```bash
# Create service file
sudo nano /etc/systemd/system/eagle-bridge.service

# Enable and start
sudo systemctl enable eagle-bridge
sudo systemctl start eagle-bridge
sudo systemctl status eagle-bridge
```

---

## 📝 Notes

- Bridging takes 5-30 seconds (depending on block confirmation)
- Users must link wallets before their first bridge operation
- Relayer requires ~0.1 SOL for transaction fees (lasts for ~20,000 transactions)
- For Solana→Ethereum direction, see `HYBRID_SYSTEM_CORRECTED.md`

---

## 🆘 Support

- **Logs**: `pm2 logs eagle-bridge`
- **Config**: `cat .env`
- **Test**: `npm test`
- **Full Guide**: See `../BRIDGE_SETUP_GUIDE.md`

---

**Ready to bridge?** 🚀

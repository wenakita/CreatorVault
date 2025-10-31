# 🔒 Production Security Setup Guide

**Agent 4: Security Review**  
**Environment:** Ethereum Mainnet (LIVE)  
**Status:** Setup Required

---

## 📋 Quick Start

### 1. Verify Production Deployment

```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs

# Run comprehensive security verification
./scripts/security/verify-production.sh
```

This will check:
- ✅ All contracts owned by multisig
- ✅ Strategy configuration
- ✅ Vault state (not paused/shutdown)
- ✅ Price oracle health
- ✅ Configuration correctness

### 2. Start 24/7 Monitoring

```bash
# Install dependencies if needed
npm install

# Set up environment variables
cp .env.production .env

# Add alert credentials (IMPORTANT!)
cat >> .env << EOF

# Discord Webhook (for alerts)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK

# Telegram Bot (for alerts)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# PagerDuty (for CRITICAL alerts)
PAGERDUTY_INTEGRATION_KEY=your_pagerduty_key
EOF

# Start monitoring (keep this running 24/7!)
npx ts-node scripts/monitoring/production-alerts.ts
```

### 3. Set Up External Monitoring

#### A. Tenderly Setup

1. Go to https://dashboard.tenderly.co/
2. Add contract: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953` (Vault)
3. Create alerts:
   - Large deposits (>10 ETH equivalent)
   - Large withdrawals (>10% TVL)
   - Admin function calls
   - Failed transactions
   - Emergency pause events

#### B. OpenZeppelin Defender Setup

1. Go to https://defender.openzeppelin.com/
2. Add contracts (all 5)
3. Set up Sentinel for:
   - Ownership changes
   - Minter role changes
   - Strategy modifications
   - Price deviations
4. Configure automatic notifications

---

## 🚨 Critical Security Checks

### Immediate Actions (Do Now)

```bash
# 1. Verify multisig ownership
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "owner()(address)" \
  --rpc-url https://eth.llamarpc.com
# Must return: 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3

# 2. Verify multisig configuration
cast call 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  "getThreshold()(uint256)" \
  --rpc-url https://eth.llamarpc.com
# Should be at least 3

cast call 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  "getOwners()(address[])" \
  --rpc-url https://eth.llamarpc.com
# Verify all signers

# 3. Verify vault is not paused
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "paused()(bool)" \
  --rpc-url https://eth.llamarpc.com
# Must return: false

# 4. Check strategy allocation
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "totalStrategyWeight()(uint256)" \
  --rpc-url https://eth.llamarpc.com
# Should return: 10000 (100%)

# 5. Verify only wrapper can mint OFT
# (Implementation depends on OFT contract)
```

### Daily Security Checks

Create a daily checklist:

```bash
#!/bin/bash
# Save as scripts/security/daily-check.sh

echo "=== Daily Security Check ==="
echo "Date: $(date)"

echo -n "1. Vault owner: "
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "owner()(address)" --rpc-url https://eth.llamarpc.com

echo -n "2. Vault paused: "
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "paused()(bool)" --rpc-url https://eth.llamarpc.com

echo -n "3. Vault shutdown: "
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "isShutdown()(bool)" --rpc-url https://eth.llamarpc.com

echo -n "4. TVL: "
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "totalAssets()(uint256)" --rpc-url https://eth.llamarpc.com | xargs cast --to-unit - ether

echo -n "5. Price deviation: "
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 "getOraclePoolPriceDelta()(int256)" --rpc-url https://eth.llamarpc.com

echo ""
echo "✅ Daily check complete"
```

Run daily:
```bash
chmod +x scripts/security/daily-check.sh
./scripts/security/daily-check.sh
```

---

## 📊 Monitoring Dashboard Setup

### Metrics to Track

#### Real-Time Metrics

1. **Total Value Locked (TVL)**
   ```bash
   cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     "totalAssets()(uint256)" --rpc-url https://eth.llamarpc.com
   ```

2. **Share Price (PPS)**
   ```bash
   # totalAssets / totalSupply
   ```

3. **Active Users**
   ```bash
   # Count unique depositors/withdrawers
   ```

4. **Strategy Performance**
   ```bash
   cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     "getStrategyAssets()(address[],uint256[],uint256[])" \
     --rpc-url https://eth.llamarpc.com
   ```

#### Security Metrics

1. **Price Deviation**
   ```bash
   cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     "getOraclePoolPriceDelta()(int256)" --rpc-url https://eth.llamarpc.com
   ```

2. **Failed Transactions** (monitor via Etherscan)

3. **Large Transactions** (>10 ETH equivalent)

4. **Admin Actions** (any owner/manager function calls)

### Grafana Dashboard (Optional)

Set up Grafana with:
- Ethereum node metrics
- Custom metrics from monitoring script
- Alert thresholds
- Historical data

---

## 🔔 Alert Configuration

### Alert Levels & Responses

| Level | Trigger | Response Time | Action |
|-------|---------|---------------|--------|
| 🔴 CRITICAL | Oracle deviation >10% | <5 min | PagerDuty + Team call |
| 🔴 CRITICAL | Vault paused | <5 min | Immediate investigation |
| 🟠 HIGH | Large withdrawal >10% TVL | <15 min | Monitor closely |
| 🟠 HIGH | Oracle deviation 5-10% | <15 min | Verify prices |
| 🟡 MEDIUM | Failed transactions >5/hr | <1 hour | Investigation |
| 🟢 INFO | Deposit/Withdrawal | Log only | Track metrics |

### Communication Channels

```bash
# Priority 1: PagerDuty (CRITICAL only)
# - Calls all team members
# - Requires acknowledgment

# Priority 2: Telegram (HIGH/CRITICAL)
# - Security team group
# - Instant notifications

# Priority 3: Discord (MEDIUM+)
# - #security-alerts channel
# - Team coordination

# Priority 4: Email (ALL)
# - Daily digest
# - Weekly reports
```

---

## 🔐 Access Control

### Multisig Signer Responsibilities

Each signer must:

1. **Keep hardware wallet secure**
   - Use hardware wallet (Ledger/Trezor)
   - Store in safe location
   - Never share seed phrase

2. **Respond to emergencies**
   - Available 24/7
   - <10 minute response for CRITICAL
   - Understand emergency procedures

3. **Verify all transactions**
   - Never sign blindly
   - Verify transaction data
   - Coordinate with team

4. **Regular drills**
   - Monthly emergency drills
   - Test hardware wallet access
   - Review procedures

### Emergency Contact Info

| Signer | Telegram | Phone | Backup |
|--------|----------|-------|--------|
| Signer 1 | [TO FILL] | [TO FILL] | [TO FILL] |
| Signer 2 | [TO FILL] | [TO FILL] | [TO FILL] |
| Signer 3 | [TO FILL] | [TO FILL] | [TO FILL] |
| Signer 4 | [TO FILL] | [TO FILL] | [TO FILL] |
| Signer 5 | [TO FILL] | [TO FILL] | [TO FILL] |

---

## 🎯 First Week Checklist

### Day 1 (Launch Day)
- [ ] Run security verification script
- [ ] Start 24/7 monitoring
- [ ] Verify multisig access (all signers)
- [ ] Set up Tenderly alerts
- [ ] Set up OZ Defender
- [ ] Test emergency pause procedure
- [ ] Post launch announcement
- [ ] Monitor first deposits intensely

### Day 2-3
- [ ] Review first 24h of activity
- [ ] Verify strategy performance
- [ ] Check oracle accuracy
- [ ] Monitor for any anomalies
- [ ] Daily team standup
- [ ] Update monitoring thresholds if needed

### Day 4-7
- [ ] Comprehensive audit of first week
- [ ] Review all transactions
- [ ] Analyze gas costs
- [ ] Strategy performance review
- [ ] Security incident drill
- [ ] Document any issues found
- [ ] Prepare week 1 report

---

## 📈 Gradual Scale-Up Plan

### Phase 1: Limited (Week 1)
- **Max TVL:** $100,000
- **Monitoring:** 24/7 intensive
- **Team:** All hands on deck
- **Strategy:** 100% to CharmStrategy

### Phase 2: Controlled (Week 2-4)
- **Max TVL:** $500,000
- **Monitoring:** 24/7 standard
- **Team:** On-call rotation
- **Strategy:** Consider diversification

### Phase 3: Standard (Month 2+)
- **Max TVL:** $2,000,000
- **Monitoring:** 24/7 automated
- **Team:** Standard ops
- **Strategy:** Fully optimized

### Phase 4: Scale (Month 3+)
- **Max TVL:** Unlimited
- **Monitoring:** 24/7 enterprise
- **Team:** Dedicated security
- **Strategy:** Multi-strategy

**⚠️ Do not rush! Each phase requires 100% confidence before proceeding.**

---

## 🐛 Bug Bounty Program

### Setup Immunefi

1. Go to https://immunefi.com/
2. Create bug bounty program
3. Set rewards:
   - **Critical:** Up to $100,000
   - **High:** Up to $25,000
   - **Medium:** Up to $5,000
   - **Low:** Up to $1,000

4. Scope:
   - All 5 deployed contracts
   - Price oracle manipulation
   - Strategy exploits
   - Access control bypass
   - Fund loss scenarios

5. Out of scope:
   - Frontend issues
   - Known issues (see KNOWN_RISKS.md)
   - Gas optimizations
   - Code style

---

## 📚 Documentation

All security documents:

1. **PRODUCTION_SECURITY_AUDIT.md** - Comprehensive security audit
2. **PRODUCTION_INCIDENT_RESPONSE.md** - Emergency procedures
3. **PRODUCTION_SECURITY_SETUP.md** - This file
4. **KNOWN_RISKS.md** - Known vulnerabilities and mitigations

Keep these updated as system evolves!

---

## ✅ Security Setup Checklist

- [ ] Ran verification script successfully
- [ ] Monitoring running 24/7
- [ ] Tenderly alerts configured
- [ ] OZ Defender configured
- [ ] All multisig signers verified access
- [ ] Emergency contacts distributed
- [ ] Daily check script scheduled
- [ ] Bug bounty program launched
- [ ] Team trained on procedures
- [ ] Incident response plan reviewed
- [ ] First deposits monitored successfully

---

## 🔗 Useful Links

### Production Contracts
- Vault: https://etherscan.io/address/0x47b3ef629d9cb8dfcf8a6c61058338f4e99d7953
- OFT: https://etherscan.io/address/0x474ed38c256a7fa0f3b8c48496ce1102ab0ea91e
- Wrapper: https://etherscan.io/address/0x47dac5063c526dbc6f157093dd1d62d9de8891c5
- Strategy: https://etherscan.io/address/0x47b2659747d6a7e00c8251c3c3f7e92625a8cf6f
- Multisig: https://etherscan.io/address/0xe5a1d534eb7f00397361f645f0f39e5d16cc1de3

### Tools
- Gnosis Safe: https://app.safe.global/eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3
- Tenderly: https://dashboard.tenderly.co/
- OZ Defender: https://defender.openzeppelin.com/

### Community
- Telegram: https://t.me/Eagle_community_47
- Twitter: https://x.com/TeamEagle47
- Keybase: https://keybase.io/47eagle

---

**Last Updated:** October 31, 2025  
**Security Agent:** Agent 4  
**Status:** 🔴 PRODUCTION ACTIVE


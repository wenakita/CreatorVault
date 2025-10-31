# 🚨 Eagle OVault Production Incident Response Plan

**Environment:** Ethereum Mainnet (LIVE)  
**Last Updated:** October 31, 2025  
**Status:** 🔴 ACTIVE

---

## ⚡ EMERGENCY CONTACTS

### Security Team (24/7 Availability)

| Role | Contact Method | Response Time |
|------|----------------|---------------|
| **Security Lead** | [TO CONFIGURE] | <5 min |
| **Multisig Signer 1** | [TO CONFIGURE] | <10 min |
| **Multisig Signer 2** | [TO CONFIGURE] | <10 min |
| **Multisig Signer 3** | [TO CONFIGURE] | <10 min |
| **Technical Lead** | [TO CONFIGURE] | <15 min |

### Communication Channels

- **CRITICAL**: PagerDuty → SMS → Voice Call
- **Telegram**: [Security Team Channel]
- **Discord**: [Emergency Channel]
- **Multisig**: https://app.safe.global/eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3

---

## 🚫 INCIDENT SEVERITY LEVELS

### CRITICAL (P0) - Immediate Action Required

**Examples:**
- Active exploit draining funds
- Oracle manipulation attack
- Unauthorized access to admin functions
- Strategy failure causing loss
- Price deviation >10%

**Response Time:** <5 minutes  
**Team:** All hands on deck  
**Decision Authority:** Security Lead or any 2 multisig signers

### HIGH (P1) - Urgent Action Needed

**Examples:**
- Suspicious large withdrawals
- Price deviation 5-10%
- Failed strategy operations
- Unusual transaction patterns
- Monitoring system failure

**Response Time:** <15 minutes  
**Team:** Security team + relevant engineers  
**Decision Authority:** Security Lead

### MEDIUM (P2) - Investigation Required

**Examples:**
- Multiple failed transactions
- Oracle staleness warning
- Moderate price volatility
- Performance degradation

**Response Time:** <1 hour  
**Team:** Security team  
**Decision Authority:** Security Lead

### LOW (P3) - Monitoring

**Examples:**
- Minor price fluctuations
- Small deposits/withdrawals
- System health checks

**Response Time:** Next business day  
**Team:** On-call engineer  
**Decision Authority:** On-call engineer

---

## 🔴 CRITICAL INCIDENT PROCEDURES

### Scenario 1: Active Exploit / Funds at Risk

#### Immediate Actions (0-5 minutes)

1. **ALERT TEAM**
   ```bash
   # Trigger PagerDuty alert
   # ALL HANDS ON DECK
   ```

2. **PAUSE VAULT IMMEDIATELY**
   
   **Multisig Action Required:**
   ```solidity
   // Prepare transaction in Gnosis Safe
   To: 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 (Vault)
   Function: setPaused(bool)
   Parameter: true
   ```
   
   **Emergency Command:**
   ```bash
   cast calldata "setPaused(bool)" true
   # Result: 0x16c38b3c0000000000000000000000000000000000000000000000000000000000000001
   
   # Submit to multisig:
   # https://app.safe.global/eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3
   ```

3. **GATHER EVIDENCE**
   ```bash
   # Get recent transactions
   cast logs \
     --address 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     --from-block $(cast block-number --rpc-url https://eth.llamarpc.com)-100 \
     --rpc-url https://eth.llamarpc.com
   
   # Save to file
   cast logs --address 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     --from-block $(cast block-number --rpc-url https://eth.llamarpc.com)-100 \
     --rpc-url https://eth.llamarpc.com > incident_$(date +%s).log
   ```

4. **PUBLIC NOTIFICATION**
   - Post on Twitter: "Eagle OVault is investigating a potential security issue. Vault paused as precaution."
   - Update Telegram/Discord: "CRITICAL: Vault paused. Team investigating. Updates every 15 minutes."

#### Investigation Phase (5-30 minutes)

1. **Identify Attack Vector**
   ```bash
   # Analyze exploit transaction
   cast tx <EXPLOIT_TX_HASH> --rpc-url https://eth.llamarpc.com
   
   # Trace transaction
   cast run <EXPLOIT_TX_HASH> --rpc-url https://eth.llamarpc.com
   ```

2. **Assess Damage**
   ```bash
   # Check TVL
   cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     "totalAssets()(uint256)" --rpc-url https://eth.llamarpc.com
   
   # Check strategy balances
   cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
     "getStrategyAssets()(address[],uint256[],uint256[])" \
     --rpc-url https://eth.llamarpc.com
   ```

3. **Determine Next Steps**
   - Can funds be recovered?
   - Is the exploit still possible?
   - Do we need to shutdown permanently?
   - Can we deploy a fix?

#### Recovery Phase (30 minutes - hours)

**Option A: If exploit patched and safe to resume**

1. Deploy fix (if contract upgrade possible)
2. Test thoroughly on testnet
3. Unpause vault via multisig
4. Monitor intensely for 48 hours
5. Public disclosure

**Option B: If funds need emergency withdrawal**

```bash
# Emergency withdraw from strategy (multisig)
cast calldata "emergencyWithdraw(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f
```

**Option C: If permanent shutdown required**

```bash
# Shutdown strategy (multisig)
cast calldata "shutdownStrategy(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f

# Allow users to withdraw remaining funds
# Keep monitoring for orderly exit
```

---

### Scenario 2: Oracle Manipulation Attack

#### Detection
```bash
# Price deviation >5%
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "getOraclePoolPriceDelta()(int256)" --rpc-url https://eth.llamarpc.com
```

#### Immediate Response

1. **Verify if real attack**
   - Check multiple oracle sources
   - Check Uniswap pool reserves
   - Check for flash loan activity
   
   ```bash
   # Check pool reserves
   cast call 0x[UNISWAP_POOL] "slot0()" --rpc-url https://eth.llamarpc.com
   ```

2. **If confirmed manipulation**
   - PAUSE VAULT (see above)
   - Wait for price to stabilize
   - Investigate if any unfair mints occurred

3. **If false alarm (legitimate volatility)**
   - Continue monitoring
   - Alert team of volatility
   - Consider temporary deposit limits

---

### Scenario 3: Strategy Failure

#### Detection
```bash
# Strategy returns 0 or reverts
cast call 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \
  "getStrategyAssets()(address[],uint256[],uint256[])" \
  --rpc-url https://eth.llamarpc.com
```

#### Response

1. **Check Charm Vault Status**
   ```bash
   # Check if Charm vault is operational
   cast call 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71 \
     "totalAssets()(uint256)" --rpc-url https://eth.llamarpc.com
   ```

2. **Emergency Withdraw (Multisig)**
   ```bash
   # Withdraw all funds from failing strategy
   cast calldata "emergencyWithdraw(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f
   ```

3. **Remove Strategy (Multisig)**
   ```bash
   # Remove strategy from vault
   cast calldata "removeStrategy(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f
   ```

4. **Assess Recovery**
   - Were funds recovered?
   - Any losses to report?
   - Can we deploy alternative strategy?

---

### Scenario 4: Unauthorized Access Attempt

#### Detection
- Ownership change detected
- Unauthorized admin function call
- Unexpected minter addition

#### Response

1. **VERIFY IMMEDIATELY**
   ```bash
   # Check all ownership
   ./scripts/security/verify-production.sh
   ```

2. **If Unauthorized Change Confirmed**
   - **THIS IS CRITICAL**
   - Multisig keys may be compromised
   - Pause everything
   - Emergency team meeting
   - Forensic investigation
   - Public disclosure ASAP

3. **Preventive Measures**
   - Rotate all compromised keys
   - Review all multisig signers
   - Implement additional security
   - Consider contract migration

---

## 📋 INCIDENT RESPONSE CHECKLIST

### Initial Response (0-5 min)
- [ ] Alert logged with timestamp
- [ ] Security team notified
- [ ] Incident severity assessed
- [ ] Initial containment action taken
- [ ] Evidence collection started

### Investigation (5-30 min)
- [ ] Root cause identified
- [ ] Damage assessed
- [ ] Attack vector documented
- [ ] Recovery plan determined
- [ ] Team brief completed

### Containment (30-60 min)
- [ ] Immediate threat neutralized
- [ ] Systems secured
- [ ] No ongoing exploitation
- [ ] User funds protected
- [ ] Public notification issued

### Recovery (Hours)
- [ ] Fix deployed/planned
- [ ] Systems tested
- [ ] Operations resumed (if safe)
- [ ] Monitoring enhanced
- [ ] Post-mortem scheduled

### Post-Incident (Days)
- [ ] Full post-mortem completed
- [ ] Public disclosure published
- [ ] Affected users compensated
- [ ] Preventive measures implemented
- [ ] Documentation updated

---

## 📞 MULTISIG EMERGENCY PROCEDURES

### Quick Access
**Gnosis Safe URL:** https://app.safe.global/eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3

### Emergency Transaction Preparation

```bash
# Generate transaction data for common emergencies

# 1. PAUSE VAULT
cast calldata "setPaused(bool)" true

# 2. UNPAUSE VAULT  
cast calldata "setPaused(bool)" false

# 3. EMERGENCY WITHDRAW FROM STRATEGY
cast calldata "emergencyWithdraw(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f

# 4. SHUTDOWN STRATEGY
cast calldata "shutdownStrategy(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f

# 5. REMOVE STRATEGY
cast calldata "removeStrategy(address)" 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f
```

### Multisig Signing Process

1. **Proposer** creates transaction in Safe UI
2. **Signers** receive notification
3. Minimum threshold must sign (e.g., 3 of 5)
4. **Executor** executes after threshold met

**⚠️ CRITICAL: Keep multisig credentials secure!**

---

## 📊 INCIDENT REPORTING

### Internal Report Template

```markdown
# Incident Report: [TITLE]

**Date:** [DATE]
**Severity:** [P0/P1/P2/P3]
**Status:** [Active/Resolved/Monitoring]

## Summary
[Brief description]

## Timeline
- [TIME] - Detection
- [TIME] - Response initiated
- [TIME] - Containment
- [TIME] - Resolution

## Impact
- Users affected: [NUMBER]
- Funds at risk: [AMOUNT]
- Downtime: [DURATION]

## Root Cause
[Analysis]

## Actions Taken
1. [ACTION]
2. [ACTION]

## Preventive Measures
1. [MEASURE]
2. [MEASURE]

## Lessons Learned
[Key takeaways]
```

### Public Disclosure Template

```markdown
# Eagle OVault Security Incident - [DATE]

## What Happened
[User-friendly explanation]

## User Impact
[Who was affected and how]

## Actions Taken
[What we did to fix it]

## User Actions Required
[What users need to do, if anything]

## Compensation
[If applicable]

## Preventive Measures
[What we're doing to prevent recurrence]

## Contact
security@eagleovault.com
```

---

## 🔧 MONITORING & ALERTING

### Active Monitoring Script

```bash
# Start production monitoring (KEEP RUNNING 24/7)
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs
npx ts-node scripts/monitoring/production-alerts.ts
```

### Alert Escalation

| Time | Severity | Action |
|------|----------|--------|
| 0 min | CRITICAL | PagerDuty → All team members |
| 5 min | CRITICAL | If no response, escalate to CEO |
| 15 min | CRITICAL | If unresolved, public notification |
| 30 min | ALL | Status update required |

---

## ✅ PREPAREDNESS CHECKLIST

### Before Launch
- [ ] All team members have emergency contact info
- [ ] Multisig signers know their responsibilities
- [ ] Emergency procedures tested in staging
- [ ] Monitoring system is 24/7 operational
- [ ] Communication channels set up
- [ ] PagerDuty configured

### Regular Drills (Monthly)
- [ ] Test emergency pause procedure
- [ ] Verify multisig access for all signers
- [ ] Review incident response steps
- [ ] Update contact information
- [ ] Test monitoring alerts
- [ ] Review and update procedures

---

**This is a LIVING DOCUMENT. Update after every incident and drill.**

**Last Drill:** [TO BE SCHEDULED]  
**Next Drill:** [TO BE SCHEDULED]  
**Document Owner:** Security Team


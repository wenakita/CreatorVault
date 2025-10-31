# 🤖 Agent Briefing - READ THIS FIRST

**MANDATORY: All AI agents MUST read this file before starting any work**

---

## 📢 Latest Updates & Important Information

**Last Updated:** October 31, 2025

### 🔥 CRITICAL UPDATES

#### 1. ⭐ ETHEREUM MAINNET ONLY (FRESH DEPLOYMENT)
- ⚠️ **CRITICAL:** This is a FRESH deployment - we will generate NEW addresses
- 🎯 **SCOPE:** Ethereum mainnet ONLY (no other chains yet)
- ❌ **DO NOT use old address:** `0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61` (already cleaned)
- ✅ **DO deploy fresh:** All NEW addresses on Ethereum mainnet
- The NEW addresses will be determined during deployment
- Other chains (BSC, Arbitrum, Base, Avalanche) will come later

**Deployment Scope:**
```
✅ DEPLOYING NOW:  Ethereum mainnet only
⏳ LATER:          BSC, Arbitrum, Base, Avalanche (with CREATE2 for same OFT address)

OLD (cleaned):     0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
NEW (to deploy):   Will be generated during deployment
```

#### 2. 🏗️ EagleRegistry Pattern (Dynamic Configuration)
- **LayerZero endpoints are NOT hardcoded in contracts**
- All contracts query `EagleRegistry` for LayerZero endpoints
- Registry deployed FIRST on each chain
- See `REGISTRY_PATTERN.md` for full details

**Why this matters:**
```solidity
// ❌ DON'T assume hardcoded endpoints
address endpoint = 0x1a44076050125825900e736c501f859c50fE728c;

// ✅ DO query registry
address endpoint = registry.getLayerZeroEndpoint(chainId);
```

#### 3. 🧹 Clean Deployment (No Old Addresses)
- We are doing a FRESH redeployment
- All old addresses have been cleaned
- Use `pnpm clean:addresses` to verify
- See `REDEPLOYMENT_GUIDE.md`

#### 4. 🎯 Agent 0 (Orchestrator) Coordinates Deployment
- **NEW:** Agent 0 will guide the user through deployment
- Agents 2, 3, 4 focus on preparation (backend, testing, security)
- Agent 0 validates all deliverables before deployment
- Agent 0 guides through 7 deployment phases
- See `AGENT_0_ORCHESTRATOR.md` for full details

---

## 🎯 Architecture Quick Reference

### Core Components

1. **EagleOVault** (Ethereum only)
   - ERC4626 vault
   - Accepts WLFI + USD1
   - Issues vEAGLE shares

2. **EagleVaultWrapper** (Ethereum only)
   - Wraps vEAGLE ↔ EAGLE (1:1)
   - Custom pattern (NOT standard OFTAdapter)
   - Enables same token on all chains

3. **EagleShareOFT** (ALL chains)
   - LayerZero OFT token
   - **SAME address on all 5 chains** (via CREATE2)
   - Cross-chain transfers

4. **EagleRegistry** (ALL chains)
   - Configuration management
   - Stores LayerZero endpoints
   - **Deploy FIRST on each chain**

5. **CharmStrategyUSD1** (Ethereum only)
   - Yield strategy
   - Integrates with Charm Finance

### Deployment Order

```
1. EagleRegistry (all chains) → FIRST!
2. Configure registry (set endpoints)
3. EagleOVault (Ethereum)
4. CharmStrategy (Ethereum)
5. EagleVaultWrapper (Ethereum)
6. EagleShareOFT (all chains)
```

---

## 📋 Required Reading for All Agents

**Before starting work, read these files in order:**

1. **`AGENT_INSTRUCTIONS.md`** - Your role and scope
2. **`AGENT_BRIEFING.md`** - This file (latest updates)
3. **`ARCHITECTURE_OVERVIEW.md`** - System architecture
4. **`MULTI_AGENT_DEPLOYMENT_V2.md`** - Your specific prompt

**Optional but helpful:**
- `REGISTRY_PATTERN.md` - Registry pattern details
- `CREATE2_DEPLOYMENT_GUIDE.md` - Same address deployment
- `REDEPLOYMENT_GUIDE.md` - Fresh deployment process

---

## 🚨 Common Mistakes to Avoid

### ❌ DON'T:
1. Assume LayerZero endpoints are hardcoded
2. Forget that EagleShareOFT must have same address on all chains
3. Use old contract addresses (we're redeploying fresh)
4. Deploy contracts before EagleRegistry
5. Hardcode configuration that should be in registry
6. Create deployment scripts (Agent 1 already did this)
7. Overlap with other agents' work

### ✅ DO:
1. Query EagleRegistry for LayerZero endpoints
2. Verify same address on all chains for EagleShareOFT
3. Use placeholders for contract addresses (TBD after deployment)
4. Deploy EagleRegistry FIRST
5. Use registry for all configuration
6. Stay in your assigned scope
7. Read all required documentation

---

## 🎯 Agent-Specific Notes

### Agent 2 (Backend + Prisma)
**Special considerations:**
- Track both vEAGLE (vault shares) AND EAGLE (OFT tokens)
- Index wrap/unwrap events from EagleVaultWrapper
- Support multi-chain (Ethereum + 4 spokes)
- EagleShareOFT has SAME address on all chains
- Query EagleRegistry for configuration

**Database models needed:**
- User (address, deposits, withdrawals)
- Deposit (amount, token, txHash, chainId)
- Withdrawal (amount, shares, txHash, chainId)
- WrapEvent (user, shares, tokens, txHash)
- UnwrapEvent (user, tokens, shares, txHash)
- CrossChainTransfer (fromChain, toChain, amount, lzMessageId)
- VaultSnapshot (tvl, sharePrice, timestamp)
- RegistryConfig (chainId, endpoint, lastUpdated)

### Agent 3 (Testing)
**Special considerations:**
- Test EagleVaultWrapper wrap/unwrap (1:1 ratio)
- Test EagleRegistry endpoint lookup
- Verify same address on all chains for EagleShareOFT
- Test full flow: deposit → wrap → bridge → unwrap → withdraw
- Test registry configuration updates

**Test scenarios:**
- Registry returns correct endpoint
- Contracts use registry (not hardcoded)
- Same OFT address on all chains
- Wrap/unwrap maintains 1:1 ratio
- Cross-chain transfers work

### Agent 4 (Security)
**Special considerations:**
- Audit EagleRegistry access control
- Verify only owner can update registry
- Check contracts properly query registry
- Audit CREATE2 deployment for same address
- Verify LayerZero peer configuration

**Security checks:**
- Registry can't be manipulated
- Endpoint updates require owner
- CREATE2 salt is secure
- Same address verified on all chains
- No hardcoded endpoints in contracts

---

## 📊 Current Project Status

### ✅ Completed
- Agent 1: Documentation & deployment scripts
- Contracts compiled and tested
- Architecture documented
- Cleanup scripts created

### ⏳ Pending
- Agent 2: Backend + Prisma (waiting to start)
- Agent 3: Testing suite (waiting to start)
- Agent 4: Security audit (waiting to start)
- Fresh deployment (after agents complete)

### 🎯 Goal
Complete production-ready system with:
- Backend indexing all chains
- Comprehensive test suite
- Security audit complete
- Ready for deployment

---

## 🔗 External Contracts (Reference Only)

**These are production addresses - DO NOT CHANGE:**

| Contract | Address | Network |
|----------|---------|---------|
| WLFI Token | `0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6` | Ethereum |
| USD1 Token | `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d` | Ethereum |
| Charm Vault | `0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71` | Ethereum |
| USD1 Price Feed | `0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d` | Ethereum |

**LayerZero V2 Endpoints (stored in EagleRegistry):**
- All chains: `0x1a44076050125825900e736c501f859c50fE728c`

---

## 💡 Key Architectural Decisions

### 1. Why EagleVaultWrapper Instead of OFTAdapter?
- Same EAGLE token on all chains
- Consistent address via CREATE2
- Better UX (always "EAGLE", not "vEAGLE" on hub)
- See `ARCHITECTURE_DECISION.md`

### 2. Why EagleRegistry Pattern?
- No hardcoded LayerZero endpoints
- Easy to upgrade LayerZero version
- Centralized configuration
- See `REGISTRY_PATTERN.md`

### 3. Why CREATE2 for Same Address?
- Trust and transparency
- Easier verification
- Professional appearance
- See `CREATE2_DEPLOYMENT_GUIDE.md`

---

## 📞 Questions or Clarifications?

If you encounter something unclear:

1. **Check documentation:**
   - `ARCHITECTURE_OVERVIEW.md` - System design
   - `REGISTRY_PATTERN.md` - Registry details
   - `CREATE2_DEPLOYMENT_GUIDE.md` - Same address
   - `AGENT_INSTRUCTIONS.md` - Your scope

2. **Verify your understanding:**
   - EagleRegistry provides endpoints ✓
   - EagleShareOFT same address on all chains ✓
   - Deploy registry FIRST ✓
   - Stay in your scope ✓

3. **Proceed with confidence:**
   - You have all the information needed
   - Documentation is comprehensive
   - Your scope is clearly defined

---

## ✅ Checklist Before Starting

- [ ] I have read `AGENT_INSTRUCTIONS.md`
- [ ] I have read `AGENT_BRIEFING.md` (this file)
- [ ] I have read `ARCHITECTURE_OVERVIEW.md`
- [ ] I understand the EagleRegistry pattern
- [ ] I know EagleShareOFT must have same address on all chains
- [ ] I know we're doing a fresh redeployment
- [ ] I understand my specific agent role
- [ ] I will stay in my scope
- [ ] I will not overlap with other agents

---

## 🎉 Ready to Start!

You now have all the information needed to:
- Understand the architecture
- Know the latest updates
- Avoid common mistakes
- Work within your scope
- Create production-ready code

**Let's build something amazing! 🚀**

---

**Last Updated:** October 31, 2025  
**Version:** v1.0  
**Next Update:** When new critical information needs to be communicated to all agents


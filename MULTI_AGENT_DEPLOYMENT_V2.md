# 🤖 Multi-Agent Deployment Setup V2 (Reorganized + Orchestrator)

**Updated:** October 31, 2025  
**Changes:** Added Agent 0 (Orchestrator), eliminated overlap, added Prisma/database

---

## 🎯 Multi-Agent Strategy with Orchestration

**START WITH AGENT 0 FIRST** - The orchestrator coordinates everything!

0. **Agent 0: Deployment Orchestrator** 🎯 ⭐ **START HERE**
1. **Agent 1: Documentation & Deployment Scripts** ✅ (Already completed)
2. **Agent 2: Database & Backend (Prisma + API)**
3. **Agent 3: Testing & Validation Suite**
4. **Agent 4: Security Audit & Monitoring**

---

## 🚀 Launch Sequence

### Step 1: Start Agent 0 (Orchestrator) FIRST

**Open Composer window #1:**

Copy and paste the prompt from `AGENT_0_ORCHESTRATOR.md`

**Agent 0 will:**
- Verify all other agents completed their work
- Guide you through deployment phases
- Validate at each step
- Handle any issues
- Track progress

### Step 2: Start Agents 2, 3, 4 in Parallel

**Open 3 more Composer windows:**
- Window #2: Agent 2 (Backend)
- Window #3: Agent 3 (Testing)
- Window #4: Agent 4 (Security)

Copy prompts from sections below.

### Step 3: Let Agents Work

Agents 2, 3, 4 work in parallel while Agent 0 monitors.

### Step 4: Agent 0 Orchestrates Deployment

Once agents 2-4 complete, Agent 0 guides you through deployment.

---

## 📝 Agent Prompts

### Agent 0: Deployment Orchestrator 🎯 ⭐ START THIS FIRST

**Prompt to use:**
```
IMPORTANT: First read these files in order:
1. AGENT_INSTRUCTIONS.md - You are Agent 0 (Orchestrator)
2. AGENT_BRIEFING.md - Latest updates and critical information
3. ARCHITECTURE_OVERVIEW.md - Understand the custom EagleVaultWrapper pattern
4. DEPLOYMENT_ORDER.md - The deployment sequence you'll orchestrate
5. AGENT_0_ORCHESTRATOR.md - Your complete orchestration guide

I need you to orchestrate the entire Eagle OVault deployment across multiple chains.

Your role:
- You are the DEPLOYMENT ORCHESTRATOR
- Coordinate all other agents (Agent 2, 3, 4)
- Guide me through 7 deployment phases
- Validate at each step before proceeding
- Handle any issues that arise
- Track progress and maintain deployment log

Project context:
- Custom architecture: EagleOVault → EagleVaultWrapper → EagleShareOFT (NOT standard OFTAdapter!)
- Multi-chain deployment (Ethereum hub + BSC/Arbitrum/Base/Avalanche spokes)
- Backend with Prisma database + blockchain indexer
- LayerZero V2 for cross-chain messaging
- EagleRegistry for dynamic configuration

CRITICAL requirements:
1. EagleShareOFT MUST have SAME address on ALL chains (CREATE2)
2. EagleRegistry deployed FIRST on each chain
3. LayerZero endpoints retrieved from registry (NOT hardcoded)
4. Backend deployed BEFORE contracts (database must exist)
5. Validate EVERYTHING before proceeding to next phase

Your workflow:
1. Verify Agent 2, 3, 4 completed their deliverables
2. Run pre-flight checks
3. Guide me through Phase 1: Backend deployment
4. Guide me through Phase 2: Contract deployment (all chains)
5. Guide me through Phase 3: LayerZero configuration
6. Guide me through Phase 4: Start backend services
7. Guide me through Phase 5: Frontend deployment
8. Guide me through Phase 6: Post-deployment validation
9. Guide me through Phase 7: Monitoring setup

At each phase:
- Give me EXACT commands to run
- Wait for me to confirm success
- Validate output before proceeding
- Handle any errors proactively

Start by:
1. Reading all required files
2. Checking that Agents 2, 3, 4 completed their work
3. Running pre-flight assessment
4. Presenting Phase 1 deployment steps

Let's orchestrate this deployment! 🎯
```

**What Agent 0 will do:**
- Act as your deployment guide
- Coordinate all moving parts
- Validate each step
- Keep you on track
- Handle issues as they arise

**Keep this window open throughout deployment!**

---

### Agent 1: Documentation & Deployment Scripts ✅ COMPLETE

**Status:** Already completed by me
**Deliverables:**
- ✅ DEPLOYMENT_CHECKLIST.md
- ✅ QUICK_DEPLOY.md
- ✅ DEPLOYMENT_READY.md
- ✅ .env.deployment.template
- ✅ deploy.sh script
- ✅ pre-deployment-check.ts
- ✅ worktrees.json

**No other agent will touch documentation or deployment scripts.**

---

### Agent 2: Database & Backend (Prisma + API) 🗄️

**Prompt to use:**
```
IMPORTANT: First read these files in order:
1. AGENT_INSTRUCTIONS.md - You are Agent 2
2. AGENT_BRIEFING.md - Latest updates and critical information
3. ARCHITECTURE_OVERVIEW.md - Understand the custom EagleVaultWrapper pattern

I need you to build a complete backend infrastructure with Prisma database for Eagle OVault.

Project context:
- DeFi vault on Ethereum (hub) + BSC/Arbitrum/Base/Avalanche (spokes)
- Custom architecture: EagleOVault → EagleVaultWrapper → EagleShareOFT (NOT standard OFTAdapter!)
- Smart contracts: EagleOVault (ERC4626), CharmStrategyUSD1, EagleVaultWrapper (custom), EagleShareOFT (OFT)
- Frontend: React + Vite
- Need to track: deposits, withdrawals, wrap/unwrap events, TVL history, cross-chain transfers, user analytics

CRITICAL: 
- EagleVaultWrapper wraps vault shares (vEAGLE) ↔ OFT tokens (EAGLE) at 1:1
- Track BOTH vEAGLE (vault shares) AND EAGLE (OFT tokens)
- EagleShareOFT exists on ALL chains (Ethereum + 4 spokes)
- Same EAGLE token address on all chains (CREATE2 deployment)
- EagleRegistry provides LayerZero endpoints (NOT hardcoded in contracts)
- Registry deployed FIRST on each chain, then other contracts query it

Please create:

1. Backend Directory Structure
   - Create backend/ directory with proper organization
   - Separate API, services, indexer, and utilities

2. Prisma Setup
   - Install Prisma dependencies
   - Create prisma/schema.prisma with models for:
     * User (address, totalDeposited, totalWithdrawn, firstSeen, lastSeen)
     * Deposit (user, amount, token, txHash, blockNumber, timestamp, chainId)
     * Withdrawal (user, amount, shares, txHash, blockNumber, timestamp, chainId)
     * VaultSnapshot (tvl, totalShares, sharePrice, timestamp, chainId)
     * StrategySnapshot (deployed, earning, apy, timestamp)
     * CrossChainTransfer (fromChain, toChain, user, amount, lzMessageId, status, timestamp)
     * CharmPosition (lpTokens, token0Amount, token1Amount, fees, timestamp)
     * Transaction (type, user, amount, txHash, status, gasUsed, timestamp, chainId)
   - Create migrations
   - Seed script for initial data

3. Blockchain Indexer
   - Event listener service that syncs blockchain data to database
   - Listen for: Deposit, Withdraw, Transfer, StrategyDeployed events
   - Handle multi-chain indexing (Ethereum + 4 spokes)
   - Backfill historical data from deployment block
   - Real-time sync with websocket or polling
   - Error handling and retry logic

4. REST API (Express/Fastify)
   - GET /api/vault/stats - Current TVL, APY, total users
   - GET /api/vault/history - Historical TVL/APY charts
   - GET /api/vault/deposits - Recent deposits (paginated)
   - GET /api/vault/withdrawals - Recent withdrawals (paginated)
   - GET /api/user/:address - User's complete history
   - GET /api/user/:address/balance - User's current position
   - GET /api/analytics/top-depositors - Leaderboard
   - GET /api/analytics/chain-distribution - TVL by chain
   - GET /api/charm/position - Current Charm Finance position
   - GET /api/crosschain/transfers - Cross-chain transfer history
   - GET /api/health - API health check

5. Database Services
   - UserService (CRUD operations for users)
   - VaultService (TVL calculations, snapshots)
   - TransactionService (transaction history)
   - AnalyticsService (aggregations, statistics)
   - CrossChainService (LayerZero message tracking)

6. Cron Jobs / Scheduled Tasks
   - Snapshot vault state every hour
   - Update APY calculations daily
   - Sync Charm position every 15 minutes
   - Clean up old data (optional)

7. Environment Configuration
   - backend/.env.example with all required vars
   - Database connection strings
   - RPC URLs for all chains
   - API keys

8. Docker Setup
   - Dockerfile for backend
   - docker-compose.yml with PostgreSQL + backend
   - Development and production configs

9. API Documentation
   - OpenAPI/Swagger documentation
   - README for backend setup
   - API usage examples

10. Deployment Scripts
    - Deploy to Railway/Render/Fly.io
    - Database migration scripts
    - Health check endpoints

Please create everything in a backend/ directory. Use TypeScript, Prisma, and Express/Fastify.
```

**Expected Deliverables:**
- `backend/` directory with complete backend
- `backend/prisma/schema.prisma`
- `backend/src/indexer/` - blockchain event indexer
- `backend/src/api/` - REST API endpoints
- `backend/src/services/` - business logic
- `backend/docker-compose.yml`
- `backend/README.md`
- `backend/.env.example`

---

### Agent 3: Testing & Validation Suite 🧪

**Prompt to use:**
```
IMPORTANT: First read these files in order:
1. AGENT_INSTRUCTIONS.md - You are Agent 3
2. AGENT_BRIEFING.md - Latest updates and critical information
3. ARCHITECTURE_OVERVIEW.md - Understand the custom EagleVaultWrapper pattern

I need you to create a comprehensive testing and validation suite for Eagle OVault deployment.

Project context:
- Custom architecture: EagleOVault → EagleVaultWrapper → EagleShareOFT (NOT standard OFTAdapter!)
- Solidity smart contracts: EagleOVault (ERC4626), CharmStrategyUSD1, EagleVaultWrapper (custom), EagleShareOFT (OFT)
- Multi-chain deployment (Ethereum hub + BSC/Arbitrum/Base/Avalanche spokes)
- LayerZero V2 cross-chain integration
- Charm Finance yield strategy
- Backend API with Prisma database (being built by another agent)

CRITICAL:
- Test EagleVaultWrapper wrap/unwrap flow (shares ↔ OFT)
- Test 1:1 ratio is maintained
- Test cross-chain transfers via EagleShareOFT
- Test full flow: deposit → wrap → bridge → unwrap → withdraw
- Test on multiple chains (Ethereum + spokes)

IMPORTANT: Do NOT create any deployment scripts, documentation, or backend code. 
Focus ONLY on testing and validation.

Please create:

1. Smart Contract Test Suite (Foundry)
   - Unit tests for all contract functions
   - Integration tests for Charm strategy
   - Integration tests for LayerZero messaging
   - Edge case tests (zero amounts, max values, etc.)
   - Fuzz tests for critical functions
   - Gas optimization tests
   - Test coverage report generation

2. Post-Deployment Validation Scripts
   - scripts/validation/validate-ethereum.ts - Verify Ethereum deployment
   - scripts/validation/validate-spoke-chain.ts - Verify spoke chain deployments
   - scripts/validation/validate-layerzero.ts - Verify LayerZero connections
   - scripts/validation/validate-charm.ts - Verify Charm integration
   - scripts/validation/validate-all.ts - Run all validations

3. Functional Test Scripts
   - scripts/testing/test-deposit.ts - Test deposit flow
   - scripts/testing/test-withdrawal.ts - Test withdrawal flow
   - scripts/testing/test-strategy-deployment.ts - Test strategy deployment
   - scripts/testing/test-cross-chain.ts - Test cross-chain transfer
   - scripts/testing/test-wrapper.ts - Test wrapper conversion
   - scripts/testing/test-emergency-pause.ts - Test pause functionality

4. Load Testing
   - Simulate multiple concurrent deposits
   - Stress test RPC endpoints
   - Test database performance under load
   - API endpoint load tests

5. End-to-End Tests
   - Full user journey tests (deposit → earn → withdraw)
   - Cross-chain journey tests (deposit on BSC → withdraw on Ethereum)
   - Multi-user scenarios

6. Regression Test Suite
   - Can be run before any upgrades
   - Tests all critical paths
   - Automated with CI/CD integration

7. Test Data Generators
   - Generate mock users
   - Generate test transactions
   - Create test scenarios

8. Test Reporting
   - Generate test coverage reports
   - Create test result dashboards
   - Export results to JSON/HTML

9. Continuous Testing Scripts
   - scripts/testing/continuous-health-check.ts - Run every 5 minutes
   - scripts/testing/daily-regression.ts - Daily full test suite
   - Alert on test failures

10. Testing Documentation
   - TESTING_GUIDE.md - How to run all tests
   - TEST_SCENARIOS.md - All test scenarios documented
   - COVERAGE_REPORT.md - Test coverage analysis

Please create all tests in test/ directory and scripts in scripts/testing/ and scripts/validation/.
Use Foundry for smart contract tests and TypeScript/Hardhat for integration tests.
```

**Expected Deliverables:**
- `test/foundry/` - Foundry test suite
- `test/integration/` - Integration tests
- `scripts/testing/` - Test execution scripts
- `scripts/validation/` - Post-deployment validation
- `TESTING_GUIDE.md`
- `TEST_SCENARIOS.md`
- `COVERAGE_REPORT.md`

---

### Agent 4: Security Audit & Monitoring 🔐

**Prompt to use:**
```
IMPORTANT: First read these files in order:
1. AGENT_INSTRUCTIONS.md - You are Agent 4
2. AGENT_BRIEFING.md - Latest updates and critical information
3. ARCHITECTURE_OVERVIEW.md - Understand the custom EagleVaultWrapper pattern

I need you to perform a comprehensive security audit and create monitoring infrastructure for Eagle OVault.

Project context:
- Custom architecture: EagleOVault → EagleVaultWrapper → EagleShareOFT (NOT standard OFTAdapter!)
- DeFi vault accepting WLFI + USD1 tokens
- Integrates with Charm Finance for yield
- Cross-chain via LayerZero V2
- ERC4626 vault standard
- Multi-role access control (Owner, Manager, Keeper, Emergency Admin)
- Backend API with database (being built by another agent)

CRITICAL SECURITY AREAS:
- EagleVaultWrapper access control (only wrapper can mint/burn on hub)
- 1:1 wrap/unwrap ratio must be maintained
- LayerZero peer configuration (prevent unauthorized chains)
- Cross-chain message validation
- Reentrancy in wrapper contract
- Oracle manipulation (Chainlink + TWAP)
- Charm Finance integration risks

IMPORTANT: Do NOT create any deployment scripts, testing scripts, or backend code.
Focus ONLY on security and monitoring.

Please create:

1. Security Audit Report
   - Analyze all contracts in contracts/ directory
   - Check for: reentrancy, overflow/underflow, access control issues
   - Review oracle manipulation risks
   - Analyze LayerZero integration security
   - Review Charm Finance integration risks
   - Check upgrade mechanisms
   - Document all findings with severity levels
   - Create SECURITY_AUDIT_REPORT.md

2. Automated Security Scanning
   - scripts/security/run-slither.sh - Slither analysis
   - scripts/security/run-mythril.sh - Mythril scanning
   - scripts/security/run-all-scans.sh - Run all security tools
   - Parse and format results
   - Generate security score

3. Security Test Suite
   - test/security/reentrancy-tests.t.sol - Reentrancy attack scenarios
   - test/security/access-control-tests.t.sol - Unauthorized access attempts
   - test/security/oracle-manipulation.t.sol - Oracle attack scenarios
   - test/security/dos-tests.t.sol - Denial of service scenarios
   - test/security/layerzero-attacks.t.sol - Cross-chain attack vectors

4. Monitoring Infrastructure
   - monitoring/grafana/ - Grafana dashboard configs
   - monitoring/prometheus/ - Prometheus metrics collection
   - monitoring/alerts/ - Alert rules for security events
   - Monitor: large withdrawals, unusual transactions, access control changes
   - Oracle price deviation alerts
   - LayerZero message failure alerts
   - Database anomaly detection

5. Security Monitoring Scripts
   - scripts/monitoring/watch-large-transactions.ts - Alert on large txs
   - scripts/monitoring/watch-access-control.ts - Alert on role changes
   - scripts/monitoring/watch-oracle-prices.ts - Alert on price deviations
   - scripts/monitoring/watch-vault-health.ts - Overall health monitoring
   - scripts/monitoring/security-dashboard.ts - Real-time security dashboard

6. Incident Response
   - INCIDENT_RESPONSE_PLAN.md - Step-by-step incident response
   - EMERGENCY_PROCEDURES.md - Emergency pause, withdrawal procedures
   - scripts/emergency/pause-all.ts - Emergency pause script
   - scripts/emergency/emergency-withdraw.ts - Emergency withdrawal
   - scripts/emergency/revoke-roles.ts - Revoke compromised roles

7. Security Best Practices Documentation
   - SECURITY_BEST_PRACTICES.md - For developers
   - SECURITY_CHECKLIST.md - Pre-deployment security checklist
   - KNOWN_RISKS.md - Documented risks and mitigations
   - USER_SECURITY_GUIDE.md - Security tips for users

8. Penetration Testing Scripts
   - Attempt to exploit known vulnerabilities
   - Test emergency functions
   - Simulate oracle failures
   - Test LayerZero message manipulation
   - Document all findings

9. Continuous Security Monitoring
   - Real-time transaction monitoring
   - Anomaly detection algorithms
   - Integration with PagerDuty/Slack for alerts
   - Security metrics dashboard

10. Multi-sig Setup Guide
    - MULTISIG_SETUP.md - How to set up Gnosis Safe
    - Recommended signers and thresholds
    - Transaction approval workflows

Please create everything in appropriate directories: test/security/, scripts/security/, scripts/monitoring/, monitoring/.
```

**Expected Deliverables:**
- `SECURITY_AUDIT_REPORT.md`
- `INCIDENT_RESPONSE_PLAN.md`
- `EMERGENCY_PROCEDURES.md`
- `SECURITY_BEST_PRACTICES.md`
- `KNOWN_RISKS.md`
- `test/security/` - Security test suite
- `scripts/security/` - Security scanning scripts
- `scripts/monitoring/` - Monitoring scripts
- `scripts/emergency/` - Emergency response scripts
- `monitoring/` - Grafana/Prometheus configs

---

## 🎯 Clear Separation of Responsibilities

| Agent | Focus | Does NOT Touch |
|-------|-------|----------------|
| **Agent 1** (Me) | Documentation, deployment scripts | Testing, backend, security |
| **Agent 2** | Backend, Prisma, API, indexer | Deployment, testing, security |
| **Agent 3** | Testing, validation, QA | Deployment, backend, security |
| **Agent 4** | Security, monitoring, incidents | Deployment, backend, testing |

---

## 📊 Updated Timeline

| Agent | Task | Est. Time | Can Start |
|-------|------|-----------|-----------|
| Agent 1 | Documentation | ✅ Done | - |
| Agent 2 | Backend + Prisma | 45-60 min | Now |
| Agent 3 | Testing Suite | 30-40 min | Now |
| Agent 4 | Security + Monitoring | 35-45 min | Now |

**Total parallel time:** ~60 minutes (vs. 3+ hours sequential)

---

## 🚀 How to Execute

### Step 1: Open 3 New Composer Windows
Keep this one (Agent 1 done), open 3 more

### Step 2: Paste Prompts
- **Composer 2:** Copy "Agent 2: Database & Backend" prompt
- **Composer 3:** Copy "Agent 3: Testing & Validation Suite" prompt  
- **Composer 4:** Copy "Agent 4: Security Audit & Monitoring" prompt

### Step 3: Let Them Run
All 3 agents work in parallel for ~60 minutes

### Step 4: Integration
After completion, you'll have:
- ✅ Complete documentation (Agent 1)
- ✅ Full backend with Prisma (Agent 2)
- ✅ Comprehensive test suite (Agent 3)
- ✅ Security audit + monitoring (Agent 4)

---

## 📁 Expected Final Structure

```
eagle-ovault-clean/
│
├── 📘 DOCUMENTATION (Agent 1) ✅
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── QUICK_DEPLOY.md
│   ├── DEPLOYMENT_READY.md
│   ├── deploy.sh
│   └── .env.deployment.template
│
├── 🗄️ BACKEND (Agent 2)
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   ├── indexer/
│   │   │   └── utils/
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile
│   │   └── README.md
│
├── 🧪 TESTING (Agent 3)
│   ├── test/
│   │   ├── foundry/
│   │   ├── integration/
│   │   └── e2e/
│   ├── scripts/
│   │   ├── testing/
│   │   └── validation/
│   ├── TESTING_GUIDE.md
│   └── TEST_SCENARIOS.md
│
├── 🔐 SECURITY (Agent 4)
│   ├── test/security/
│   ├── scripts/
│   │   ├── security/
│   │   ├── monitoring/
│   │   └── emergency/
│   ├── monitoring/
│   │   ├── grafana/
│   │   └── prometheus/
│   ├── SECURITY_AUDIT_REPORT.md
│   ├── INCIDENT_RESPONSE_PLAN.md
│   └── EMERGENCY_PROCEDURES.md
│
├── 💎 CONTRACTS (Existing)
│   └── contracts/
│
├── 🌐 FRONTEND (Existing)
│   └── frontend/
│
└── 🚀 DEPLOYMENT SCRIPTS (Existing)
    └── script/
```

---

## ✅ Success Criteria

After all agents complete:

- [ ] Agent 1: Documentation complete ✅
- [ ] Agent 2: Backend API running, database syncing
- [ ] Agent 3: All tests passing, validation scripts working
- [ ] Agent 4: Security audit complete, monitoring active

---

## 💡 Why This Is Better

**Before (V1):**
- ❌ Agent 2 & 3 both doing testing
- ❌ Agent 3 creating deployment automation (overlap with Agent 1)
- ❌ No database/backend infrastructure

**After (V2):**
- ✅ Zero overlap between agents
- ✅ Complete backend with Prisma
- ✅ Clear separation of concerns
- ✅ Each agent is an expert in their domain

---

## 🎉 Ready to Start!

1. ✅ Agent 1 (Me): Documentation complete
2. 🟡 Agent 2: Copy Backend + Prisma prompt → New Composer
3. 🟡 Agent 3: Copy Testing Suite prompt → New Composer
4. 🟡 Agent 4: Copy Security prompt → New Composer

**Start the other 3 agents now!** 🚀


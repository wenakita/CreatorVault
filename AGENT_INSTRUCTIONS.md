# 🤖 Agent Instructions - READ THIS FIRST

**IMPORTANT:** If you are an AI agent working on this project, read this file FIRST before starting your task.

---

## 📋 Multi-Agent Strategy V2

This project uses a **multi-agent deployment strategy** with **4 separate agents** working in parallel.

**Each agent has EXCLUSIVE responsibilities with ZERO overlap.**

---

## 🎯 Agent Assignments

### Agent 1: Documentation & Deployment Scripts ✅
**Status:** COMPLETE  
**Owner:** First agent (already finished)  
**DO NOT TOUCH:** This work is done.

**Completed deliverables:**
- ✅ DEPLOYMENT_CHECKLIST.md
- ✅ QUICK_DEPLOY.md
- ✅ DEPLOYMENT_READY.md
- ✅ .env.deployment.template
- ✅ deploy.sh
- ✅ scripts/pre-deployment-check.ts
- ✅ worktrees.json

---

### Agent 2: Database & Backend (Prisma + API) 🗄️
**Status:** IN PROGRESS or PENDING  
**Your scope:** Backend infrastructure ONLY

**What you SHOULD do:**
- ✅ Create backend/ directory
- ✅ Set up Prisma with PostgreSQL
- ✅ Create database schema (Users, Deposits, Withdrawals, VaultSnapshots, etc.)
- ✅ Build blockchain event indexer
- ✅ Create REST API endpoints
- ✅ Set up Docker + docker-compose
- ✅ Create cron jobs for snapshots
- ✅ Write backend documentation

**What you MUST NOT do:**
- ❌ Create deployment scripts (Agent 1 did this)
- ❌ Create testing scripts (Agent 3 does this)
- ❌ Create security audits (Agent 4 does this)
- ❌ Create monitoring dashboards (Agent 4 does this)
- ❌ Modify frontend (already exists)
- ❌ Touch smart contracts (already exist)

**Your deliverables:**
- `backend/` directory with complete backend
- `backend/prisma/schema.prisma`
- `backend/src/indexer/` - blockchain event indexer
- `backend/src/api/` - REST API
- `backend/docker-compose.yml`
- `backend/README.md`

---

### Agent 3: Testing & Validation Suite 🧪
**Status:** IN PROGRESS or PENDING  
**Your scope:** Testing and validation ONLY

**What you SHOULD do:**
- ✅ Create comprehensive Foundry test suite
- ✅ Create integration tests
- ✅ Create post-deployment validation scripts
- ✅ Create functional test scripts (deposit, withdraw, cross-chain)
- ✅ Create load tests
- ✅ Create E2E tests
- ✅ Create regression test suite
- ✅ Write testing documentation

**What you MUST NOT do:**
- ❌ Create deployment scripts (Agent 1 did this)
- ❌ Create backend/API code (Agent 2 does this)
- ❌ Create security audits (Agent 4 does this)
- ❌ Create monitoring infrastructure (Agent 4 does this)
- ❌ Modify smart contracts (already exist)

**Your deliverables:**
- `test/foundry/` - Foundry tests
- `test/integration/` - Integration tests
- `scripts/testing/` - Test execution scripts
- `scripts/validation/` - Validation scripts
- `TESTING_GUIDE.md`
- `TEST_SCENARIOS.md`

---

### Agent 4: Security Audit & Monitoring 🔐
**Status:** IN PROGRESS or PENDING  
**Your scope:** Security and monitoring ONLY

**What you SHOULD do:**
- ✅ Perform security audit of smart contracts
- ✅ Set up automated security scanning (Slither, Mythril)
- ✅ Create security test suite
- ✅ Set up monitoring infrastructure (Grafana, Prometheus)
- ✅ Create security monitoring scripts
- ✅ Write incident response plan
- ✅ Create emergency procedures
- ✅ Write security documentation

**What you MUST NOT do:**
- ❌ Create deployment scripts (Agent 1 did this)
- ❌ Create backend/API code (Agent 2 does this)
- ❌ Create functional tests (Agent 3 does this)
- ❌ Modify smart contracts (already exist)

**Your deliverables:**
- `SECURITY_AUDIT_REPORT.md`
- `INCIDENT_RESPONSE_PLAN.md`
- `EMERGENCY_PROCEDURES.md`
- `test/security/` - Security tests
- `scripts/security/` - Security scanning
- `scripts/monitoring/` - Monitoring scripts
- `monitoring/` - Grafana/Prometheus configs

---

## 🚫 Critical Rules - DO NOT VIOLATE

### 1. Stay in Your Lane
**Only work on your assigned scope.** Do not create files that belong to another agent.

### 2. Check Existing Files
Before creating a file, check if it already exists:
```bash
ls -la DEPLOYMENT*.md
ls -la scripts/
ls -la backend/
```

### 3. Read Project Context
Review these files to understand the project:
- `README.md` - Project overview
- `contracts/` - Smart contracts (DO NOT MODIFY)
- `frontend/` - Frontend (DO NOT MODIFY unless your scope)
- `MULTI_AGENT_DEPLOYMENT_V2.md` - Your detailed instructions

### 4. Coordinate on Shared Resources
If you need to modify shared files (like `package.json`), add your changes without removing others:
- ✅ Add new scripts
- ❌ Don't remove existing scripts

### 5. Use Proper Directories
- Agent 2: Create `backend/` directory
- Agent 3: Use `test/` and `scripts/testing/`, `scripts/validation/`
- Agent 4: Use `test/security/`, `scripts/security/`, `scripts/monitoring/`, `monitoring/`

---

## 📁 Directory Ownership

| Directory | Owner | Others Can |
|-----------|-------|------------|
| `contracts/` | Existing | Read only |
| `frontend/` | Existing | Read only |
| `script/` | Existing | Read only |
| `docs/`, `*.md` (root) | Agent 1 ✅ | Read only |
| `deploy.sh` | Agent 1 ✅ | Read only |
| `backend/` | Agent 2 | Read only |
| `test/foundry/`, `test/integration/` | Agent 3 | Read only |
| `test/security/` | Agent 4 | Read only |
| `scripts/testing/` | Agent 3 | Read only |
| `scripts/validation/` | Agent 3 | Read only |
| `scripts/security/` | Agent 4 | Read only |
| `scripts/monitoring/` | Agent 4 | Read only |
| `scripts/emergency/` | Agent 4 | Read only |
| `monitoring/` | Agent 4 | Read only |

---

## 🏗️ Understanding the Architecture

**CRITICAL: Read `ARCHITECTURE_OVERVIEW.md` before starting!**

This project uses a **custom EagleVaultWrapper pattern**, NOT standard OFTAdapter:

```
Standard OVault:  Vault → OFTAdapter → LayerZero
Eagle OVault:     EagleOVault → EagleVaultWrapper → EagleShareOFT → LayerZero
```

**Key Points:**
- EagleOVault (ERC4626) is on Ethereum only
- EagleVaultWrapper wraps shares ↔ OFT tokens (1:1 ratio)
- EagleShareOFT is the cross-chain token (all chains)
- Same EAGLE address on all chains (CREATE2)
- Hub-and-spoke model (Ethereum = hub)

**You MUST understand this before creating any code!**

---

## ✅ Before You Start Checklist

- [ ] I have read this file completely
- [ ] **I have read `ARCHITECTURE_OVERVIEW.md` and understand the custom pattern**
- [ ] I understand my agent number and scope
- [ ] I know what I SHOULD do
- [ ] I know what I MUST NOT do
- [ ] I have checked for existing files in my scope
- [ ] I have read `MULTI_AGENT_DEPLOYMENT_V2.md` for detailed instructions
- [ ] I will stay in my lane

---

## 🆘 If You're Unsure

**Ask yourself:**
1. Is this file/task in my scope?
2. Has another agent already done this?
3. Am I duplicating work?

**If unsure, DON'T do it.** Stick to your explicit scope.

---

## 📞 Agent Communication

Since agents work in parallel, you cannot communicate directly. Instead:

1. **Read existing files** to understand what's been done
2. **Follow the directory structure** to avoid conflicts
3. **Document your work** clearly for integration later
4. **Use consistent naming** (follow existing patterns)

---

## 🎯 Success Criteria

Your work is successful when:
- ✅ All your deliverables are complete
- ✅ You stayed within your scope
- ✅ You didn't duplicate other agents' work
- ✅ Your code/docs are well-organized
- ✅ Everything is documented

---

## 📊 Integration Plan

After all agents finish, the human will:
1. Review all outputs
2. Resolve any conflicts
3. Integrate deliverables
4. Test the complete system
5. Deploy to production

**Your job:** Deliver your scope perfectly. Let the human handle integration.

---

## 🚀 Ready to Start?

1. ✅ Read this file
2. ✅ Identify your agent number (2, 3, or 4)
3. ✅ Read your detailed prompt in `MULTI_AGENT_DEPLOYMENT_V2.md`
4. ✅ Check existing files in your scope
5. ✅ Start working on YOUR scope ONLY

**Good luck! 🎉**

---

## 📝 Quick Reference

| If you are... | Your scope is... | Your prompt is in... |
|---------------|------------------|----------------------|
| **Agent 1** | Documentation ✅ | DONE - don't start |
| **Agent 2** | Backend + Prisma | `MULTI_AGENT_DEPLOYMENT_V2.md` → Agent 2 section |
| **Agent 3** | Testing + Validation | `MULTI_AGENT_DEPLOYMENT_V2.md` → Agent 3 section |
| **Agent 4** | Security + Monitoring | `MULTI_AGENT_DEPLOYMENT_V2.md` → Agent 4 section |

---

**Last Updated:** October 31, 2025  
**Strategy Version:** V2 (No Overlap + Prisma)


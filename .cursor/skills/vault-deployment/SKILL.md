---
name: vault-deployment
description: Deploy and configure CreatorVault vault infrastructure (CreatorOVault, wrapper, ShareOFT, gauge, CCA strategy, oracle) and optionally post-deploy strategies/payout routing. Use when the user mentions deploy vault, DeployCreatorVault, DeployInfrastructure, account abstraction (ERC-4337), Privy deploy flow, CreatorVaultDeployer phases, or strategy batch deployment.
---

## Quick Start (choose the deployment path)

- Determine target chain and deployment mode:
  - Foundry scripts (EOA / operator): `script/DeployInfrastructure.s.sol` and `script/deploy.sh`
  - ERC-4337 / AA (smart account): `script/deploy-with-aa.ts` (and `frontend/src/pages/DeployVault.tsx` for the UI flow)
  - Multi-phase orchestrator (Base code-deposit limits): `contracts/helpers/batchers/CreatorVaultDeployer.sol` (Phase 1–2; Phase 3 is strategies)
  - “Infra v2” deterministic deployment helpers: `./script/deploy.sh infra-v2` → `script/DeployBaseMainnetDeployer.s.sol`
  - Post-deploy batchers (strategies + activation): `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`, `contracts/helpers/batchers/VaultActivationBatcher.sol`
- Always do a read-only preflight first (RPC connectivity, owner/deployer identity, “already deployed?” checks).
- Never paste private keys or full `.env` contents in output.

## System Model (what “deploy a vault” means here)

There are multiple layers:

- Core infra (one-time, typically Base):
  - Registry + factory + shared services (see `script/DeployInfrastructure.s.sol`)
- Per-creator vault infra (per creator coin):
  - `CreatorOVault` (ERC-4626 vault)
  - `CreatorOVaultWrapper`
  - `CreatorShareOFT` (wrapped shares; tradable token)
  - `CreatorGaugeController`
  - `CCALaunchStrategy` (auction / launch mechanism)
  - `CreatorOracle`
- Optional post-deploy:
  - Strategies (Charm/Ajna) via batchers
  - Payout routing (e.g., `PayoutRouter`)

## Required Inputs

- Chain/network + RPC URL
- Creator coin address (the underlying creator token)
- Owner model:
  - Creator-owned (creator EOA/smart wallet) vs protocol-owned (multisig/treasury)
- If deploying via scripts (Foundry):
  - Required env vars (names only): `PRIVATE_KEY`, `RPC_URL` (or `BASE_RPC_URL` for v2 deployer), `ETHERSCAN_API_KEY`/BaseScan key
  - For per-creator deploy: `CREATOR_FACTORY`
- If deploying via AA script (`deploy-with-aa.ts`):
  - Required env vars (names only): `SMART_ACCOUNT`, `PRIVATE_KEY`, `CREATOR_FACTORY`
  - Optional: `BASE_RPC_URL`, `BUNDLER_URL`, `PAYMASTER_URL`, `PAYOUT_ROUTER_FACTORY`
- If deploying via frontend UI (`DeployVault.tsx`):
  - Privy must be enabled + configured (client `VITE_PRIVY_*`, server `PRIVY_*`), and the user must sign in with Privy **or** connect an external wallet that can operate the canonical smart wallet.

## Repo Map (where to look / entrypoints)

- Foundry deployment:
  - `script/DeployInfrastructure.s.sol` (core infra + `DeployCreatorVault` per creator)
  - `script/deploy.sh` (wrapper for infra/vault/AA deploy)
- “Infra v2” deployer (bytecode store + deployer + multi-phase deploy contract):
  - `script/DeployBaseMainnetDeployer.s.sol` (used by `./script/deploy.sh infra-v2`)
- AA deployment (CLI):
  - `script/deploy-with-aa.ts` (UserOp deployment via bundler/paymaster)
- AA deployment (frontend UI):
  - `frontend/src/pages/DeployVault.tsx` (Privy + smart wallet 1-click deploy; can also operate via external owner wallet in some flows)
- Multi-phase deploy orchestrator:
  - `contracts/helpers/batchers/CreatorVaultDeployer.sol` (Phase 1: vault/wrapper/shareOFT; Phase 2: gauge/cca/oracle + deposit/auction; Phase 3: strategies)
- Strategy deployment:
  - `contracts/helpers/batchers/StrategyDeploymentBatcher.sol` (Charm + optional Ajna strategies)
- Activation / launch:
  - `contracts/helpers/batchers/VaultActivationBatcher.sol` (activates vault + can trigger launch)
- Payout routing:
  - `contracts/helpers/routers/PayoutRouter.sol`
- “Required approvals” reminder:
  - `docs/deployment/REQUIRED_APPROVALS_CHECKLIST.md`
  - `docs/deployment/PRE_LAUNCH_VERIFICATION.md`
  - `docs/deployment/CCA_DEPLOYMENT_VERIFICATION.md`

## Read-only Preflight (do before any state changes)

Use templates like:

```bash
# Ensure RPC works and you’re on the expected chain
cast chain-id --rpc-url $RPC_URL

# Check whether a creator coin is already registered/deployed.
#
# IMPORTANT: This repo has had multiple infra deployments over time. For existing creator coins, you may need to
# check the *legacy* registry/factory (from env/config) rather than the latest defaults.

# 1) Registry is the source of truth for what the app should use.
cast call --rpc-url $RPC_URL $CREATOR_REGISTRY "getVaultForToken(address)(address)" $CREATOR_COIN

# 2) Factory is useful to see “which stack was registered by which infra deploy”.
cast call --rpc-url $RPC_URL $CREATOR_FACTORY "isDeployed(address)(bool)" $CREATOR_COIN
cast call --rpc-url $RPC_URL $CREATOR_FACTORY "getDeployment(address)((address,address,address,address,address,address,address,address,uint256,bool))" $CREATOR_COIN
```

If you’re using the multi-phase deployer, prefer checking deterministic addresses first (computeAddress/create2) rather than “guessing”.

## Deployment Workflows

### A) Foundry: deploy core infra (one-time)

Preferred wrapper:

- `./script/deploy.sh infrastructure`

Or directly:

- `forge script script/DeployInfrastructure.s.sol:DeployInfrastructure --rpc-url $RPC_URL --broadcast --verify -vvvv`

Outputs/verification:
- Foundry broadcast artifacts under `broadcast/**`
- Copy emitted addresses into env/config as needed

### B) Foundry: deploy per-creator vault infra (EOA/operator)

Wrapper:

- `./script/deploy.sh vault $CREATOR_COIN_ADDRESS`

This runs:
- `script/DeployInfrastructure.s.sol:DeployCreatorVault` with `CREATOR_COIN_ADDRESS` set

Post-checks:
- Ensure the deployment was registered in `CreatorOVaultFactory` (via `registerDeployment`)
- Ensure registry wiring happened (if `CreatorOVaultFactory.registry` was set)

### C) ERC-4337 / AA: deploy per-creator vault infra (smart account)

Wrapper:

- `./script/deploy.sh aa $CREATOR_COIN_ADDRESS --gasless`

Under the hood:
- `npx ts-node script/deploy-with-aa.ts <CREATOR_COIN> [--gasless]`

Notes:
- This path depends on the AA contracts (`EntryPoint`, smart account) and the bundler/paymaster.
- It may require simulation/predicted addresses to do multi-call atomic wiring.

Reality check (AA CLI vs UI):

- The **frontend AA path** is the canonical “1-click deploy” in practice. It uses the onchain batcher/deployer addresses from config (e.g. `creatorVaultBatcher`, `vaultActivationBatcher`) and submits UserOperations via Coinbase.
- The **CLI AA script** (`script/deploy-with-aa.ts`, called by `./script/deploy.sh aa`) may be stale depending on the currently deployed factory shape; validate its target contract ABI before relying on it for production deployments.

### D) Multi-phase: deploy via `CreatorVaultDeployer` (Phase 1–3)

Use when Base code-deposit limits prevent “all-in-one” deploys, or when you want deterministic CREATE2 addresses + phased execution.

- Phase 1: deploy vault + wrapper + shareOFT + minimal wiring
- Phase 2: deploy gauge + CCA + oracle + deposit + optional auction + ownership transfers
- Phase 3: deploy + register strategies (Charm/Ajna) and optionally create/init V3 pool

## Approvals / One-time protocol actions

The most common “gotcha” is approvals for launch/batchers. See:
- `docs/deployment/REQUIRED_APPROVALS_CHECKLIST.md`

Common required approvals (high level):

- Protocol owner (one-time per deployment of CCA / activation batcher):
  - `CCALaunchStrategy.setApprovedLauncher(vaultActivationBatcher, true)`
- Per-user (before strategy deploy):
  - Creator token approval to `StrategyDeploymentBatcher` (so it can `transferFrom` during batch calls)

## Troubleshooting (common failures)

- “Already deployed”:
  - `CreatorOVaultFactory.registerDeployment` reverts if `deployments[token].exists == true`
- “AA deploy stuck / reverted”:
  - check bundler error and paymaster sponsorship; reduce batch size or switch to multi-phase deployer
- “Launch/activate reverted”:
  - missing `setApprovedLauncher(...)` approval on CCA strategy (protocol owner action)
- “Strategy batch reverted”:
  - user didn’t approve creator token to the batcher; confirm allowance first
- “Frontend 1-click deploy blocked”:
  - user is neither signed in with Privy nor connected with a wallet that can operate the canonical smart wallet; switch sign-in method and retry
- “Wallet connection not ready”:
  - wagmi wallet client is missing; reconnect wallet and retry

## Output Format (when using this skill)

Return a structured result:

- Summary: what was deployed / what’s blocked
- Inputs: chain, RPC, creator coin, chosen deployment path, owner model
- Preflight results: “already deployed?” + key contract reads
- Actions taken: commands run or transactions sent (hashes)
- Verification: post-state reads showing wiring/ownership
- Follow-ups: approvals required, remaining phases, monitoring


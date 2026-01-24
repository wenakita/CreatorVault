---
name: vault-deployment
description: Deploy and configure CreatorVault vault infrastructure (CreatorOVault, wrapper, ShareOFT, gauge, CCA strategy, oracle) and optionally post-deploy strategies/payout routing. Use when the user mentions deploy vault, DeployCreatorVault, DeployInfrastructure, account abstraction (ERC-4337), Privy deploy flow, CreatorVaultDeployer phases, or strategy batch deployment.
---

## Quick Start (choose the deployment path)

- Determine target chain and deployment mode:
  - Foundry scripts (EOA / operator): `script/DeployInfrastructure.s.sol` and `script/deploy.sh`
  - ERC-4337 / AA (smart account): `script/deploy-with-aa.ts` (and `frontend/src/pages/DeployVault.tsx` for the UI flow)
  - Multi-phase orchestrator (code-deposit gas limits): `contracts/helpers/batchers/CreatorVaultDeployer.sol` (Phase 1–3)
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
- If using scripts/AA:
  - Required env vars (names only): `PRIVATE_KEY`, `RPC_URL`, `CREATOR_FACTORY`, `SMART_ACCOUNT`, `BUNDLER_URL`, `PAYMASTER_URL`

## Repo Map (where to look / entrypoints)

- Foundry deployment:
  - `script/DeployInfrastructure.s.sol` (core infra + `DeployCreatorVault` per creator)
  - `script/deploy.sh` (wrapper for infra/vault/AA deploy)
- AA deployment (CLI):
  - `script/deploy-with-aa.ts` (UserOp deployment via bundler/paymaster)
- AA deployment (frontend UI):
  - `frontend/src/pages/DeployVault.tsx` (Privy smart wallet 1-click deploy)
- Multi-phase deploy orchestrator:
  - `contracts/helpers/batchers/CreatorVaultDeployer.sol` (Phase 1: vault/wrapper/shareOFT; Phase 2: gauge/cca/oracle + deposit/auction; Phase 3: strategies)
- Strategy deployment:
  - `contracts/helpers/batchers/StrategyDeploymentBatcher.sol` (Charm + optional Ajna strategies)
- Payout routing:
  - `contracts/helpers/routers/PayoutRouter.sol`
- “Required approvals” reminder:
  - `docs/deployment/REQUIRED_APPROVALS_CHECKLIST.md`

## Read-only Preflight (do before any state changes)

Use templates like:

```bash
# Ensure RPC works and you’re on the expected chain
cast chain-id --rpc-url $RPC_URL

# Check whether a creator coin is already deployed in the factory registry (if applicable)
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

### D) Multi-phase: deploy via `CreatorVaultDeployer` (Phase 1–3)

Use when Base code-deposit limits prevent “all-in-one” deploys, or when you want deterministic CREATE2 addresses + phased execution.

- Phase 1: deploy vault + wrapper + shareOFT + minimal wiring
- Phase 2: deploy gauge + CCA + oracle + deposit + optional auction + ownership transfers
- Phase 3: deploy + register strategies (Charm/Ajna) and optionally create/init V3 pool

## Approvals / One-time protocol actions

The most common “gotcha” is approvals for launch/batchers. See:
- `docs/deployment/REQUIRED_APPROVALS_CHECKLIST.md`

## Troubleshooting (common failures)

- “Already deployed”:
  - `CreatorOVaultFactory.registerDeployment` reverts if `deployments[token].exists == true`
- “AA deploy stuck / reverted”:
  - check bundler error and paymaster sponsorship; reduce batch size or switch to multi-phase deployer
- “Launch/activate reverted”:
  - missing `setApprovedLauncher(...)` approval on CCA strategy (protocol owner action)

## Output Format (when using this skill)

Return a structured result:

- Summary: what was deployed / what’s blocked
- Inputs: chain, RPC, creator coin, chosen deployment path, owner model
- Preflight results: “already deployed?” + key contract reads
- Actions taken: commands run or transactions sent (hashes)
- Verification: post-state reads showing wiring/ownership
- Follow-ups: approvals required, remaining phases, monitoring

---
name: yield-strategy-management
description: Manage CreatorOVault yield strategies (add/remove strategies, set weights, set idle reserves, deploy idle assets, rebalance, report). Use when the user mentions strategy allocation, deployToStrategies, minimumTotalIdle, addStrategy, Ajna/Charm strategies, keeper operations, or vault performance monitoring.
---

## Quick Start (most common)

- Identify the target vault + underlying creator coin.
- Read current configuration (no writes):
  - active strategies, weights, totalStrategyWeight
  - `minimumTotalIdle`, `deploymentThreshold`, `defaultQueue`, `autoAllocate`
  - `strategyDebt` per strategy + `totalDebt`
  - `pricePerShare()` and `totalAssets()`
- Decide what action is needed:
  - Configure: add/remove/update weights, set idle reserve, set queue
  - Operate: deploy idle funds, tend, report, rebalance strategies
  - Emergency: pause/shutdown, emergencyWithdrawFromStrategies, buyDebt
- Do not make onchain changes without explicit approval.

## System Model (how strategy allocation works)

Core contract:
- `contracts/vault/CreatorOVault.sol`

Key ideas:
- Vault holds idle creator coins (`coinBalance`) and can deploy excess into strategies.
- Strategies implement `IStrategy` (single-asset: must have `asset() == CREATOR_COIN`).
- Allocation is weight-based:
  - `deployable = coinBalance - max(minimumTotalIdle, deploymentThreshold)`
  - each strategy gets `amount_i = deployable * weight_i / totalStrategyWeight`
- Debt accounting:
  - Vault tracks `strategyDebt[strategy]` + `totalDebt` to reason about withdrawals and unrealised losses.
- Ops roles:
  - **management/owner**: add/remove strategies, set weights, set idle reserve, configure queue, set keeper
  - **keeper/management/owner**: `deployToStrategies()`, `report()`, `tend()`

## Repo Map (where to look / common strategies)

- Vault: `contracts/vault/CreatorOVault.sol`
- Strategy interface: `contracts/interfaces/IStrategy.sol`
- Base strategy pattern: `contracts/vault/strategies/BaseCreatorStrategy.sol`
- Ajna strategy: `contracts/vault/strategies/AjnaStrategy.sol`
- Strategy deploy tooling:
  - `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`
  - `docs/aa/AA_STRATEGY_DEPLOYMENT.md`
- Allocation notes: `docs/lottery/MULTI_STRATEGY_ALLOCATION.md`
- Architecture: `docs/architecture/STRATEGY_ARCHITECTURE.md`

## Read-only Health Checks (preferred first)

Use templates (fill in `$RPC_URL`, `$VAULT`, `$STRATEGY`):

```bash
cast call --rpc-url $RPC_URL $VAULT "asset()(address)"
cast call --rpc-url $RPC_URL $VAULT "totalAssets()(uint256)"
cast call --rpc-url $RPC_URL $VAULT "pricePerShare()(uint256)"
cast call --rpc-url $RPC_URL $VAULT "minimumTotalIdle()(uint256)"
cast call --rpc-url $RPC_URL $VAULT "deploymentThreshold()(uint256)"
cast call --rpc-url $RPC_URL $VAULT "autoAllocate()(bool)"
cast call --rpc-url $RPC_URL $VAULT "totalStrategyWeight()(uint256)"
cast call --rpc-url $RPC_URL $VAULT "strategyDebt(address)(uint256)" $STRATEGY
cast call --rpc-url $RPC_URL $VAULT "strategyWeights(address)(uint256)" $STRATEGY
cast call --rpc-url $RPC_URL $STRATEGY "asset()(address)"
cast call --rpc-url $RPC_URL $STRATEGY "isActive()(bool)"
cast call --rpc-url $RPC_URL $STRATEGY "getTotalAssets()(uint256)"
```

## Common Workflows

### A) Set allocation targets (weights + idle reserve)

1. Add strategies (management):
   - `addStrategy(strategy, weightBps)` (sum of weights must be ≤ 10_000)
2. Set idle reserve:
   - `setMinimumTotalIdle(minIdleAssets)` to keep liquidity for withdrawals
3. Optionally set default withdrawal order:
   - `setDefaultQueue([strategy1, strategy2, ...])`

### B) Deploy idle funds to strategies (keeper op)

- Call `deployToStrategies()` to move excess idle funds into strategies according to weights.
- Verify:
  - `coinBalance` decreased
  - `strategyDebt[strategy]` increased

### C) Maintenance cadence

- `tend()` is a lightweight maintenance (deploy if above threshold).
- `report()` updates accounting, profit unlocking, and mints performance-fee shares (if configured).

### D) Emergency actions

- `shutdownVault()` + `emergencyWithdrawFromStrategies()` for urgent exits.
- Use `buyDebt()` only with explicit protocol direction (it changes debt accounting).

## Troubleshooting (common pitfalls)

- Strategy add fails:
  - `strategy.asset()` mismatch (must equal vault’s creator coin)
  - strategy not active (`isActive() == false`)
  - too many strategies (max 5)
  - weights exceed 10_000 total
- Withdrawals revert due to unrealized losses:
  - vault assesses unrealized losses during `_withdrawFromStrategies`; investigate strategy health and consider de-risking.

## Output Format (when using this skill)

Return a structured result:

- Summary: what change/operation is being requested
- Inputs: vault address, strategies, target weights, idle reserve
- Current state: key reads (totalAssets, PPS, debts, weights, queue)
- Proposed changes: exact onchain calls needed (read-only plan unless approved)
- Verification plan: post-state reads/events to confirm
- Risks: liquidity impact, withdrawal queue behavior, unrealized loss exposure

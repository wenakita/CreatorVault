---
name: oft-chain-config
description: Configure LayerZero V2 OFT cross-chain settings for CreatorVault (peers, endpoints, chain/EID mappings, and OFT deployment bootstrapping). Use when the user mentions LayerZero, OFT, setPeer, endpoint, EID, cross-chain send, or ShareOFT configuration across chains.
---

## Quick Start (most common)

- Identify what you are configuring:
  - OFT deployment bootstrapping (endpoint resolution at construction time)
  - Cross-chain messaging wiring (LayerZero peers / EID mapping)
  - Operational send/receive debugging (fee quotes, peer mismatch, blocked messages)
- Collect inputs first:
  - Chain IDs + LayerZero EIDs for source/target
  - Contract addresses on each chain (CreatorRegistry, ShareOFT / OApp contracts)
  - Who is allowed to change config (owner/multisig)
- Do read-only checks first (`cast call`) before any state changes.

## System Model (how OFT + LayerZero works here)

- `CreatorShareOFT` is an Omnichain Fungible Token (OFT) built on LayerZero:
  - Contract: `contracts/services/messaging/CreatorShareOFT.sol`
  - Constructed with a LayerZero endpoint resolved from a registry (`getLayerZeroEndpoint(chainId)`).
- Deployment bootstrapping:
  - `contracts/helpers/infra/OFTBootstrapRegistry.sol` provides a minimal `getLayerZeroEndpoint(chainId)` used at OFT construction time.
  - It is permissionless by design because it’s intended to be set atomically during AA deployment immediately before deploying the OFT.
- Cross-chain security:
  - LayerZero OApps rely on `setPeer(eid, peer)` / `peers(eid)` relationships to authenticate remote senders.
  - Misconfigured peers are the #1 cause of “messages not delivered / unauthorized” errors.

## Required Inputs

- Source chain: chainId + LayerZero EID
- Target chain: chainId + LayerZero EID
- Contract addresses on each chain:
  - `CreatorRegistry` (or `OFTBootstrapRegistry` if using the bootstrap flow)
  - `CreatorShareOFT` (and any other OApp you’re wiring)
- Admin identity:
  - EOA/multisig that is `owner()` of the contracts being configured

Never include private keys or full `.env` contents in output.

## Repo Map (where to look / entrypoints)

- OFT token implementation: `contracts/services/messaging/CreatorShareOFT.sol`
- Bootstrap endpoint registry: `contracts/helpers/infra/OFTBootstrapRegistry.sol`
- Core registry (chain/EID mappings + endpoint lookup): `contracts/core/CreatorRegistry.sol`
- Deployment tooling (CREATE2/bytecode infra): `script/DeployUniversalBytecodeInfra.s.sol`, `script/SimulateUniversalCreate2Factory.s.sol`
- Deployer orchestration that sets endpoints before deployment: `contracts/helpers/batchers/CreatorVaultDeployer.sol`

## Read-only Checks (before changes)

```bash
# Confirm chain + endpoint resolution (examples; fill in vars)
cast chain-id --rpc-url $RPC_URL

# Confirm ownership
cast call --rpc-url $RPC_URL $CONTRACT "owner()(address)"

# Confirm peers (LayerZero OApp)
cast call --rpc-url $RPC_URL $OAPP "peers(uint32)(bytes32)" $REMOTE_EID
```

## Configuration Workflows

### A) Bootstrapping OFT deployment (endpoint resolution)

Goal: ensure the OFT constructor uses the correct LayerZero endpoint for the chain.

- Update `OFTBootstrapRegistry.setLayerZeroEndpoint(chainId, endpoint)` on the target chain
- Deploy the `CreatorShareOFT` using the bootstrap registry address as the `_registry` constructor param
- Immediately wire the OFT to the canonical registry (if desired) using `CreatorShareOFT.setRegistry(...)`

### B) Wiring cross-chain peers (critical for security)

For each direction (A → B and B → A):

- On chain A, set `peer[remoteEid] = bytes32(remoteOAppAddress)`
- On chain B, set `peer[remoteEid] = bytes32(remoteOAppAddress)`

Common failure mode:
- Only one side is configured (messages will fail authentication on receipt).

### C) Debugging cross-chain sends

If messages fail:
- Verify `peers(eid)` matches the expected sender on both ends.
- Verify chainId↔EID mapping is correct in your registry.
- Confirm the contract has the right endpoint at construction time (bootstrap/registry).

## Output Format (when using this skill)

Return a structured result:

- Summary: what cross-chain wiring was requested
- Inputs: chains (chainId + EID), addresses, expected peers
- Checks performed: owner(), peers(), endpoint mappings (read-only calls)
- Actions taken (if any): tx hashes, functions called, and the new peer/endpoints
- Verification: post-state reads confirming peers/mappings
- Follow-ups: missing reverse-peers, required off-chain config, or rollout steps

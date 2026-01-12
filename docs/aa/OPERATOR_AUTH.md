# Operator Authorization (Identity-safe)

## Goal

Let an **execution wallet** (Base Smart Account, Zora smart wallet, session key, etc.) act on behalf of a **canonical identity wallet** **without ever letting identity drift**.

## Non-negotiable invariants

- Identity is **never inferred** from `msg.sender`, `tx.origin`, or “current session wallet”.
- Operators **may initiate** deploy/activate flows, but **may never choose identity**.
- Leftovers (remaining ■shares / refunds) are routed to the **bound identity** (never `msg.sender`).
- Operator grants are **invalidated on ownership transfer** (epoch bump).

## Onchain primitives in this repo

### 1) Per-vault operator permissions (epoch-scoped)

File: `contracts/vault/CreatorOVault.sol`

- `operatorEpoch` is bumped on `transferOwnership` (automatic invalidation).
- Operator perms are stored as:
  - `_operatorPerms[operatorEpoch][exec] = perms`
- Grants:
  - `setOperatorPerms(exec, perms)` (onlyOwner)
  - `permitOperator(exec, perms, deadline, sig)` (EIP-712; ERC-1271-safe via `SignatureChecker`)
- Checks:
  - `isAuthorizedOperator(exec, perm)` and `operatorPerms(exec)`

Perm bitmask:
- `OP_DEPOSIT` (1<<0)
- `OP_WITHDRAW` (1<<1)
- `OP_ACTIVATE` (1<<2)

### 2) Operator-initiated deploy+launch (identity-bound)

File: `contracts/helpers/CreatorVaultBatcher.sol`

New operator entrypoints:
- `deployAndLaunchWithPermit2AsOperatorIdentityFunded(...)`
- `deployAndLaunchWithPermit2AsOperatorOperatorFunded(...)`

Both require an **identity-signed DeployAuthorization** (EIP-712) that binds:
- `owner` (identity)
- `operator` (`msg.sender`)
- `leftoverRecipient` (typically `owner`)
- `fundingModel` (identity-funded vs operator-funded)
- `paramsHash` (hash of all deploy-relevant params)
- `nonce` (`deployNonces[owner]`)
- `deadline`

`paramsHash` includes (and therefore prevents parameter substitution for): token addresses, names/symbols, version, deposit amount, auction params, `keccak256(auctionSteps)`, `codeIds`, `leftoverRecipient`, `fundingModel`.

### 3) Operator-safe activation (Permit2 + identity binding)

File: `contracts/helpers/VaultActivationBatcher.sol`

New functions:
- `batchActivateWithPermit2For(identity, ...)` (identity-funded)
- `batchActivateWithPermit2FromOperator(identity, ...)` (operator-funded)

Guards:
- `identity == Ownable(vault).owner()`
- `msg.sender == identity || CreatorOVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)`
- Leftovers always returned to `identity`

Note: this batcher now has a constructor `VaultActivationBatcher(address permit2)` to set the Permit2 address.

## Permit2 funding models (explicit)

### Model A: operator-funded
- Operator provides the creator tokens.
- Operator signs the Permit2 permit.
- Identity signs **only** DeployAuthorization.

### Model B: identity-funded
- Identity provides the creator tokens.
- Identity signs both:
  - DeployAuthorization
  - Permit2 permit (or must have pre-approved flows in place)
- Operator submits the transaction.

## Revocation & drift prevention

- Operator grants are revoked by setting perms to `0` (or transferring ownership).
- On `transferOwnership`, `operatorEpoch++` makes all prior `_operatorPerms[oldEpoch][...]` unusable instantly.

## Farcaster identity mapping (how to think about it)

- **Custody address (FID registry)**: treat this as the **root identity** signal.
  - In CreatorVault terms: custody should be the long-lived “identity wallet” that ultimately owns the vault.
- **Verified ETH addresses**: treat these as **suggested execution wallets only**.
  - They should never be treated as identity, and they should never get operator rights automatically.
- **Delegate signers** (Farcaster Key Registry): treat these as **off-chain posting authorities**, not on-chain owners.
  - If you want a delegate signer’s wallet to act on-chain, it must still be explicitly granted via `permitOperator` or an identity-signed DeployAuthorization.

## Frontend surface

- `/deploy` (`frontend/src/pages/DeployVault.tsx`) supports operator mode by accepting an identity-signed JSON authorization package (and optional Permit2 payload for identity-funded deploys).

The UI does not allow “editing identity” in operator mode unless the supplied authorization binds identity + operator + deploy params.

## Custody-loss recovery (protocol-assisted)

This repo includes an opt-in, timelocked ownership rescue mechanism in `CreatorOVault` intended for **custody loss / recovery** scenarios.

### Danger box (trust model)

- **Protocol multisig can move vault ownership only after a delay**.
  - The rescue authority is `protocolRescue`, set during deploy (owner can change or disable).
- **Current owner can cancel during the delay**.
- **Owner can disable rescue at any time** by setting `protocolRescue = address(0)`.
- **All operator grants are invalidated after any ownership change** (via `operatorEpoch++`).

This is not “social recovery on-chain”; it’s a strictly limited, auditable protocol assistance path with explicit trust assumptions.

### Playbook: “I lost custody”

1. Identify the vault address and the **new intended owner** address.
2. Contact the protocol team; they will call:
   - `initiateOwnershipRescue(newOwner)` from `protocolRescue`.
3. Wait for `rescueDelay` (default is 7 days; bounded by the owner).
4. The protocol team calls:
   - `finalizeOwnershipRescue()` from `protocolRescue`.
5. As the new owner, re-authorize your execution wallets (operators) using `permitOperator` / `setOperatorPerms` as needed.


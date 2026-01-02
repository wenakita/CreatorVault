# ve(3,3) Voting + Bribes + Voter-Fee Rewards (Progress)

This doc tracks the current state of the **ve(3,3)** module for CreatorVault and how to launch it later without overwhelming day‑1 users.

## What’s implemented (onchain)

### 1) Weekly epoch voting (vault gauges)
- **Contract**: `contracts/governance/VaultGaugeVoting.sol`
- **Purpose**: veAKITA holders vote weekly to allocate a bounded **probability budget** across creator vaults.
- **Key properties**
  - Weekly epochs (`currentEpoch()`), epoch‑scoped vote storage:
    - `getVaultWeightAtEpoch(epoch, vault)`
    - `getUserVoteWeightAtEpoch(epoch, user, vault)`
  - Whitelist gating: `canReceiveVotes(vault)` / `setVaultWhitelist(...)`
  - Global probability budget curve: `getTotalGaugeProbabilityBps()` / `getVaultGaugeProbabilityBoostPPM(vault)`

### 2) Voter rewards distribution (fee slice → voters)
- **Contract**: `contracts/governance/VoterRewardsDistributor.sol`
- **Purpose**: distribute the **protocol/voter slice** (currently **9.61%**) to voters **per (epoch, vault)**.
- **Current policy (strict epoch accounting)**
  - Claims only after epoch ends: `epoch < gaugeVoting.currentEpoch()`
  - Claimable amount is pro‑rata by vote weight for that epoch/vault
  - **Zero-vote epochs**: nobody can claim; rewards remain held and can be swept later.
  - **Sweep** (owner-only):
    - `sweepGraceEpochs = 4`
    - `sweepZeroVoteEpoch(vault, epoch)` sends held funds to `protocolTreasury` only if vault had 0 votes that epoch

### 3) External bribes (optional)
- **Contracts**
  - `contracts/bribes/BribeDepot.sol`: epoch-scoped bribe depot for a single vault (multi‑token)
  - `contracts/bribes/BribesFactory.sol`: CREATE2 factory to deploy one depot per whitelisted vault
- **Design**
  - Deposits only for a **future epoch** (prevents retroactive bribing)
  - Claims only after epoch ends; pro‑rata by vote weight
  - If epoch ended with 0 votes for that vault → depositor refund path exists

## Where fees hook in

### CreatorGaugeController → voter slice
- **Contract**: `contracts/governance/CreatorGaugeController.sol`
- If `voterRewardsDistributor` is set:
  - routes the 9.61% slice as **vault share tokens** to `VoterRewardsDistributor.notifyRewards(vault, vaultShares, amount)`
- If unset:
  - falls back to `protocolTreasury` (or jackpot reserve as final fallback)

### Lottery probability boost (optional)
- **Contract**: `contracts/lottery/CreatorLotteryManager.sol`
- If `vaultGaugeVoting` is set:
  - adds vote-directed probability boost via `getVaultGaugeProbabilityBoostPPM(vault)`
- If unset:
  - voting has zero effect (day‑1 safe)

## Day‑1 “simple mode” (fees still accumulate)

To avoid exposing ve(3,3) UX on day 1 while still capturing fees:

- **Do not set** `CreatorLotteryManager.vaultGaugeVoting` (leave `address(0)`)
  - → no vote-directed probability boost applied
- **Do not set** `CreatorGaugeController.voterRewardsDistributor` (leave `address(0)`)
  - → the 9.61% slice continues to accumulate to `protocolTreasury` (or jackpot fallback)
- **Do not deploy** bribe contracts (`BribesFactory` / `BribeDepot`) until you want external bribes live

When you later enable ve(3,3), you can optionally “seed” the first epoch by transferring some accumulated vault share tokens from `protocolTreasury` into `VoterRewardsDistributor` and/or depositing external bribes into the relevant `BribeDepot`.

## Tests added
- `test/VaultGaugeVoting.t.sol`
- `test/VoterRewardsDistributor.t.sol` (includes strict epoch claim gating + zero-vote sweep)
- `test/Bribes.t.sol`

## Known follow-ups (optional)
- Frontend feature flag to hide `/vote` + bribe UI until launch
- “Bribe planner” tooling to suggest deposits for future epochs (admin-only UX)




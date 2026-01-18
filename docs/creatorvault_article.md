# CreatorVault: Deep Dive Into the Creator Economy Stack, Gauges, Voting, and Bribes

CreatorVault is a Base-native creator finance layer that turns Creator Coins into composable onchain economies. The protocol combines ERC-4626 vaults, omnichain share tokens, a fee-splitting gauge, and a lottery system, while anchoring governance and incentives in vote-escrowed liquidity (veERC4626). The end result is a system where creator tokens become programmable ecosystems: deposits mint vault shares, shares wrap into omnichain tokens, DEX trading fees flow into a gauge, and ve-style voting steers probability and rewards. This article breaks down the smart contracts and how they interact, with special focus on gauges, voting, and bribes. [1]

---

## 1) The Core Contracts and How They Fit Together

CreatorVault’s architecture is a modular system deployed as a stack for each creator. The core pieces are:

- **CreatorOVault (ERC-4626 vault)**: Holds the creator coin, mints shares, and enforces security constraints. It also exposes `setGaugeController` and a gauge-only burn hook used for price-per-share increases. [2]
- **CreatorOVaultWrapper**: Wraps vault shares into omnichain format for LayerZero OFT routing. [3]
- **CreatorShareOFT**: Omnichain fungible token that collects trading fees from DEX swaps and forwards those fees to the gauge controller. [3]
- **CreatorGaugeController**: The fee-splitting “gauge” that receives OFT (and optionally WETH) fees and distributes them across burn, lottery, creator, and voter rewards buckets. It is the central economic router. [4]
- **CreatorLotteryManager**: Receives jackpot funding from the gauge and administers draws. [3]
- **VaultGaugeVoting**: A ve(3,3)-style voting system that lets veERC4626 holders allocate “probability boost” toward specific vaults. [5]
- **VoterRewardsDistributor**: Receives the gauge’s voter slice and distributes vault share rewards to voters based on per-epoch weights. [6]
- **BribeDepot**: A per-vault bribe contract that allows anyone to fund a bribe pool for a specific epoch, and lets voters claim their share based on their vote weight for that vault. [7]
- **veERC4626**: A vote-escrowed token. Users lock wrapped shares (■4626) or vault shares (▢4626) to gain voting power, and this voting power is used by the gauge voting system. The token is non-transferable to preserve governance alignment. [8]

This modular stack is wired together at deployment time, typically via the CreatorVault batcher flow, so that the vault knows its gauge, the gauge knows its vault, wrapper, and lottery, and the share token knows where to send fees. [9]

---

## 2) The Fee Flow: From Trading Fees to Gauge Distribution

CreatorVault applies a trading fee to all DEX trades of the omnichain share token. These fees are captured by the CreatorShareOFT token and forwarded to the CreatorGaugeController. The gauge then converts and distributes value according to a fixed basis-point split. [10]

### The gauge’s four-step flow

1. **Receives OFT trading fees** via `receiveFees` or `deposit`. It accumulates them as `pendingFees` and optionally auto-distributes once a threshold and time interval are met. [11]
2. **Unwraps OFT into vault shares** via the vault wrapper when distributing. This converts the fee token into the actual vault share token. [12]
3. **Splits shares into four buckets** using configurable basis points:
   - **Burn share**: Burned via `vault.burnSharesForPriceIncrease` to increase PPS for all holders. [13]
   - **Lottery share**: Added to jackpot reserve and later paid out by the lottery manager. [14]
   - **Creator share**: Optionally paid to the creator treasury (default 0%). [15]
   - **Voter rewards (protocol share)**: Routed to the VoterRewardsDistributor for veERC4626 voters; if not configured, the gauge falls back to the protocol treasury or the jackpot. [16]

**Default split:** 21.39% burn, 69.00% lottery, 0% creator, 9.61% voter rewards. [17]

### Optional WETH fee path

For Uniswap V4 tax-hook setups, WETH fees can be swapped into the creator coin, deposited into the vault, and then distributed the same way as OFT fees. This optional path uses an oracle-based slippage guard and a Uniswap router swap. [18]

---

## 3) veERC4626: The Governance Backbone

The veERC4626 contract is the system’s governance primitive. Users lock either wrapped share tokens (■4626) or vault shares (▢4626) to receive vote-escrowed voting power, which scales linearly with lock duration (up to 4 years). This lock grants voting power used in gauge votes and can be extended or increased over time. Unlocking burns veERC4626 and returns the underlying tokens when the lock expires. [8]

Key design features:

- **Non-transferable voting power**: `transfer`, `approve`, and `transferFrom` revert, ensuring voting power stays tied to the locker. [8]
- **Linear voting power decay**: Voting power is proportional to remaining lock time. This encourages long-term alignment. [8]
- **Optional boost manager hooks**: Lock/unlock changes can notify a boost manager, allowing composable mechanics like lottery probability boosts for lockers. [8]

This token is the foundation for gauge voting and bribe alignment: the more and longer you lock, the more voting weight you hold across CreatorVault’s distribution mechanisms.

---

## 4) VaultGaugeVoting: Directing Probability With ve(3,3) Mechanics

VaultGaugeVoting is a ve(3,3)-style voting contract. Instead of controlling emissions, it directs **probability budget** for the lottery: veERC4626 holders vote for specific vaults, and those votes determine each vault’s share of a bounded “probability budget.” [5]

### How voting works

- **Epochs**: Weekly epochs (7 days), starting on the next Thursday at 00:00 UTC after deployment. Votes are tracked per epoch. [5]
- **Vote submission**: Voters can split their voting power across up to 10 vaults. Weights are normalized by the voter’s total veERC4626 voting power for that epoch. [5]
- **Whitelist gating**: Vaults must be whitelisted (manually or via registry integration) to receive votes. [5]

### Probability budget

Rather than allocating emission tokens, VaultGaugeVoting allocates a portion of the lottery probability “budget” each week. The total probability budget is calculated as a bounded curve based on the number of whitelisted vaults (and optionally a TVL multiplier). It ranges between a minimum and maximum basis points (default 1% to 3%). [5]

Each vault’s share of the probability budget is calculated as:

- If no votes exist for the epoch, the budget is equally split across whitelisted vaults.
- If votes exist, a vault’s share is proportional to its vote weight vs. total votes.

This results in a **vault-specific probability boost**, which can be used by other modules (e.g., lottery logic) to bias outcomes toward vaults favored by veERC4626 voters. [5]

---

## 5) The Gauge + Voting Loop: How Voters Are Rewarded

CreatorGaugeController routes a defined share of fees (default 9.61%) to the **VoterRewardsDistributor**. This contract records rewards per (epoch, vault) and allows veERC4626 voters to claim their share based on their vote weight for that vault in that epoch. [16]

**Reward flow:**

- The gauge notifies rewards with `notifyRewards(vault, token, amount)` after distribution.
- The distributor tracks rewards per epoch and vault.
- Voters can claim after the epoch ends, receiving vault shares proportional to their voting weight. [6]

If a vault receives **zero votes** in an epoch, rewards can be swept to a protocol treasury after a grace period, preventing stuck balances. [6]

This creates the basic loop: trading fees → gauge → voter rewards → veERC4626 incentives → voting → probability direction.

---

## 6) Bribes: Vault-Scoped Incentives for Votes

CreatorVault supports bribes through **BribeDepot**, a per-vault bribe contract. Anyone can deposit bribe tokens for a given epoch, and voters can claim those bribes proportional to their vote weight for that vault and epoch. [7]

Mechanics in practice:

- **Bribe funding**: A user calls `bribe(token, amount)`, and the tokens are stored in the depot under the current epoch. [7]
- **Bribe claiming**: After the epoch ends, voters who allocated votes to that vault can claim their share using `claim(epoch, token)`. The claim is proportional to the user’s vote weight vs. total vote weight for the vault. [7]

This introduces a transparent market for vote direction: creators, communities, or third parties can incentivize votes toward a vault without modifying the core fee split. It’s a classic ve(3,3) pattern adapted to CreatorVault’s probability-based rewards.

---

## 7) How the Gauge, Voting, and Bribes Interact End-to-End

Putting it all together, the economic loop for a creator vault looks like this:

1. **Users trade the omnichain share token** on DEXs; fees are collected and forwarded to the gauge. [10]
2. **The gauge unwraps and distributes** fees into burn, lottery, creator (optional), and voter rewards buckets. [12]
3. **Voter rewards are deposited** into the VoterRewardsDistributor for the current epoch. [16]
4. **veERC4626 holders vote** each epoch to allocate probability budget across vaults. The voting contract tracks weight per vault. [5]
5. **Voters claim rewards** after the epoch ends, receiving vault shares in proportion to their vote weight. [6]
6. **Bribes add another incentive layer**, allowing any party to reward voters who support a specific vault. [7]

This structure aligns participants:

- **Traders** fund the system through activity.
- **Vault holders** benefit from PPS increases and jackpot growth.
- **veERC4626 voters** are rewarded for directing probability and growth.
- **Creators and communities** can attract votes and attention through bribes or direct coordination.

---

## 8) Deployment Wiring: Ensuring the Contracts Connect Correctly

CreatorVault’s batch deployment flow wires these relationships automatically. The batcher sets the gauge on the vault and share token, connects the gauge to the wrapper, lottery, and oracle, and then transfers gauge ownership to the protocol treasury. This ensures fee routing and governance connections are correct from day one. [9]

**Key wiring steps include:**

- `CreatorShareOFT.setGaugeController(...)` so fee collection routes to the gauge.
- `CreatorGaugeController.setVault(...)` and `setWrapper(...)` so the gauge can unwrap and burn shares.
- `CreatorGaugeController.setLotteryManager(...)` to enable jackpot payments.
- `CreatorOVault.setGaugeController(...)` so the gauge can call the burn hook. [9]

---

## 9) Why This Design Matters

CreatorVault’s governance and incentive stack is intentionally layered:

- **Fee routing** through the gauge ensures predictable, transparent distribution and funds the lottery.
- **Vote-escrowed governance** gives long-term aligned participants control over where probability is directed.
- **Voter rewards and bribes** create tangible incentives for governance participation and for creators to rally support.

This approach mirrors the proven dynamics of ve(3,3) systems while adapting them to a creator economy context—where the main “emission” is not a token, but the probability of winning a jackpot and the flywheel of community engagement.

---

## Conclusion

CreatorVault is not just a vault product; it is a full-stack incentive system. Trading fees flow into a gauge, which funds jackpots, burns shares, and rewards voters. veERC4626 holders vote each epoch to direct probability toward vaults, and bribe depots allow targeted incentive campaigns. Together, these pieces create a robust economic OS for creators, combining DeFi mechanics with social alignment. The stack’s strength is in how these contracts interlock: vaults and wrappers handle assets, gauges distribute value, voting steers probability, and bribes plus voter rewards keep governance active. [19]

---

## References

[1]: README.md (Project overview, feature descriptions)
[2]: contracts/vault/CreatorOVault.sol (gauge hooks and controller wiring)
[3]: README.md (wrapper and OFT roles)
[4]: contracts/governance/CreatorGaugeController.sol (fee routing and distribution)
[5]: contracts/governance/VaultGaugeVoting.sol (epoch voting and probability budget)
[6]: contracts/governance/VoterRewardsDistributor.sol (voter reward accounting and claims)
[7]: contracts/governance/bribes/BribeDepot.sol (bribe funding and claims)
[8]: contracts/governance/veERC4626.sol (locking, voting power, non-transferability)
[9]: contracts/helpers/batchers/CreatorVaultBatcher.sol (deployment wiring)
[10]: README.md + contracts/governance/CreatorGaugeController.sol (fee path overview)
[11]: contracts/governance/CreatorGaugeController.sol (fee receipt and accumulation)
[12]: contracts/governance/CreatorGaugeController.sol (unwrap path)
[13]: contracts/governance/CreatorGaugeController.sol (burn path)
[14]: contracts/governance/CreatorGaugeController.sol (lottery reserve)
[15]: contracts/governance/CreatorGaugeController.sol (creator share path)
[16]: contracts/governance/CreatorGaugeController.sol + VoterRewardsDistributor.sol (voter rewards path)
[17]: contracts/governance/CreatorGaugeController.sol (default split)
[18]: contracts/governance/CreatorGaugeController.sol (WETH fee path)
[19]: contracts/governance/CreatorGaugeController.sol + VaultGaugeVoting.sol + BribeDepot.sol (end-to-end loop)

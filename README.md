# CreatorVault

**Omnichain Vault Platform for Creator Coins** — One-click deployment of cross-chain yield vaults with gamified incentives powered by **Uniswap CCA**, **LayerZero V2**, and **Chainlink VRF**.

CreatorVault enables any creator to deploy institutional-grade **ERC-4626 vault** infrastructure for their Coinbase Creator Coin. Each vault includes cross-chain **LayerZero OFT** shares, pluggable **yield strategies**, and a **6.9% trading-fee lottery** (on all DEX trades) for community engagement — all deployed in a single gas-free transaction via **EIP-4337** account abstraction.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636)](https://docs.soliditylang.org/)
[![LayerZero](https://img.shields.io/badge/LayerZero-V2-7B3FE4)](https://layerzero.network/)
[![Multi-Chain](https://img.shields.io/badge/Chains-8+-4CAF50)](#supported-chains)

---

## 📊 Project Metadata (AI-Friendly)

```json
{
  "name": "CreatorVault",
  "version": "1.0.0",
  "description": "Omnichain vault platform for creator coins with gas-free deployment, cross-chain OFT, pluggable yield strategies, and gamified lottery incentives",
  "key_features": [
    "ERC-4626 vault (Yearn V3 architecture)",
    "LayerZero V2 omnichain share token (OFT)",
    "One-click deployment via EIP-4337 (gas-sponsored by Coinbase CDP)",
    "Uniswap V4 Continuous Clearing Auction (CCA) for fair launch",
    "6.9% trading fee (buys and sells) funding Chainlink VRF lottery",
    "Pluggable yield strategies",
    "Anti-whale guards and flash loan protection"
  ],
  "tokenomics": {
    "buy_fee": "6.9%",
    "sell_fee": "6.9%",
    "fee_mechanism": "6.9% fee collected on all DEX trades (buys and sells)",
    "fee_allocation": "100% to GaugeController → Lottery prize pool",
    "lottery": "Percentage-based entries: $1 traded = 0.0004% chance to win, Chainlink VRF for fairness"
  },
  "tech_stack": [
    "Solidity 0.8.20",
    "LayerZero V2 (cross-chain messaging)",
    "Chainlink VRF 2.5 (lottery randomness)",
    "Uniswap V4 (Continuous Clearing Auction + liquidity)",
    "EIP-4337 / EIP-5792 (account abstraction + batching)",
    "Yearn V3 (vault architecture)"
  ],
  "chains": ["Base (hub)", "Ethereum", "Arbitrum", "BSC", "Avalanche", "Monad", "Sonic", "HyperEVM"],
  "github": "https://github.com/wenakita/CreatorVault",
  "first_deployment": "akita Creator Coin (Base: 0x5b674196812451b7cec024fe9d22d2c0b172fa75)"
}
```

---

## 🎯 Features

**CreatorVault provides a complete vault-as-a-service platform for Creator Coins. Each feature is designed to maximize creator revenue and community engagement:**

### Core Features

- **🏭 One-Click Deployment**: Deploy vault + wrapper + OFT + oracle + CCA strategy in a single gas-free transaction via **EIP-4337** account abstraction and **Coinbase CDP** paymaster.
- **🌐 Omnichain Shares**: **LayerZero V2 OFT** enables share tokens to move across 8+ chains with unified liquidity and cross-chain yield.
- **📈 Pluggable Yield Strategies**: **ERC-4626** vault supports multiple strategies (e.g., Uniswap V4 LP, lending protocols, RWA yield) with configurable allocations.
- **💰 Fair Launch via CCA**: **Uniswap Continuous Clearing Auction** provides transparent, DeFi-native price discovery with no front-running.
- **🎰 Gamified Lottery**: 6.9% fee on ALL DEX trades (buys + sells) funds **Chainlink VRF lottery** — percentage-based entries where **$1 traded = 0.0004% chance to win** (e.g., $10k trade = 4% chance).
- **🔒 Battle-Tested Security**: Virtual shares offset, flash loan protection, anti-whale guards, minimum deposits, and queued large withdrawals.
- **🎨 Creator-First**: Each creator owns their vault ecosystem — fees flow to lottery prize pool, full branding control.

### Tokenomics (6.9% Trading Fee Explained)

**The 6.9% fee applies to ALL DEX trades (buys and sells) and is the core incentive mechanism. Here's the exact flow:**

1. **Trade Event** → User buys or sells share tokens (wsAKITA, wsBRET, etc.) on a DEX (Uniswap V4 pool).
2. **Fee Collection** → 6.9% of the trade amount is automatically deducted and sent to the **GaugeController** contract.
3. **GaugeController Routing** → 100% of collected fees are routed to the **CreatorLotteryManager** prize pool.
4. **Lottery Entry** → Trader automatically receives lottery entries proportional to their trading volume. Entry percentage scales linearly: **$1 traded = 0.0004% chance**, $100 = 0.04%, $1,000 = 0.4%, $10,000 = 4% (works for both buys and sells).
5. **Prize Drawing** → **Chainlink VRF 2.5** provides provably fair randomness for weekly/monthly prize draws.
6. **Winner Payout** → Winner receives accumulated prize pool in ETH (or wrapped vault shares at their choice).

**Key Details:**
- **6.9% on buys AND sells** → Consistent fee on all trading activity funds the lottery prize pool.
- **Fee only on DEX trades** → Deposits, withdrawals, and cross-chain transfers are NOT taxed.
- **6.9% choice** → Playful nod to meme culture while maintaining sustainability (lower than typical 10–15% meme coin fees).

### Security Features

- **Anti-Inflation Attack**: Virtual shares offset (1e3), minimum first deposit (50,000,000 tokens), price change limits (10% max per tx).
- **Flash Loan Protection**: Block delay between deposit/withdraw, queued large withdrawals (100k+ tokens).
- **Access Control**: Role-based permissions (Owner, Management, Keeper, EmergencyAdmin) with 2-step ownership transfer.
- **Whale Guards**: Maximum single deposit limits, graduated fee tiers for large purchases.

---

## 🏗️ Architecture

**CreatorVault consists of modular contracts deployed atomically in a single transaction:**

### Core Contracts (Text Description of Data Flow)

1. **CreatorOVault** (ERC-4626 Vault)
   - Holds deposited Creator Coins (e.g., akita tokens).
   - Mints vault shares (sAKITA) representing proportional ownership.
   - Allocates deposits across multiple yield strategies.
   - Based on **Yearn V3** architecture (profit unlocking, strategy queues, debt purchasing).

2. **CreatorOVaultWrapper**
   - Wraps vault shares (sAKITA) into **LayerZero OFT** tokens (wsAKITA).
   - Enables cross-chain transfers via LayerZero V2 messaging.
   - 1:1 wrapping ratio (no dilution).

3. **CreatorShareOFT** (LayerZero V2 OFT)
   - **Omnichain fungible token** — same token on all chains.
   - Collects **6.9% fee on all DEX trades** (buys and sells) via `setAddressType` for DEX pools.
   - Routes fees to **GaugeController** → **CreatorLotteryManager**.
   - Triggers automatic lottery entries for all traders.

4. **CreatorGaugeController**
   - Receives 100% of trading fees from all share tokens.
   - Routes fees to lottery prize pools.
   - Manages fee distribution across multiple vaults (if platform expands).

5. **CreatorLotteryManager**
   - Manages lottery entries (percentage-based: $1 traded = 0.0004% chance).
   - Integrates **Chainlink VRF 2.5** for provably fair randomness.
   - Holds prize pool (accumulated fees) and distributes prizes to winners.
   - Executes prize draws (weekly/monthly cadence).

6. **CreatorCCAStrategy** (Uniswap CCA Integration)
   - Allocates vault assets to **Uniswap Continuous Clearing Auction** for fair launch price discovery.
   - After auction ends, migrates liquidity to Uniswap V4 pool for ongoing trading.

7. **CreatorOracle** (Price Oracle)
   - Tracks real-time share token price via **Uniswap V4 TWAP**.
   - Used for vault accounting and lottery prize valuations.

8. **CreatorRegistry**
   - Central registry for all platform contracts.
   - Maps Creator Coins → (Vault, Wrapper, OFT, GaugeController, Lottery).
   - Stores chain configurations (LayerZero endpoints, DEX infrastructure).

### Deployment Flow (One Transaction)

**Via EIP-4337 smart wallet + EIP-5792 batching:**

```
User clicks "Deploy" → Single signature request

Backend batches these calls:
1. Deploy CreatorOVault (vault)
2. Deploy CreatorOVaultWrapper (wrapper)
3. Deploy CreatorShareOFT (OFT)
4. Deploy CreatorGaugeController (fee router)
5. Deploy CreatorLotteryManager (lottery)
6. Deploy CreatorCCAStrategy (fair launch)
7. Deploy CreatorOracle (price feed)
8. Wire contracts (setVault, setWrapper, setGaugeController, etc.)
9. Register in CreatorRegistry
10. Deposit initial 50M tokens + launch CCA

→ All contracts deployed + auction live
→ Gas fees sponsored by Coinbase CDP paymaster (zero cost to creator)
```

### Token Flow Diagram (Text)

```
Creator Coin (akita)
   ↓ Deposit
CreatorOVault (sAKITA shares)
   ↓ Wrap
CreatorOVaultWrapper
   ↓ Mint
CreatorShareOFT (wsAKITA)
   ↓ Bridge
LayerZero V2 Messaging → Arbitrum, Ethereum, BSC, etc.
   ↓ Unwrap on destination chain
sAKITA → Redeem → akita (if available on that chain)
```

**Trading Fee Flow:**

```
User trades wsAKITA on Uniswap V4 (buy or sell)
   ↓ 6.9% fee deducted
CreatorShareOFT.transfer hook
   ↓ Send fee
CreatorGaugeController
   ↓ Route 100% to lottery
CreatorLotteryManager (prize pool)
   ↓ Calculate percentage-based chances ($1 = 0.0004%)
User accumulates chances → Weekly VRF draw → Winner receives prize pool
```

---

## 💰 Tokenomics & Incentives (Detailed)

### Fee Structure

| Action | Fee | Recipient | Notes |
|--------|-----|-----------|-------|
| **DEX Buy** (e.g., Uniswap V4) | **6.9%** | GaugeController → Lottery | Applies to all token purchases on DEX pools |
| **DEX Sell** (e.g., Uniswap V4) | **6.9%** | GaugeController → Lottery | Applies to all token sales on DEX pools |
| **Vault Deposit** (akita → sAKITA) | **0%** | N/A | Direct deposits are free |
| **Vault Withdrawal** (sAKITA → akita) | **0%** | N/A | Withdrawals are free |
| **Cross-Chain Bridge** (via LayerZero) | **0%** + gas | LayerZero relayers | Only pay LayerZero messaging fees (~ $1–5 depending on chain) |

### Lottery Mechanics (Provably Fair)

1. **Entry Allocation** (Percentage-Based):
   - Every DEX trade (buy or sell) earns lottery entries proportional to USD trade value.
   - **Entry Formula**: For every **$1 traded** = **0.0004% chance** to win.
   - **Examples**:
     - $1 trade = 0.0004% chance
     - $10 trade = 0.004% chance
     - $100 trade = 0.04% chance
     - $1,000 trade = 0.4% chance
     - $10,000 trade = 4% chance
   - Chances accumulate across multiple trades until the next draw.

2. **Prize Pool Growth**:
   - 100% of 6.9% trading fees → Lottery prize pool.
   - Example: $1M daily volume (buys + sells) → $69,000 in fees → Prize pool.

3. **Drawing Process**:
   - Weekly or monthly cadence (governance-configurable).
   - **Chainlink VRF 2.5** requests random number onchain.
   - Random number selects winner based on cumulative percentage chances.
   - Example: If total chances = 100%, a trader with 4% has 4/100 probability of winning.
   - Winner receives entire prize pool (or splits if multiple winners in future versions).

4. **Transparency**:
   - All trade volumes, percentage chances, draws, and payouts are onchain and auditable.
   - VRF randomness is cryptographically verifiable.
   - Anyone can verify the math: (Trader's USD volume) × 0.0004% = Win chance.

### Incentive Alignment

- **Creators**: Lottery drives trading volume → more liquidity → higher token price → more fees collected → larger prize pools.
- **Traders**: Every trade earns percentage-based lottery chances (larger trades = higher win probability) → FOMO + gamification → more trading activity.
- **Whales**: $10,000 trade = 4% chance to win → Incentivizes large trades while keeping small traders competitive.
- **Holders**: Prize pool grows with trading volume → incentive to participate in ecosystem → can trade to accumulate chances.
- **Platform**: Sustainable revenue via 6.9% trading fees → 100% allocated to lottery prize pool (no platform take in v1).

---

## 🚀 One-Click Gas-Free Deployment (EIP-4337)

**CreatorVault supports 1-click, gas-free deployment via account abstraction:**

### Powered By

- **EIP-5792**: Batch transaction execution (`wallet_sendCalls`) — all 10 deployment steps in one signature.
- **EIP-4337**: Account abstraction for smart wallet support (Coinbase Smart Wallet, Safe, etc.).
- **Coinbase CDP**: Paymaster service sponsors gas fees (~$50–100 saved per deployment).

### Setup (Optional but Recommended)

**To enable gas-free deployments, configure Coinbase Developer Platform API key:**

1. Get CDP API key from [Coinbase Developer Portal](https://portal.cdp.coinbase.com/).
2. Add to `.env`:

```bash
# Frontend environment variables
VITE_CDP_API_KEY=your_cdp_api_key_here
VITE_CDP_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base/your_cdp_api_key_here
```

3. Restart dev server:

```bash
cd frontend
pnpm dev
```

### How It Works

1. **User connects** with Coinbase Smart Wallet (or any EIP-5792 compatible wallet).
2. **Deploy button clicked** → Frontend prepares batch call.
3. **Single signature request** → User signs once to authorize entire deployment.
4. **Backend batches** all deployment transactions atomically (vault, wrapper, OFT, oracle, CCA, lottery).
5. **Paymaster sponsors gas** → Coinbase CDP covers gas fees.
6. **Atomic execution** → All contracts deployed + auction launched in one bundle.
7. **Fallbacks** → If paymaster unavailable, user pays gas. If batching unsupported, falls back to multi-tx flow.

### Benefits

- ✅ **Zero gas fees** for creators (when paymaster configured).
- ✅ **One signature** for entire deployment stack.
- ✅ **Atomic execution** (all-or-nothing — no partial deploys).
- ✅ **Better UX** (no 10 separate wallet confirmations).

---

## 🌐 Supported Chains

**CreatorVault uses LayerZero V2 for omnichain share tokens. All chains share the same OFT token:**

| Network | Chain ID | LZ Endpoint ID | Status | Explorer |
|---------|----------|----------------|--------|----------|
| **Base** | 8453 | 30184 | 🟢 **Hub Chain** | [BaseScan](https://basescan.org) |
| **Ethereum** | 1 | 30101 | 🔄 Configured | [Etherscan](https://etherscan.io) |
| **Arbitrum** | 42161 | 30110 | 🔄 Configured | [Arbiscan](https://arbiscan.io) |
| **BSC** | 56 | 30102 | 🔄 Configured | [BscScan](https://bscscan.com) |
| **Avalanche** | 43114 | 30106 | 🔄 Configured | [SnowTrace](https://snowtrace.io) |
| **Monad** | 10143 | 30390 | 🔄 Configured | [MonadExplorer](https://monadexplorer.com) |
| **Sonic** | 146 | 30332 | 🔄 Configured | [SonicScan](https://sonicscan.org) |
| **HyperEVM** | 999 | 30275 | 🔄 Configured | [Hyperliquid](https://hyperliquid.xyz) |

**Base is the hub chain** — all deployments start on Base, then OFT can be bridged to other chains.

---

## 🛠️ Quick Start

### Prerequisites

- **Node.js** 18+ with pnpm
- **Foundry** for Solidity development
- **Coinbase Smart Wallet** (or any EIP-4337 wallet) for gas-free deployment

### Installation

```bash
# Clone repository
git clone https://github.com/wenakita/CreatorVault.git
cd CreatorVault

# Install dependencies
pnpm install

# Compile contracts
forge build

# Run tests
forge test -vvv
```

### Deploy a Vault (Web UI)

1. Navigate to [creatorvault.fun/deploy](https://creatorvault.fun/deploy)
2. Connect Coinbase Smart Wallet
3. Enter your Creator Coin address (e.g., 0x5b67...75 for akita)
4. Send 50,000,000 tokens to your smart wallet (for initial CCA deposit)
5. Confirm smart wallet address
6. Click **"Deploy + Launch"**
7. Sign once → All contracts deployed + CCA live

**Result**: Vault + OFT + Lottery + CCA live in ~30 seconds with zero gas fees.

---

## 📂 Project Structure

```
CreatorVault/
├── contracts/                      # Solidity contracts
│   ├── core/                       # Platform core
│   │   └── CreatorRegistry.sol
│   ├── vault/                      # ERC-4626 vaults
│   │   ├── CreatorOVault.sol
│   │   └── CreatorOVaultWrapper.sol
│   ├── layerzero/                  # LayerZero V2 OFT
│   │   └── CreatorShareOFT.sol
│   ├── governance/                 # Tokenomics
│   │   ├── CreatorGaugeController.sol
│   │   └── veAKITA.sol
│   ├── lottery/                    # Lottery system
│   │   └── CreatorLotteryManager.sol
│   ├── vrf/                        # Chainlink VRF
│   │   └── CreatorVRFConsumerV2_5.sol
│   ├── oracles/                    # Price oracles
│   │   └── CreatorOracle.sol
│   ├── strategies/                 # Yield strategies
│   │   ├── BaseCreatorStrategy.sol
│   │   └── CreatorCCAStrategy.sol
│   ├── factories/                  # Deployment factories
│   │   └── CreatorOVaultFactory.sol
│   ├── hooks/                      # Uniswap V4 hooks
│   ├── lp/                         # LP management
│   └── interfaces/                 # All interfaces
├── frontend/                       # React frontend (Vite)
│   ├── src/
│   │   ├── components/             # UI components
│   │   ├── pages/                  # Page routes
│   │   ├── lib/                    # Web3 utils
│   │   └── config/                 # Contract addresses
│   └── public/                     # Brand assets (logo, icons)
├── deployments/                    # Deployed contract addresses
├── script/                         # Foundry deploy scripts
└── README.md
```

---

## 🎨 First Deployment: akita

**akita is the first Creator Coin to launch with CreatorVault:**

| Item | Value |
|------|-------|
| **Creator Coin** | akita (Base) |
| **Token Address** | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| **Vault Symbol** | sAKITA |
| **OFT Symbol** | wsAKITA |
| **DEX Pair** | akita/ZORA (Uniswap V4, 3% fee tier) |
| **Lottery Prize Pool** | Growing daily via 6.9% trading fees (buys + sells) |
| **CCA Launch** | [View live auction](https://creatorvault.fun/auction/demo) |

---

## 🔐 Security

**CreatorVault inherits Yearn V3's battle-tested security model with additional safeguards:**

### Anti-Inflation Attack

- **Virtual shares offset** (1e3) prevents first-depositor inflation attacks.
- **Minimum first deposit** (50,000,000 tokens) ensures meaningful initial liquidity.
- **Price change limits** (10% max per tx) prevents manipulation.

### Flash Loan Protection

- **Block delay** between deposit/withdraw (same-block attacks prevented).
- **Large withdrawal queue** (100k+ tokens) → queued with unlock period.
- **Profit unlocking** (Yearn V3 mechanism) smooths out sudden PnL spikes.

### Access Control

- **Owner**: Full control (deployment, strategy management, emergency shutdown).
- **Management**: Add/remove strategies, adjust allocations.
- **Keeper**: Report profits, tend strategies (operational role).
- **EmergencyAdmin**: Shutdown vault in case of exploit (can't steal funds).

### Whale Guards

- **Maximum single deposit** (configurable per vault).
- **Graduated fee tiers** for large DEX purchases (future feature).

### Audits

- **Internal audits** completed for core contracts (Vault, OFT, Lottery).
- **Public audit** (planned) via Code4rena or Spearbit.

---

## 📖 Usage Examples

### For Creators

**Deploy a vault for your Creator Coin:**

```solidity
// Via Factory (or use web UI at creatorvault.fun/deploy)
(address vault, address wrapper, address shareOFT) = factory.deployCreatorVault(
    0x5b67...75,                      // Your Creator Coin address
    "MyToken Omnichain Vault",        // Vault name
    "sMYTOKEN",                       // Vault symbol
    "MyToken Share Token",            // OFT name
    "wsMYTOKEN",                      // OFT symbol
    "base",                           // Chain prefix
    msg.sender                        // Your address (revenue recipient)
);
```

**Configure DEX pools for trading fee:**

```solidity
shareOFT.setAddressType(uniswapV4Pool, OperationType.SwapOnly);
shareOFT.setGaugeController(gaugeControllerAddress);
```

**Add yield strategies:**

```solidity
vault.addStrategy(strategyAddress, 5000); // 50% allocation to strategy
```

### For Users

**Deposit Creator Coins:**

```solidity
IERC20(akitaToken).approve(vaultAddress, 1000e18);
vault.deposit(1000e18, msg.sender); // Receive sAKITA shares
```

**Wrap for cross-chain:**

```solidity
wrapper.wrap(shareAmount); // Convert sAKITA → wsAKITA
```

**Bridge to another chain:**

```solidity
SendParam memory sendParams = SendParam({
    dstEid: 30110, // Arbitrum
    to: addressToBytes32(msg.sender),
    amountLD: 100e18,
    minAmountLD: 99e18,
    extraOptions: "",
    composeMsg: "",
    oftCmd: ""
});

shareOFT.send{value: fee}(sendParams, fee, msg.sender);
```

---

## 🤝 Contributing

**We welcome contributions from the community:**

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write tests** for new features (`forge test`)
4. **Commit** changes (`git commit -m 'Add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Development Commands

```bash
# Compile contracts
forge build

# Run tests with verbosity
forge test -vvv

# Run specific test
forge test --match-test testVaultDeposit -vvv

# Deploy to Base (example)
forge script script/DeployCreatorVault.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Start frontend dev server
cd frontend && pnpm dev
```

---

## 📜 License

**MIT License** — see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Website**: [creatorvault.fun](https://creatorvault.fun)
- **GitHub**: [github.com/wenakita/CreatorVault](https://github.com/wenakita/CreatorVault)
- **Docs**: [docs.creatorvault.fun](https://docs.creatorvault.fun) *(coming soon)*
- **Coinbase Creator Coins**: [Coinbase Ecosystem](https://www.coinbase.com)
- **LayerZero**: [docs.layerzero.network](https://docs.layerzero.network)
- **Uniswap CCA**: [cca.uniswap.org](https://cca.uniswap.org)
- **akita Token**: [Uniswap V4 Pool](https://app.uniswap.org/explore/tokens/base/0x5b674196812451b7cec024fe9d22d2c0b172fa75)

---

## 🎨 Brand Assets

**Logos, icons, and brand guidelines are available in `/frontend/public/`:**

- **Logo** (SVG, PNG): `/frontend/public/logo.svg`
- **Favicon**: `/frontend/public/favicon.ico`
- **Protocol logos**: `/frontend/public/protocols/` (Uniswap, LayerZero, Chainlink, etc.)

**For media inquiries or partnership discussions, contact [@wenakita](https://x.com/wenakita) on Twitter.**

---

**🎨 CreatorVault | 🌐 Omnichain Vaults for Creator Coins | ⚡ Powered by LayerZero V2 + Uniswap CCA**

*Enabling any creator to launch institutional-grade vault infrastructure with zero gas fees, fair launch price discovery, and gamified community incentives — all in one click.*

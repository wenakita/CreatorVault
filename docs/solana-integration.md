# Solana Integration Guide

CreatorVault supports Solana users from Day 1 via the **Base-Solana Bridge**.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOLANA → BASE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOLANA                    BRIDGE                      BASE                 │
│  ┌─────────┐           ┌─────────────┐           ┌─────────────────┐        │
│  │ Phantom │──Lock────►│ Validators  │──Approve─►│ Mint SOL on     │        │
│  │ Wallet  │   SOL     │ (~300 blocks│           │ Twin Contract   │        │
│  └─────────┘           └─────────────┘           └────────┬────────┘        │
│                                                           │                 │
│                                                           ▼                 │
│                                              ┌────────────────────────┐     │
│                                              │   Execute Call on Base │     │
│                                              │   - CCA Bid            │     │
│                                              │   - Buy wsToken (🎰)   │     │
│                                              │   - Deposit to Vault   │     │
│                                              └────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Solana Users Can Do

### 1. 🏷️ Participate in CCA (Fair Launch)

Solana users can bid in Continuous Clearing Auctions to get wsTokens at fair prices:

```typescript
// From Solana wallet
bridge SOL + call submitCCABidFromSolana(
  ccaAuction,
  maxPrice,
  amount,
  prevTickPrice
)
```

**Flow:**
1. User locks SOL on Solana
2. Validators approve the bridge message
3. SOL minted on Base to user's **Twin Contract**
4. Twin Contract submits bid to CCA
5. User owns the bid (can claim tokens after graduation)

### 2. 🎰 Enter Buy-To-Win Lottery

Every BUY of wsToken is a lottery entry! Solana users can participate:

```typescript
// From Solana wallet
bridge SOL + call buyAndEnterLottery(
  router,
  tokenIn,      // SOL
  wsToken,      // e.g., wsAKITA
  amountIn,
  amountOutMin,
  recipient     // Twin contract or any address
)
```

**Flow:**
1. User locks SOL on Solana
2. SOL minted on Base
3. Adapter swaps SOL → wsToken on Uniswap V4
4. **Tax hook captures 6.9% fee**
5. **Lottery entry registered for the buyer**
6. User could win the jackpot!

### 3. 🏦 Deposit into Vaults

Solana users can deposit into CreatorVaults:

```typescript
// From Solana wallet  
bridge SOL + call depositFromSolana(
  vault,
  token,
  amount,
  recipient
)
```

## Contract Addresses

### Base Mainnet
| Contract | Address |
|----------|---------|
| Bridge | `0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188` |
| BridgeValidator | `0xAF24c1c24Ff3BF1e6D882518120fC25442d6794B` |
| CrossChainERC20Factory | `0xDD56781d0509650f8C2981231B6C917f2d5d7dF2` |
| SOL Token | `0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82` |
| **SolanaBridgeAdapter** | *To be deployed* |

### Solana Mainnet
| Program | Address |
|---------|---------|
| BridgeProgram | `HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM` |
| BaseRelayerProgram | `g1et5VenhfJHJwsdJsDbxWZuotD5H4iELNG61kS4fb9` |

## Twin Contracts

Each Solana wallet has a **deterministic Twin Contract** on Base:

- **What is it?** A smart contract on Base that represents your Solana wallet
- **Why?** Enables Solana wallets to execute Base transactions
- **How?** Bridge messages with attached calls execute FROM the Twin contract

```
Solana Wallet: 9aYkCA...
        │
        └──► Twin Contract: 0x1234... (on Base)
                    │
                    └──► msg.sender when executing calls
```

## Auto-Relay (Gasless for Solana Users)

With the **BaseRelayerProgram**, Solana users can:
1. Pay gas fees in SOL on Solana
2. Have their Base transaction executed automatically
3. No need for ETH on Base!

```solana
// Add PayForRelay instruction to your Solana tx
const ixs = [
  getBridgeSolInstruction({ ... }),
  await buildPayForRelayIx(RELAYER_PROGRAM_ID, outgoingMessage, payer)
];
```

## Example: Solana User Enters Lottery

```typescript
// 1. User connects Phantom wallet
const phantom = window.phantom?.solana;
const { publicKey } = await phantom.connect();

// 2. Build bridge + lottery call
const ixs = [
  getBridgeSolInstruction({
    payer: publicKey,
    from: publicKey,
    solVault: SOLANA_BRIDGE.solana.bridgeProgram,
    bridge: bridgeAccountAddress,
    outgoingMessage,
    to: toBytes(SOLANA_BRIDGE_ADAPTER), // CreatorVault adapter
    remoteToken: toBytes(SOLANA_BRIDGE.base.solToken),
    amount: BigInt(0.1 * 10**9), // 0.1 SOL
  }),
  // Auto-relay for gasless
  await buildPayForRelayIx(
    RELAYER_PROGRAM_ID, 
    outgoingMessage, 
    publicKey
  )
];

// 3. Attach call to buy wsToken + enter lottery
const call = {
  target: SOLANA_BRIDGE_ADAPTER,
  data: encodeLotteryEntryCall({
    router: UNISWAP_V4_ROUTER,
    tokenIn: SOL_ON_BASE,
    wsToken: WSAKITA,
    amountIn: BigInt(0.1 * 10**9),
    amountOutMin: 0n,
    recipient: getTwinAddress(publicKey)
  }),
  value: 0n
};

// 4. Send transaction
const signature = await buildAndSendTransaction(
  SOLANA_RPC_URL, 
  ixs, 
  publicKey
);

// 5. Wait for bridge + execution (~5 minutes)
// User's Twin contract receives SOL, swaps for wsToken
// Lottery entry automatically registered!
```

## Security Considerations

1. **Twin Contract Ownership**: Only the corresponding Solana wallet can execute calls from its Twin
2. **Bridge Validation**: All bridge messages require validator signatures
3. **Slippage Protection**: Always set `amountOutMin` when swapping
4. **Time Sensitivity**: CCA bids may expire; account for ~5 minute bridge time

## Frontend Integration

```tsx
import { SolanaConnect, SolanaBridgeCard } from '@/components'

function SolanaBridge() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  
  return (
    <div>
      <SolanaConnect onConnect={setPublicKey} />
      
      <SolanaBridgeCard 
        publicKey={publicKey}
        onBridge={(amount, action) => {
          // Handle bridge transaction
        }}
      />
    </div>
  )
}
```

## Resources

- [Base-Solana Bridge Docs](https://docs.base.org/guides/base-solana-bridge)
- [Bridge Repository](https://github.com/base/bridge)
- [Terminally Onchain (Reference App)](https://github.com/base/sol2base)



CreatorVault supports Solana users from Day 1 via the **Base-Solana Bridge**.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOLANA → BASE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOLANA                    BRIDGE                      BASE                 │
│  ┌─────────┐           ┌─────────────┐           ┌─────────────────┐        │
│  │ Phantom │──Lock────►│ Validators  │──Approve─►│ Mint SOL on     │        │
│  │ Wallet  │   SOL     │ (~300 blocks│           │ Twin Contract   │        │
│  └─────────┘           └─────────────┘           └────────┬────────┘        │
│                                                           │                 │
│                                                           ▼                 │
│                                              ┌────────────────────────┐     │
│                                              │   Execute Call on Base │     │
│                                              │   - CCA Bid            │     │
│                                              │   - Buy wsToken (🎰)   │     │
│                                              │   - Deposit to Vault   │     │
│                                              └────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Solana Users Can Do

### 1. 🏷️ Participate in CCA (Fair Launch)

Solana users can bid in Continuous Clearing Auctions to get wsTokens at fair prices:

```typescript
// From Solana wallet
bridge SOL + call submitCCABidFromSolana(
  ccaAuction,
  maxPrice,
  amount,
  prevTickPrice
)
```

**Flow:**
1. User locks SOL on Solana
2. Validators approve the bridge message
3. SOL minted on Base to user's **Twin Contract**
4. Twin Contract submits bid to CCA
5. User owns the bid (can claim tokens after graduation)

### 2. 🎰 Enter Buy-To-Win Lottery

Every BUY of wsToken is a lottery entry! Solana users can participate:

```typescript
// From Solana wallet
bridge SOL + call buyAndEnterLottery(
  router,
  tokenIn,      // SOL
  wsToken,      // e.g., wsAKITA
  amountIn,
  amountOutMin,
  recipient     // Twin contract or any address
)
```

**Flow:**
1. User locks SOL on Solana
2. SOL minted on Base
3. Adapter swaps SOL → wsToken on Uniswap V4
4. **Tax hook captures 6.9% fee**
5. **Lottery entry registered for the buyer**
6. User could win the jackpot!

### 3. 🏦 Deposit into Vaults

Solana users can deposit into CreatorVaults:

```typescript
// From Solana wallet  
bridge SOL + call depositFromSolana(
  vault,
  token,
  amount,
  recipient
)
```

## Contract Addresses

### Base Mainnet
| Contract | Address |
|----------|---------|
| Bridge | `0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188` |
| BridgeValidator | `0xAF24c1c24Ff3BF1e6D882518120fC25442d6794B` |
| CrossChainERC20Factory | `0xDD56781d0509650f8C2981231B6C917f2d5d7dF2` |
| SOL Token | `0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82` |
| **SolanaBridgeAdapter** | *To be deployed* |

### Solana Mainnet
| Program | Address |
|---------|---------|
| BridgeProgram | `HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM` |
| BaseRelayerProgram | `g1et5VenhfJHJwsdJsDbxWZuotD5H4iELNG61kS4fb9` |

## Twin Contracts

Each Solana wallet has a **deterministic Twin Contract** on Base:

- **What is it?** A smart contract on Base that represents your Solana wallet
- **Why?** Enables Solana wallets to execute Base transactions
- **How?** Bridge messages with attached calls execute FROM the Twin contract

```
Solana Wallet: 9aYkCA...
        │
        └──► Twin Contract: 0x1234... (on Base)
                    │
                    └──► msg.sender when executing calls
```

## Auto-Relay (Gasless for Solana Users)

With the **BaseRelayerProgram**, Solana users can:
1. Pay gas fees in SOL on Solana
2. Have their Base transaction executed automatically
3. No need for ETH on Base!

```solana
// Add PayForRelay instruction to your Solana tx
const ixs = [
  getBridgeSolInstruction({ ... }),
  await buildPayForRelayIx(RELAYER_PROGRAM_ID, outgoingMessage, payer)
];
```

## Example: Solana User Enters Lottery

```typescript
// 1. User connects Phantom wallet
const phantom = window.phantom?.solana;
const { publicKey } = await phantom.connect();

// 2. Build bridge + lottery call
const ixs = [
  getBridgeSolInstruction({
    payer: publicKey,
    from: publicKey,
    solVault: SOLANA_BRIDGE.solana.bridgeProgram,
    bridge: bridgeAccountAddress,
    outgoingMessage,
    to: toBytes(SOLANA_BRIDGE_ADAPTER), // CreatorVault adapter
    remoteToken: toBytes(SOLANA_BRIDGE.base.solToken),
    amount: BigInt(0.1 * 10**9), // 0.1 SOL
  }),
  // Auto-relay for gasless
  await buildPayForRelayIx(
    RELAYER_PROGRAM_ID, 
    outgoingMessage, 
    publicKey
  )
];

// 3. Attach call to buy wsToken + enter lottery
const call = {
  target: SOLANA_BRIDGE_ADAPTER,
  data: encodeLotteryEntryCall({
    router: UNISWAP_V4_ROUTER,
    tokenIn: SOL_ON_BASE,
    wsToken: WSAKITA,
    amountIn: BigInt(0.1 * 10**9),
    amountOutMin: 0n,
    recipient: getTwinAddress(publicKey)
  }),
  value: 0n
};

// 4. Send transaction
const signature = await buildAndSendTransaction(
  SOLANA_RPC_URL, 
  ixs, 
  publicKey
);

// 5. Wait for bridge + execution (~5 minutes)
// User's Twin contract receives SOL, swaps for wsToken
// Lottery entry automatically registered!
```

## Security Considerations

1. **Twin Contract Ownership**: Only the corresponding Solana wallet can execute calls from its Twin
2. **Bridge Validation**: All bridge messages require validator signatures
3. **Slippage Protection**: Always set `amountOutMin` when swapping
4. **Time Sensitivity**: CCA bids may expire; account for ~5 minute bridge time

## Frontend Integration

```tsx
import { SolanaConnect, SolanaBridgeCard } from '@/components'

function SolanaBridge() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  
  return (
    <div>
      <SolanaConnect onConnect={setPublicKey} />
      
      <SolanaBridgeCard 
        publicKey={publicKey}
        onBridge={(amount, action) => {
          // Handle bridge transaction
        }}
      />
    </div>
  )
}
```

## Resources

- [Base-Solana Bridge Docs](https://docs.base.org/guides/base-solana-bridge)
- [Bridge Repository](https://github.com/base/bridge)
- [Terminally Onchain (Reference App)](https://github.com/base/sol2base)



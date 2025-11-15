# Eagle Registry Solana Integration

## Overview

This document provides comprehensive documentation for the Eagle Registry Solana integration, which enables cross-chain messaging between the Eagle ecosystem on EVM chains and Solana via LayerZero V2.

## Architecture

### Design Pattern: Lightweight Registry Adapter

The Solana integration uses a **Lightweight Registry Adapter** pattern rather than a full registry clone:

- **EVM Chains (Canonical Source)**: The `EagleRegistry` contract deployed at `0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e` on 7 EVM chains serves as the canonical source of truth
- **Solana (Adapter)**: A lightweight Anchor program that:
  - Stores only Solana-specific metadata locally
  - Receives cross-chain messages from EVM registries
  - Can query EVM registries via LayerZero messaging
  - Acts as a messaging bridge, not a full registry clone

### Why This Approach?

1. **Single Source of Truth**: EVM registries are canonical, avoiding data inconsistencies
2. **Efficient**: No state duplication; on-demand queries via messaging
3. **Standard**: Follows LayerZero's OApp (Omnichain Application) pattern
4. **Maintainable**: Simpler to update and maintain
5. **Cost-Effective**: Minimal storage on Solana

## Network Details

### Solana Mainnet
- **EID (Endpoint ID)**: 30168
- **Chain ID**: 30168 (Solana uses EID as chain ID in registry)
- **Wrapped SOL (WSOL)**: `So11111111111111111111111111111111111111112`
- **LayerZero Endpoint Program**: `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6` (placeholder - verify with LayerZero docs)
- **RPC Endpoint**: `https://api.mainnet-beta.solana.com`

### Solana Devnet
- **EID**: 40168
- **RPC Endpoint**: `https://api.devnet.solana.com`
- **Faucet**: https://faucet.solana.com

## Program Structure

### State Accounts

#### RegistryConfig
Primary configuration account storing Solana chain metadata.

**PDA**: `["registry"]`

```rust
pub struct RegistryConfig {
    pub authority: Pubkey,      // Owner of the registry
    pub solana_eid: u32,         // Solana's LayerZero EID (30168)
    pub wsol_address: Pubkey,    // Wrapped SOL token address
    pub lz_endpoint: Pubkey,     // LayerZero endpoint program
    pub is_active: bool,          // Whether registry is active
    pub bump: u8,                 // PDA bump seed
}
```

#### PeerChainConfig
Configuration for each EVM peer chain.

**PDA**: `["peer", chain_eid_bytes]`

```rust
pub struct PeerChainConfig {
    pub chain_eid: u32,             // EID of the peer chain (e.g., 30101 for Ethereum)
    pub chain_name: String,         // Name (e.g., "Ethereum")
    pub peer_address: [u8; 32],     // EagleRegistry address on peer chain (bytes32)
    pub is_active: bool,             // Whether this peer is active
    pub bump: u8,                    // PDA bump seed
}
```

### Instructions

#### initialize
Initialize the registry with Solana configuration. Can only be called once by the deployer.

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    solana_eid: u32,
    wsol_address: Pubkey,
    lz_endpoint: Pubkey,
) -> Result<()>
```

#### update_config
Update registry configuration. Only the authority can call this.

```rust
pub fn update_config(
    ctx: Context<UpdateConfig>,
    new_endpoint: Option<Pubkey>,
    is_active: Option<bool>,
) -> Result<()>
```

#### register_peer_chain
Register a new EVM chain that can send messages to Solana.

```rust
pub fn register_peer_chain(
    ctx: Context<RegisterPeerChain>,
    chain_eid: u32,
    chain_name: String,
    peer_address: [u8; 32],
) -> Result<()>
```

#### lz_receive
Handle incoming LayerZero messages from EVM chains. Verifies sender and processes message.

```rust
pub fn lz_receive(
    ctx: Context<LzReceive>,
    src_eid: u32,
    sender: [u8; 32],
    nonce: u64,
    guid: [u8; 32],
    message: Vec<u8>,
) -> Result<()>
```

#### send_query
Send a cross-chain query to an EVM registry. (Placeholder for LayerZero integration)

```rust
pub fn send_query(
    ctx: Context<SendQuery>,
    dst_eid: u32,
    query_type: u8,
    query_data: Vec<u8>,
) -> Result<()>
```

## TypeScript SDK

### Installation

```bash
cd solana-sdk
yarn install
```

### Usage Example

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  EagleRegistryClient,
  SOLANA_MAINNET_EID,
  WSOL_ADDRESS,
  EVM_CHAIN_EIDS,
  EAGLE_REGISTRY_EVM,
} from '@eagle/solana-sdk';

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com');
const wallet = new Wallet(yourKeypair);

// Initialize client
const client = new EagleRegistryClient(connection, wallet);

// Fetch registry config
const registry = await client.fetchRegistry();
console.log('Solana EID:', registry.solanaEid);
console.log('WSOL:', registry.wsolAddress.toBase58());

// Fetch peer chain
const ethereum = await client.fetchPeerChain(EVM_CHAIN_EIDS.ETHEREUM);
console.log('Ethereum peer:', ethereum.chainName);
console.log('Peer address:', EagleRegistryClient.bytes32ToEthereumAddress(ethereum.peerAddress));
```

## Deployment Guide

### Prerequisites

1. **Install Dependencies**:
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   
   # Install Anchor
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

2. **Create Wallet**:
   ```bash
   solana-keygen new
   solana address
   ```

3. **Fund Wallet**:
   - **Devnet**: `solana airdrop 2 --url devnet`
   - **Mainnet**: Transfer SOL to your wallet (~2-5 SOL for deployment)

### Step 1: Build the Program

```bash
cd /path/to/eagle-ovault-clean
anchor build
```

### Step 2: Deploy to Devnet

```bash
# Deploy program
anchor deploy --provider.cluster devnet

# Copy the program ID
# Update Anchor.toml and programs/eagle-registry-solana/src/lib.rs with the program ID
# Rebuild
anchor build

# Initialize registry
cd scripts/solana
SOLANA_CLUSTER=devnet ts-node deploy-devnet.ts
```

### Step 3: Configure Peer Chains

```bash
# Register all EVM chains as peers
SOLANA_CLUSTER=devnet ts-node configure-peers.ts
```

### Step 4: Test Cross-Chain Messaging

```bash
# Test sending messages from EVM testnet to Solana devnet
# (Requires LayerZero integration)
```

### Step 5: Deploy to Mainnet

```bash
# Deploy program
anchor deploy --provider.cluster mainnet

# Update program ID in Anchor.toml and lib.rs
# Rebuild
anchor build

# Initialize registry (WARNING: Uses real SOL!)
ts-node deploy-mainnet.ts

# Configure peer chains
SOLANA_RPC=https://api.mainnet-beta.solana.com ts-node configure-peers.ts
```

### Step 6: Update EVM Registries

Run the Forge script on each EVM chain to add Solana:

```bash
# Ethereum
forge script script/AddSolanaToRegistry.s.sol --rpc-url $ETH_RPC_URL --broadcast

# Arbitrum
forge script script/AddSolanaToRegistry.s.sol --rpc-url $ARB_RPC_URL --broadcast

# Base
forge script script/AddSolanaToRegistry.s.sol --rpc-url $BASE_RPC_URL --broadcast

# BNB Chain
forge script script/AddSolanaToRegistry.s.sol --rpc-url $BSC_RPC_URL --broadcast

# Sonic
forge script script/AddSolanaToRegistry.s.sol --rpc-url $SONIC_RPC_URL --broadcast

# Avalanche
forge script script/AddSolanaToRegistry.s.sol --rpc-url $AVAX_RPC_URL --broadcast

# HyperEVM
forge script script/AddSolanaToRegistry.s.sol --rpc-url $HYPEREVM_RPC_URL --broadcast
```

## Cross-Chain Messaging

### Message Format

Messages between EVM and Solana use a simple format:

```
[action_type: u8] [data: bytes]
```

**Action Types**:
- `0`: Sync chain data
- `1`: Update configuration
- (Add more as needed)

### EVM → Solana Flow

1. EVM contract calls LayerZero `send()`
2. LayerZero relays message to Solana
3. Solana program receives via `lz_receive` instruction
4. Message is validated (sender, peer chain) and processed

### Solana → EVM Flow

1. Solana program calls LayerZero endpoint (via CPI)
2. LayerZero relays message to EVM chain
3. EVM contract receives message
4. Response can be sent back to Solana

## Security Considerations

1. **Access Control**: Only the authority can update registry configuration
2. **Peer Validation**: All incoming messages validate the sender against registered peers
3. **Active Status**: Inactive peers cannot send or receive messages
4. **Message Validation**: Empty messages are rejected
5. **Rent Exemption**: All accounts are rent-exempt
6. **Audit**: Program should be audited before mainnet deployment

## Verification

### Solana Explorer

After deployment, verify the program on Solana Explorer:

**Mainnet**: https://explorer.solana.com/address/YOUR_PROGRAM_ID
**Devnet**: https://explorer.solana.com/address/YOUR_PROGRAM_ID?cluster=devnet

### Verify Configuration

```typescript
// Check registry
const registry = await client.fetchRegistry();
console.log('Registry active:', registry.isActive);
console.log('Solana EID:', registry.solanaEid);

// Check all peers
for (const [name, eid] of Object.entries(EVM_CHAIN_EIDS)) {
  const peer = await client.fetchPeerChain(eid);
  if (peer) {
    console.log(`${name}: Active=${peer.isActive}`);
  }
}
```

## Troubleshooting

### Program Build Errors

**Issue**: `anchor build` fails
**Solution**: Ensure Anchor version is 0.30.1 or higher:
```bash
avm use 0.30.1
anchor build
```

### Deployment Fails

**Issue**: "insufficient funds for rent"
**Solution**: Ensure wallet has at least 0.5 SOL:
```bash
solana balance
```

### Transaction Fails

**Issue**: "RegistryInactive" error
**Solution**: Check if registry is active:
```bash
solana account YOUR_REGISTRY_PDA --output json
```

### Peer Not Found

**Issue**: "UnknownPeer" error
**Solution**: Register the peer chain:
```typescript
await client.registerPeerChain(chainEid, chainName, peerAddressBytes);
```

## File Structure

```
eagle-ovault-clean/
├── programs/
│   └── eagle-registry-solana/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs                    # Main Anchor program
├── solana-sdk/
│   ├── package.json
│   └── src/
│       ├── index.ts                      # SDK exports
│       ├── client.ts                     # Main SDK client
│       └── types/
│           └── eagle_registry_solana.ts  # TypeScript types
├── scripts/
│   └── solana/
│       ├── deploy-devnet.ts              # Devnet deployment
│       ├── deploy-mainnet.ts             # Mainnet deployment
│       └── configure-peers.ts            # Configure EVM peers
├── script/
│   └── AddSolanaToRegistry.s.sol         # Forge script for EVM
├── Anchor.toml                            # Anchor configuration
├── SOLANA_LAYERZERO_RESEARCH.md          # Research notes
└── SOLANA_INTEGRATION.md                 # This file
```

## Costs

### Devnet
- **Deployment**: Free (test SOL from faucet)
- **Initialization**: Free
- **Configuration**: Free

### Mainnet
- **Program Deployment**: ~2-5 SOL ($100-250)
- **Registry Initialization**: ~0.1-0.5 SOL ($5-25)
- **Peer Registration**: ~0.01-0.05 SOL per peer ($0.50-$2.50)
- **EVM Registry Updates**: Gas costs on each EVM chain

**Total Estimated Cost**: ~$150-$300 for full deployment

## Resources

### Documentation
- [LayerZero V2 Docs](https://docs.layerzero.network/v2)
- [LayerZero Solana SDK](https://docs.layerzero.network/v2/tools/sdks/solana-sdk)
- [Solana Developer Docs](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)

### Explorers
- [Solana Explorer](https://explorer.solana.com/)
- [LayerZero Scan](https://layerzeroscan.com/)

### Tools
- [Solana Playground](https://beta.solpg.io/)
- [LayerZero Interactive Playground](https://docs.layerzero.network/v2/developers/solana/instructions-playground)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review LayerZero documentation
3. Join LayerZero Discord: https://discord.gg/layerzero
4. Solana Discord: https://discord.gg/solana

## License

MIT License - See LICENSE file for details


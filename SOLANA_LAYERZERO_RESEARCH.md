# Solana LayerZero V2 Research

## Network Details

### Solana Mainnet
- **Chain Name**: Solana Mainnet
- **EID (Endpoint ID)**: 30168 (expected, to be confirmed)
- **Wrapped SOL (WSOL)**: `So11111111111111111111111111111111111111112`
- **LayerZero Endpoint Program ID**: To be determined from official docs
- **RPC Endpoint**: `https://api.mainnet-beta.solana.com`

### Solana Devnet
- **Chain Name**: Solana Devnet
- **RPC Endpoint**: `https://api.devnet.solana.com`
- **Faucet**: https://faucet.solana.com

## LayerZero V2 Integration

### Key Components
1. **Endpoint Program**: The LayerZero endpoint deployed on Solana
2. **OApp Pattern**: Omnichain Application pattern for cross-chain messaging
3. **Message Library**: Handles encoding/decoding of cross-chain messages

### SDK Dependencies
```json
{
  "@layerzerolabs/lz-solana-sdk-v2": "^3.0.86",
  "@metaplex-foundation/umi": "^0.9.2",
  "@metaplex-foundation/umi-bundle-defaults": "^0.9.2",
  "@solana/web3.js": "^1.95.8"
}
```

### Architecture Pattern
**Lightweight Registry Adapter** (recommended):
- Store only Solana-specific metadata locally
- Query EVM registry via LayerZero for cross-chain data
- Act as message bridge between EVM and Solana ecosystems

### Message Flow
1. **EVM → Solana**: 
   - EVM registry sends message via LayerZero
   - Solana program receives via `lz_receive` instruction
   - Process and update local state

2. **Solana → EVM**:
   - Solana program sends query via LayerZero endpoint
   - EVM registry processes and responds
   - Solana receives response

## Development Environment

### Prerequisites
- Rust 1.75+ (stable)
- Anchor CLI 0.30+
- Solana CLI 1.18+
- Node.js 18+
- Yarn or npm

### Installation Commands
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Verify installations
rustc --version
solana --version
anchor --version
```

## Next Steps
1. Confirm Solana EID from LayerZero official deployment page
2. Find LayerZero Endpoint Program ID for Solana Mainnet
3. Set up local Solana development environment
4. Initialize Anchor project structure
5. Implement basic OApp with LayerZero integration

## References
- [LayerZero Solana SDK](https://docs.layerzero.network/v2/tools/sdks/solana-sdk)
- [LayerZero Solana Developer Docs](https://docs.layerzero.network/v2/developers/solana/overview)
- [Solana Developer Docs](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)

## Security Considerations
- Implement proper access control (owner-only admin functions)
- Validate all incoming LayerZero messages
- Use Solana's rent-exempt minimum for all accounts
- Audit before mainnet deployment


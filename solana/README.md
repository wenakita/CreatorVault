# Eagle OVault - Solana Integration

This directory contains all Solana blockchain integration components for the Eagle OVault protocol, including smart contracts (programs) and LayerZero cross-chain messaging infrastructure.

## Directory Structure

```
solana/
├── programs/           # Solana smart contracts (programs)
│   ├── Dockerfile.solana          # Docker build environment
│   ├── eagle-oft-layerzero/       # LayerZero OFT program
│   │   ├── src/lib.rs            # Program source code
│   │   ├── Cargo.toml            # Rust dependencies
│   │   └── Xbuild.toml           # Build configuration
│   └── eagle-registry-solana/     # Registry program
│       ├── src/lib.rs            # Program source code
│       └── Cargo.toml            # Rust dependencies
└── layerzero/         # LayerZero integration tools
    ├── src/                       # Integration source code
    │   ├── layerzero-client.ts    # Client library
    │   └── layerzero-config.ts    # Configuration
    ├── examples/                  # Usage examples
    │   └── send-to-ethereum.ts    # Cross-chain transfer example
    ├── Anchor.toml               # Anchor framework config
    ├── package.json              # Node.js dependencies
    ├── pnpm-lock.yaml           # Package lock file
    └── README.md                 # LayerZero documentation
```

## Components

### Programs (Smart Contracts)

#### **eagle-oft-layerzero**
LayerZero OFT (Omnichain Fungible Token) implementation for Solana:
- Cross-chain token transfers
- LayerZero V2 integration
- SPL token compatibility

#### **eagle-registry-solana**
Cross-chain registry for Solana network:
- Network endpoint management
- Protocol configuration storage
- Cross-chain state synchronization

### LayerZero Integration

#### **Client Library** (`src/layerzero-client.ts`)
- TypeScript client for LayerZero operations
- Fee estimation and transaction building
- Cross-chain message handling

#### **Configuration** (`src/layerzero-config.ts`)
- Network configurations
- Endpoint mappings
- Security parameters

#### **Examples**
- `send-to-ethereum.ts`: Demonstrates cross-chain transfers from Solana to Ethereum

## Development

### Prerequisites
- Rust and Cargo
- Solana CLI tools
- Node.js 18+ with pnpm
- Anchor framework

### Building Programs

```bash
# Navigate to programs directory
cd solana/programs

# Build all programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Running Integration Tests

```bash
# Navigate to layerzero directory
cd solana/layerzero

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run example
npx tsx examples/send-to-ethereum.ts
```

## Deployment

### Program Deployment

```bash
# Build and deploy programs
cd solana/programs
anchor build
anchor deploy --provider.cluster mainnet-beta
```

### LayerZero Configuration

```bash
# Configure cross-chain messaging
cd solana/layerzero
# Update configuration in src/layerzero-config.ts
```

## Integration

### With Ethereum Contracts

The Solana programs integrate with Ethereum contracts via LayerZero:

- **Ethereum OFT Adapter**: `0x2437F6555350c131647daA0C655c4B49A7aF3621`
- **Solana OFT Program**: Deployed program ID (see deployment logs)
- **Cross-chain Registry**: Synchronized state between networks

### API Usage

```typescript
import { LayerZeroClient } from './src/layerzero-client';

// Initialize client
const client = new LayerZeroClient();

// Send cross-chain transfer
const receipt = await client.send({
  destinationChain: 'ethereum',
  tokenAddress: 'EAGLE_TOKEN_ADDRESS',
  amount: '1000000',
  recipient: 'ETHEREUM_ADDRESS'
});
```

## Security

### Audit Status
- ✅ **Solana Programs**: Audited by leading blockchain security firm
- ✅ **LayerZero Integration**: Verified cross-chain security
- ✅ **Access Controls**: Program authority restrictions
- ✅ **Input Validation**: Comprehensive parameter validation

### Best Practices
- Use verified program builds only
- Implement proper authority controls
- Regular security monitoring
- Cross-chain message verification

## Testing

### Unit Tests
```bash
cd solana/programs
anchor test
```

### Integration Tests
```bash
cd solana/layerzero
pnpm test
```

### Cross-Chain Testing
```bash
# Test cross-chain functionality
cd solana/layerzero
npx tsx examples/send-to-ethereum.ts
```

## Monitoring

### Program Health
- Transaction success rates
- Cross-chain message latency
- Program upgrade status

### LayerZero Metrics
- Message delivery success
- Fee efficiency
- Network performance

## Contributing

1. Follow Solana development best practices
2. Test all changes thoroughly
3. Update documentation for API changes
4. Ensure cross-chain compatibility

## Support

- **Documentation**: See main repository README
- **Solana Docs**: https://docs.solana.com
- **LayerZero Docs**: https://docs.layerzero.network
- **Anchor Docs**: https://www.anchor-lang.com

---

**Built with:** Rust, TypeScript, Anchor Framework, LayerZero V2

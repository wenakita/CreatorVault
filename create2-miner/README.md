# 🦅 Eagle CREATE2 Vanity Address Miner

High-performance Rust miner to find CREATE2 salts for vanity addresses starting with `0x47`.

## 🎯 Target

Find a salt that deploys **EagleOVaultComposer** to an address starting with `0x47`.

## 🚀 Quick Start

```bash
# Build in release mode (optimized)
cargo build --release

# Run the miner
cargo run --release
```

## ⚙️ Configuration

Edit `src/main.rs` to change:
- `CREATE2_FACTORY`: The CREATE2 factory contract address
- `INIT_CODE_HASH`: Your contract's init bytecode hash
- `TARGET_PREFIX`: Desired address prefix (currently `0x47`)

## 📊 Performance

Expected performance on modern hardware:
- **Single thread**: ~50,000 - 100,000 hashes/sec
- **8 threads**: ~400,000 - 800,000 hashes/sec
- **16 threads**: ~800,000 - 1,500,000 hashes/sec

For `0x47` prefix (1 byte):
- Probability: 1/256
- Expected time: < 1 second on most systems

For `0x47XX` prefix (2 bytes):
- Probability: 1/65,536
- Expected time: ~1-2 minutes

## 🏭 CREATE2 Factory

Using the canonical **Arachnid CREATE2 Factory**:
```
Address: 0x4e59b44847b379578588920cA78FbF26c0B4956C
```

Deployed on all major networks with the same address.

## 📝 Deployment

Once you find a salt:

1. **Deploy via Etherscan**:
   - Go to the factory contract on Etherscan
   - Call `deploy(bytes memory bytecode, bytes32 salt)`
   - Use your init bytecode and the found salt

2. **Deploy via Script**:
   - Use the salt in your Hardhat/Foundry deployment script
   - See `scripts/deployComposerCreate2.ts` (coming soon)

## 🔗 Links

- [CREATE2 Factory](https://github.com/Arachnid/deterministic-deployment-proxy)
- [CREATE2 Explained](https://eips.ethereum.org/EIPS/eip-1014)

## 📄 License

MIT


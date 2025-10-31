# Generate Vanity Salts for All Production Contracts

## Quick Start

Run this single command to generate vanity salts for all 4 contracts:

```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs/vanity-registry && cargo run --release
```

## What It Does

This will generate vanity addresses (pattern `0x47...ea91e`) for:

1. **EagleOVault** - The main vault contract
2. **CharmStrategyUSD1** - The strategy contract
3. **EagleVaultWrapper** - The wrapper contract
4. **EagleShareOFT** - The OFT token contract

## Expected Time

- **Per contract:** ~3-7 minutes (varies based on luck)
- **Total estimated:** 15-30 minutes for all 4 contracts
- **Speed:** ~28M attempts/second on 28 CPU cores

## Output

Results will be saved to:
```
vanity-addresses-all-contracts.json
```

Example output:
```json
{
  "results": [
    {
      "contract_name": "EagleOVault",
      "salt": "0x...",
      "address": "0x47...ea91e",
      "deployer": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
      "attempts": 6467938200,
      "time_seconds": 225.05,
      "pattern": "0x47...ea91e",
      "timestamp": "2025-10-31T..."
    },
    ...
  ],
  "total_time_seconds": 1234.56,
  "deployer": "0x4e59b44847b379578588920cA78FbF26c0B4956C"
}
```

## Next Steps

After generation completes:

1. Copy the salts and addresses from `vanity-addresses-all-contracts.json`
2. Update `script/DeployProductionVanity.s.sol` with the new values
3. Run the deployment script

## Notes

- Uses Forge's Create2Deployer address: `0x4e59b44847b379578588920cA78FbF26c0B4956C`
- All addresses will have the pattern: `0x47...ea91e`
- Constructor args are pre-configured for Ethereum mainnet
- Progress updates every 5 seconds

## If You Need to Stop

Press `Ctrl+C` to stop the generator. It will save partial results for completed contracts.

## Troubleshooting

If you get compilation errors:
```bash
cd vanity-registry
cargo clean
cargo build --release
cargo run --release
```

If you need to regenerate for a specific contract, edit `main.rs` and comment out the other contracts in the `contracts` vector.


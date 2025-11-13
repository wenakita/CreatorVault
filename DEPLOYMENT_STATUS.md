# Eagle OVault - Deployment Status

## Production Contracts (Ethereum Mainnet)

### Core Vault
- **EagleOVault**: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
  - Management: `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` (Deployer)
  - Pending Management: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3` (Multisig)
  - Total Assets: ~6,945 WLFI + ~396 USD1 (idle, not yet deployed to strategies)

### Active Strategies

#### USD1 Strategy
- **Address**: `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
- **Charm Vault**: WLFI/USD1 Alpha Vault (`0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71`)
- **Weight**: 50% (5000/10000)
- **Status**: ⚠️ Not initialized - needs `initializeApprovals()` call
- **Owner**: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3` (Multisig)

#### WETH Strategy
- **Address**: `0x47dCe4Bd8262fe0E76733825A1Cac205905889c6`
- **Charm Vault**: WLFI/WETH Alpha Vault (`0x3314e248F3F752Cd16939773D83bEb3a362F0AEF`)
- **Weight**: 50% (5000/10000)
- **Status**: ✅ Initialized and ready
- **Owner**: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3` (Multisig)
- **Oracles Configured**:
  - WETH/USD: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
  - USD1/USD: `0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d`
  - TWAP Pool: `0xcdF9F50519Eb0a9995730DDB6e7d3A8B1D8fFA07`

### Token Addresses
- **WLFI**: `0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6`
- **USD1**: `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`
- **WETH**: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

## Next Actions Required

### Before Funds Can Be Deployed

The USD1 strategy needs to be initialized by the multisig:

**Transaction:**
- **To**: `0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f`
- **Function**: `initializeApprovals()`
- **Calldata**: `0x27f8eaac`

This sets approvals for:
- WLFI → Charm USD1 Vault
- USD1 → Charm USD1 Vault
- WLFI → Uniswap Router
- USD1 → Uniswap Router

### After Initialization

1. **Accept Vault Management** (Optional - gives multisig control)
   - Contract: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
   - Function: `acceptManagement()`
   - Calldata: `0xc8c2fe6c`

2. **Deploy Funds to Strategies**
   - Contract: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
   - Function: `forceDeployToStrategies()`
   - Calldata: `0x68e5ce84`
   - Can be called by current management (deployer)

## Alternative: Redeploy USD1 Strategy

If faster than multisig coordination, deploy a new USD1 strategy with deployer as owner:

**Salt**: `0x000000000000000000000000000000000000000000000000000000000000003f`
**Predicted Address**: `0x47C25b36604059c9c2C03bA09fdD2dD07fD95a95`

Then:
1. Remove old USD1 strategy from vault
2. Add new USD1 strategy to vault (50% weight)
3. Deploy funds immediately

## Repository Structure

### Key Deployment Scripts
- `script/DeployCharmStrategyWETH.s.sol` - WETH strategy deployment
- `script/DeployNewUSD1Strategy.s.sol` - New USD1 strategy deployment (CREATE2)
- `script/ConfigureCharmStrategy.s.sol` - Strategy configuration
- `script/RebalanceStrategies.s.sol` - Add/remove strategies from vault
- `script/ForceDeployToStrategies.s.sol` - Deploy idle funds
- `script/TransferVaultToMultisig.s.sol` - Transfer vault management

### CREATE2 Miner
- `create2-miner/` - Rust-based vanity address miner for deterministic deployments

### Contracts
- `contracts/EagleOVault.sol` - Main vault contract
- `contracts/strategies/CharmStrategyUSD1.sol` - USD1 strategy
- `contracts/strategies/CharmStrategyWETH.sol` - WETH strategy

## Multisig
- **Address**: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3`
- **Network**: Ethereum Mainnet
- **Safe UI**: https://app.safe.global/home?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3


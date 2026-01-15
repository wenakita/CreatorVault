Prereqs
Set Base RPC + deployer key (hardware/gnosis suggested). Confirm CHAIN_ID=8453.
Funding: deployer gas, protocol treasury wallet ready.
Known addresses: LayerZero V2 Endpoint on Base, Chainlink feeds (if used), protocol treasury, protocol owner/admin.
Deployment order
1) CreatorRegistry
Purpose: canonical map of creator coin → vault/wrapper/shareOFT/gauge/CCA/oracle; reverse lookups.
Constructor args: typically (admin/owner, protocolTreasury?) per your contract definition. If none, deploy straight.
2) CreatorOVaultFactory
Purpose: stores code hashes / deployment info for vaults (ccaStrategy pointer).
Constructor args: (registry address, protocolTreasury, protocolOwner).
Post-deploy: set or confirm code IDs if required by the factory (some flows store them in batcher instead).
3) Protocol components (deploy via batcher or factory)
If using CREATE2 salts, you’ll need code hashes from bytecode. Typical components:
CreatorOVault (ERC-4626 vault)
CreatorOVaultWrapper
CreatorShareOFT (LayerZero OFT)
CreatorGaugeController (if gauges)
CCALaunchStrategy (CCA)
CreatorOracle (if used on-chain)
OFTBootstrapRegistry (if used for OFT bootstrap)
If your flow deploys them ad hoc via the batcher, you can skip pre-deploying and let batcher do it; otherwise precompute CREATE2 addresses and deploy now.
4) CreatorVaultBatcher
Purpose: deploy-and-launch (with Permit2 paths, operator deploy).
Constructor args: (registry, factory, protocolTreasury, permit2 address, create2Deployer).
Post-deploy:
Set protocolTreasury if mutable.
Record in frontend config.
5) VaultActivationBatcher (if used for launch/activation steps)
Constructor args: (registry, factory, protocolTreasury, permit2 address).
Post-deploy: ensure registry/factory references are correct.
6) OFT / LayerZero setup
For OFT-based shares:
Ensure LayerZero Endpoint (Base) address is wired inside OFT/Bootstrap (if constructor requires).
For cross-chain, set peer(s) and shared decimals if applicable.
If OFT uses bootstrap registry, deploy and set its address in batcher/factory if needed.
7) VRF / Lottery (optional)
CreatorVRFConsumer / ChainlinkVRFIntegrator (if using VRF 2.5):
Constructor likely: (LayerZero endpoint, registry, hubEid, priceOracle?, treasury?).
Set keyHash, subscriptionId, coordinator, gasLane, callbackGasLimit per Chainlink Base settings.
CreatorLotteryManager (if used):
Wire VRF consumer/integrator addresses.
Set treasury, fee params, etc.
8) Permissions / roles
Transfer ownerships to protocol safe/owner.
Grant batcher/factory rights in registry if required.
Set protocol fees/treasury splits in CCA/Gauge if configurable.
9) Registry wiring
For each deployed creator vault (if any preseeded), call registry setters:
setCreatorCoinInfo / registerVault(wrapper/shareOFT/gauge/cca/oracle)
verify reverse lookups resolve correctly.
Post-deploy validation
Run read checks:
Registry: creatorCoinInfo(coin), reverse lookups for vault/wrapper/shareOFT.
Factory: codeId hashes present, ccaStrategy set.
Batcher: registry(), factory(), permit2(), create2Deployer() return expected.
Simulate a dry-run deploy via batcher on a test coin (small deposit) against Base RPC/fork to confirm Permit2 + deployment flow.
If OFT cross-chain: verify peers set and isPeer returns true; send a small message if applicable.
If VRF: request test randomness (if permitted) and verify callback wiring.
Artifacts to have ready
Compiled bytecode/ABI for:
CreatorRegistry
CreatorOVaultFactory
CreatorVaultBatcher
VaultActivationBatcher
CreatorOVault / Wrapper / ShareOFT / GaugeController / CCALaunchStrategy / CreatorOracle / OFTBootstrapRegistry
VRF Consumer/Integrator (if used)
CREATE2 salts (if deterministic addresses are required).
LayerZero endpoint (Base) address; Permit2 address; protocolTreasury address; protocolOwner address.
Any Chainlink feed addresses or VRF coordinator/keyHash/subId.
# 🚀 **CREATOR VAULT LAUNCH GUIDE**

## 📋 **QUICK START - DEPLOY YOUR VAULT**

This guide walks you through the **current** CreatorVault launch flow. The recommended path is the **AA batcher** (single signature) plus a registry registration step.

**Preferred deployment path:**
1. **Deploy + launch** via `/deploy` (AA) using `CreatorVaultBatcher`
2. **Activation-only** via `LaunchVaultAA` if a vault stack already exists
3. **Register deployment** (if not already registered) via `CreatorOVaultFactory.registerDeployment(...)`

---

## ✅ **Base Mainnet Infrastructure (Current)**

These addresses are pulled from `deployments/base/contracts/**` and `frontend/src/config/contracts.defaults.ts`:

- **CreatorRegistry:** `0x02c8031c39E10832A831b954Df7a2c1bf9Df052D`
- **CreatorOVaultFactory:** `0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD`
- **CreatorVaultBatcher:** `0xB695AEaD09868F287DAA38FA444B240847c50fB8`
- **VaultActivationBatcher:** `0x4b67e3a4284090e5191c27B8F24248eC82DF055D`
- **Permit2:** `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **LayerZero Endpoint (Base):** `0x1a44076050125825900e736c501f859c50fE728c`

---

## 🎯 **WHAT YOU'LL DEPLOY (Per Creator Coin)**

1. **CreatorOVault** – ERC-4626 vault
2. **CreatorOVaultWrapper** – wraps vault shares into OFT shares
3. **CreatorShareOFT** – LayerZero share token
4. **CCALaunchStrategy** – continuous clearing auction launch contract
5. **CreatorGaugeController** – fee routing + lottery integration
6. **CreatorOracle** – price oracle for share token

---

## 🔧 **STEP 1: Deploy + Launch (Recommended)**

Use the frontend `/deploy` page, which calls the AA batcher:

- `CreatorVaultBatcher.deployAndLaunch(...)`
- `CreatorVaultBatcher.deployAndLaunchWithPermit2(...)`
- Operator-safe variants when using a paymaster or relayer

**Config required in the frontend:**
```bash
VITE_CREATOR_VAULT_BATCHER=0xB695AEaD09868F287DAA38FA444B240847c50fB8
VITE_VAULT_ACTIVATION_BATCHER=0x4b67e3a4284090e5191c27B8F24248eC82DF055D
VITE_REGISTRY=0x02c8031c39E10832A831b954Df7a2c1bf9Df052D
VITE_FACTORY=0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD
```

**Result:** Vault stack deployed, wired, and auction launched in a single flow.

---

## 🔧 **STEP 2: Activation-Only (Optional)**

If the vault stack already exists, you can launch the CCA with `VaultActivationBatcher`:

```bash
cast send 0x4b67e3a4284090e5191c27B8F24248eC82DF055D \
  "batchActivate(address,address,address,address,uint256,uint8,uint128)" \
  $CREATOR_TOKEN \
  $VAULT_ADDRESS \
  $WRAPPER_ADDRESS \
  $CCA_ADDRESS \
  $DEPOSIT_AMOUNT \
  $AUCTION_PERCENT \
  $REQUIRED_RAISE \
  --rpc-url base --private-key $PRIVATE_KEY
```

Permit2-based variants are also available for operator flows:
- `batchActivateWithPermit2For(...)`
- `batchActivateWithPermit2FromOperator(...)`

---

## 🧾 **STEP 3: Register Deployment (Required for Canonical Indexing)**

If your deploy flow does **not** already register with the factory, call:

```bash
cast send 0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD \
  "registerDeployment(address,address,address,address,address,address,address,address)" \
  $CREATOR_TOKEN \
  $VAULT_ADDRESS \
  $WRAPPER_ADDRESS \
  $SHARE_OFT \
  $GAUGE_CONTROLLER \
  $CCA_STRATEGY \
  $ORACLE \
  $CREATOR_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY
```

This **registers the vault** and updates the **CreatorRegistry** pointers used across the app.

---

## 🛠️ **Manual Deployment (Advanced / Legacy)**

If you must deploy each contract manually, use the current constructor signatures:

```bash
# CreatorOVault
forge create contracts/vault/CreatorOVault.sol:CreatorOVault \
  --constructor-args $CREATOR_TOKEN $TEMP_OWNER "${TOKEN_SYMBOL} Vault" "v${TOKEN_SYMBOL}" \
  --rpc-url base --private-key $PRIVATE_KEY

# CreatorOVaultWrapper
forge create contracts/vault/CreatorOVaultWrapper.sol:CreatorOVaultWrapper \
  --constructor-args $CREATOR_TOKEN $VAULT_ADDRESS $TEMP_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY

# CreatorShareOFT (registry-based constructor)
forge create contracts/services/messaging/CreatorShareOFT.sol:CreatorShareOFT \
  --constructor-args "${TOKEN_SYMBOL} Shares" "■${TOKEN_SYMBOL}" \
  0x02c8031c39E10832A831b954Df7a2c1bf9Df052D $TEMP_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY

# CreatorGaugeController
forge create contracts/governance/CreatorGaugeController.sol:CreatorGaugeController \
  --constructor-args $SHARE_OFT $CREATOR_TREASURY $PROTOCOL_TREASURY $TEMP_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY

# CCALaunchStrategy
forge create contracts/vault/strategies/CCALaunchStrategy.sol:CCALaunchStrategy \
  --constructor-args $SHARE_OFT $RAISE_TOKEN $VAULT_ADDRESS $VAULT_ADDRESS $TEMP_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY

# CreatorOracle
forge create contracts/services/oracles/CreatorOracle.sol:CreatorOracle \
  --constructor-args 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D \
  0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70 "■${TOKEN_SYMBOL}" $TEMP_OWNER \
  --rpc-url base --private-key $PRIVATE_KEY
```

Then wire the contracts (owner-only):
- `wrapper.setShareOFT(shareOFT)`
- `shareOFT.setVault(vault)`
- `shareOFT.setMinter(wrapper, true)`
- `shareOFT.setGaugeController(gauge)`
- `gauge.setVault(vault)` + `setWrapper(wrapper)` + `setCreatorCoin(token)` + `setOracle(oracle)`
- `vault.setGaugeController(gauge)` + `vault.setWhitelist(wrapper, true)`
- `cca.setApprovedLauncher(VaultActivationBatcher, true)`
- `cca.setOracleConfig(oracle, poolManager, taxHook, gauge)`

Finally, transfer ownership to the creator or protocol treasury and call **registerDeployment** as shown above.

---

## ✅ **Checklist**

- [ ] Use `/deploy` (AA) for one-click deployment
- [ ] If manual, wire contracts and approve launchers
- [ ] Register deployment via `CreatorOVaultFactory`
- [ ] Verify contracts on Basescan
- [ ] Confirm `/status` shows the vault as active

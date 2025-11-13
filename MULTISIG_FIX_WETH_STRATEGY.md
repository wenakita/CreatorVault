# MULTISIG: Fix WETH Strategy & Deploy Funds

## Problem
The current WETH strategy fails because it tries to swap leftover WETH back to USD1, but there's no liquid WETH/USD1 pool.

## Solution
Deploy a new fixed WETH strategy that keeps leftover WETH for the next deposit instead of swapping.

---

## Step 1: Deploy New WETH Strategy

**Use Safe's Contract Interaction to deploy:**

### Deploy Transaction
- **Contract Address:** Use a deployment tool or Safe Apps "WalletConnect" to deploy
- **Constructor Args:**
  ```
  _vaultAddress: 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953
  _charmVault: 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF
  _wlfi: 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6
  _weth: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
  _usd1: 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d
  _uniswapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
  _owner: 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 (your multisig)
  ```

**Bytecode:** (Available in `/home/akitav2/eagle-ovault-clean/out/CharmStrategyWETH.sol/CharmStrategyWETH.json`)

---

## Step 2: Initialize New Strategy

**Once deployed, call:**

### Transaction 1: Initialize Approvals
- **To:** `<NEW_STRATEGY_ADDRESS>`
- **Function:** `initializeApprovals()`
- **Data:** `0x27f8eaac`

---

## Step 3: Swap Strategies in Vault

### Transaction 2: Remove Old WETH Strategy
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Function:** `removeStrategy(address)`
- **Param:** `0x47dCe4Bd8262fe0E76733825A1Cac205905889c6`
- **Data:** `0xa64c5a4a00000000000000000000000047dce4bd8262fe0e76733825a1cac205905889c6`

### Transaction 3: Add New WETH Strategy
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Function:** `addStrategy(address,uint256)`
- **Params:** 
  - `strategy`: `<NEW_STRATEGY_ADDRESS>`
  - `weight`: `5000`

---

## Step 4: Deploy Funds

### Transaction 4: Force Deploy to Strategies
- **To:** `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Function:** `forceDeployToStrategies()`
- **Data:** `0x68e5ce84`

---

## Alternative: Use Deployer Key (if funded)

If someone sends 0.0006 ETH to deployer (`0x7310Dd6EF89b7f829839F140C6840bc929ba2031`):

```bash
forge script script/RedeployWETHStrategy.s.sol:RedeployWETHStrategy --rpc-url https://eth.llamarpc.com --broadcast --legacy
```

Then execute multisig transactions 2-4 above.


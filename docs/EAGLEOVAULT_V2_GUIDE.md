# 🦅 EagleOVault V2 - Complete Guide

## 🎯 What's New in V2

EagleOVault V2 introduces **major upgrades** for better UX, gas efficiency, and capital efficiency:

### **1. ZAP Deposits** 🔄
Deposit with **ANY token** in one transaction:
- ✅ Deposit with ETH
- ✅ Deposit with USDC, DAI, etc.
- ✅ Automatic conversion to WLFI+USD1
- ✅ No need to pre-buy both tokens

### **2. Auto-Rebalancing** ⚖️
Automatically handles unbalanced deposits:
- ✅ User deposits 1000 WLFI, 0 USD1? Vault auto-swaps to 50/50
- ✅ Reduces capital inefficiency
- ✅ Works transparently in the background

### **3. Batch Deployments** ⛽
Gas-optimized strategy deployments:
- ✅ Only deploys to Charm when threshold met ($10k default)
- ✅ Saves ~55% gas on small deposits
- ✅ Funds still earn yield (just buffered in vault)

### **4. Helper Functions** 🛠️
Rich set of view functions:
- ✅ Check optimal deposit amounts
- ✅ Preview zap deposits
- ✅ Check if vault needs rebalancing
- ✅ Get detailed strategy breakdowns

---

## 📚 Function Reference

### **ZAP Deposit Functions**

#### `zapDepositETH(address receiver, uint256 minSharesOut)`
Deposit ETH and receive EAGLE shares.

**Example:**
```solidity
// User sends 1 ETH
vault.zapDepositETH{value: 1 ether}(
    msg.sender,           // receiver
    950e18                // min 950 EAGLE (5% slippage tolerance)
);

// Flow:
// 1 ETH → 0.5 ETH swapped to WLFI
//      → 0.5 ETH swapped to USD1
//      → Deposits both into vault
//      → Returns EAGLE shares
```

**Parameters:**
- `receiver`: Address to receive EAGLE shares
- `minSharesOut`: Minimum shares to receive (slippage protection)

**Returns:**
- `shares`: Amount of EAGLE shares minted

---

#### `zapDeposit(address tokenIn, uint256 amountIn, address receiver, uint256 minSharesOut)`
Deposit any ERC20 token and receive EAGLE shares.

**Example:**
```solidity
// Deposit 1000 USDC
USDC.approve(address(vault), 1000e6);

vault.zapDeposit(
    address(USDC),        // tokenIn
    1000e6,               // amountIn
    msg.sender,           // receiver
    950e18                // minSharesOut
);

// Flow:
// 1000 USDC → 500 USDC swapped to WLFI
//          → 500 USDC swapped to USD1
//          → Deposits both into vault
//          → Returns EAGLE shares
```

**Special Cases:**
```solidity
// If depositing WLFI already:
vault.zapDeposit(address(WLFI), 1000e18, msg.sender, 950e18);
// Just swaps 50% to USD1, more efficient

// If depositing USD1 already:
vault.zapDeposit(address(USD1), 1000e18, msg.sender, 950e18);
// Just swaps 50% to WLFI, more efficient
```

---

### **Enhanced Dual Deposit**

#### `depositDual(uint256 wlfiAmount, uint256 usd1Amount, address receiver)`
Deposit WLFI+USD1 with auto-rebalancing.

**Example:**
```solidity
// Unbalanced deposit (all WLFI)
WLFI.approve(address(vault), 1000e18);

vault.depositDual(
    1000e18,              // wlfiAmount
    0,                    // usd1Amount (unbalanced!)
    msg.sender            // receiver
);

// Vault automatically:
// 1. Accepts 1000 WLFI
// 2. Swaps 500 WLFI → ~495 USD1 (slippage)
// 3. Now has ~500 WLFI + 495 USD1
// 4. Mints shares based on 995 total value
// 5. Deploys to strategies when threshold met
```

**Balanced deposit (optimal):**
```solidity
WLFI.approve(address(vault), 500e18);
USD1.approve(address(vault), 500e18);

vault.depositDual(500e18, 500e18, msg.sender);
// No swap needed, saves gas + swap fees!
```

---

### **Helper Functions**

#### `getOptimalDepositAmounts(uint256 totalValue)`
Calculate optimal WLFI/USD1 split for a given value.

**Example:**
```solidity
// User wants to deposit $1000 worth
(uint256 wlfi, uint256 usd1) = vault.getOptimalDepositAmounts(1000e18);
// Returns: wlfi = 500e18, usd1 = 500e18 (50/50 split)

// Now user can deposit optimally:
WLFI.approve(address(vault), wlfi);
USD1.approve(address(vault), usd1);
vault.depositDual(wlfi, usd1, msg.sender);
```

---

#### `previewZapDeposit(address tokenIn, uint256 amountIn)`
Preview how many EAGLE shares you'll get from a zap deposit.

**Example:**
```solidity
// Check before depositing 1 ETH
uint256 estimatedShares = vault.previewZapDeposit(address(0), 1 ether);
// Returns: ~950e18 (estimated, actual may vary)

// Set appropriate slippage
uint256 minShares = (estimatedShares * 95) / 100; // 5% slippage

vault.zapDepositETH{value: 1 ether}(msg.sender, minShares);
```

---

#### `checkDepositBalance(uint256 wlfiAmount, uint256 usd1Amount)`
Check if a deposit is unbalanced.

**Example:**
```solidity
(bool isImbalanced, uint256 wlfiRatio) = vault.checkDepositBalance(
    1000e18,  // wlfiAmount
    100e18    // usd1Amount
);

// Returns: isImbalanced = true, wlfiRatio = 9091 (90.91% WLFI)
// UI should warn: "Unbalanced deposit will incur swap fees"
```

---

#### `getCurrentRatio()`
Get current vault WLFI/USD1 ratio.

**Example:**
```solidity
uint256 ratio = vault.getCurrentRatio();
// Returns: 5243 = 52.43% WLFI, 47.57% USD1
// Compare with targetRatio (5000 = 50/50)
```

---

#### `needsRebalance()`
Check if vault needs rebalancing.

**Example:**
```solidity
bool needs = vault.needsRebalance();
// Returns: true if deviation > 10% (rebalanceThreshold)

if (needs) {
    vault.rebalance(); // Manager can trigger rebalance
}
```

---

#### `shouldDeployToStrategies()`
Check if batch deployment threshold is met.

**Example:**
```solidity
bool should = vault.shouldDeployToStrategies();
// Returns: true if:
// - Idle funds >= $10k (deploymentThreshold)
// - Time since last deployment >= 1 hour

if (should) {
    vault.forceDeployToStrategies(); // Manager can force
}
```

---

#### `getIdleFunds()`
Get funds sitting in vault (not in strategies).

**Example:**
```solidity
uint256 idle = vault.getIdleFunds();
// Returns: 5000e18 ($5k sitting idle, not yet deployed)
```

---

#### `getStrategyValue()`
Get total value deployed to strategies.

**Example:**
```solidity
uint256 strategyValue = vault.getStrategyValue();
// Returns: 15000e18 ($15k deployed to Charm)

uint256 idle = vault.getIdleFunds();
// Returns: 5000e18 ($5k idle)

uint256 total = strategyValue + idle;
// Total vault value: $20k
```

---

#### `getVaultBalances()`
Get direct vault holdings.

**Example:**
```solidity
(uint256 wlfi, uint256 usd1) = vault.getVaultBalances();
// Returns: wlfi = 2500e18, usd1 = 2500e18
// This is ONLY what's in the vault, not strategies
```

---

#### `getStrategies()`
Get all strategies and their weights.

**Example:**
```solidity
(address[] memory strategies, uint256[] memory weights) = vault.getStrategies();
// Returns:
// strategies[0] = 0xCharmStrategy...
// weights[0] = 7000 (70%)
```

---

#### `getStrategyAssets()`
Get detailed breakdown of strategy holdings.

**Example:**
```solidity
(
    address[] memory strategies,
    uint256[] memory wlfiAmounts,
    uint256[] memory usd1Amounts
) = vault.getStrategyAssets();

// Returns:
// strategies[0] = 0xCharmStrategy...
// wlfiAmounts[0] = 7000e18 (7000 WLFI in Charm)
// usd1Amounts[0] = 7000e18 (7000 USD1 in Charm)
```

---

### **Management Functions**

#### `forceDeployToStrategies()`
Manually trigger deployment to strategies (bypass threshold).

**Example:**
```solidity
// Manager wants to deploy immediately
vault.forceDeployToStrategies();

// Deploys all idle funds to strategies
// Useful if you want immediate yield, don't wait for threshold
```

---

#### `setDeploymentParams(uint256 threshold, uint256 interval)`
Configure batch deployment settings.

**Example:**
```solidity
// Change to $5k threshold, 30 min interval
vault.setDeploymentParams(
    5000e18,        // threshold
    30 minutes      // interval
);

// Now deploys more frequently with lower amounts
```

---

#### `setTargetRatio(uint256 ratio)`
Change target WLFI/USD1 ratio.

**Example:**
```solidity
// Change to 60% WLFI, 40% USD1
vault.setTargetRatio(6000);

// Next rebalance will target this ratio
```

---

#### `setPoolFee(uint24 fee)`
Change Uniswap pool fee tier for WLFI/USD1 swaps.

**Example:**
```solidity
// Switch to 0.3% fee tier (more liquidity)
vault.setPoolFee(3000);

// Options: 500 (0.05%), 3000 (0.3%), 10000 (1%)
```

---

## 💡 Usage Patterns

### **Pattern 1: Simple ETH Deposit**
```solidity
// User has ETH, wants EAGLE
vault.zapDepositETH{value: 1 ether}(msg.sender, 900e18);

// Done! User got EAGLE shares in one transaction
```

### **Pattern 2: Optimal Balanced Deposit**
```solidity
// Get optimal amounts
(uint256 optimalWlfi, uint256 optimalUsd1) = vault.getOptimalDepositAmounts(1000e18);

// Buy tokens
// ... user swaps to get optimalWlfi and optimalUsd1 ...

// Deposit
WLFI.approve(address(vault), optimalWlfi);
USD1.approve(address(vault), optimalUsd1);
vault.depositDual(optimalWlfi, optimalUsd1, msg.sender);

// No swap fees paid!
```

### **Pattern 3: Zap from Any Token**
```solidity
// User has USDC
USDC.approve(address(vault), 1000e6);

// Preview first
uint256 expectedShares = vault.previewZapDeposit(address(USDC), 1000e6);
uint256 minShares = (expectedShares * 95) / 100; // 5% slippage

// Execute
vault.zapDeposit(address(USDC), 1000e6, msg.sender, minShares);
```

### **Pattern 4: Check Before Deposit (UI)**
```solidity
// In your frontend
const [isImbalanced, ratio] = await vault.checkDepositBalance(wlfiAmount, usd1Amount);

if (isImbalanced) {
    showWarning("⚠️ Unbalanced deposit will incur ~0.3% swap fee");
    
    // Show optimal amounts
    const [optimalWlfi, optimalUsd1] = await vault.getOptimalDepositAmounts(totalValue);
    showSuggestion(`Recommended: ${optimalWlfi} WLFI, ${optimalUsd1} USD1`);
}
```

---

## 📊 Gas Comparison

| Deposit Method | Gas Cost | Swap Fees | Total Cost |
|----------------|----------|-----------|------------|
| **Traditional** (direct to Charm) | ~400k gas | 0% | ~$25 @ 60 gwei |
| **V1** (balanced dual deposit) | ~180k gas | 0% | ~$11 @ 60 gwei |
| **V2** (batched, under threshold) | ~120k gas | 0% | ~$7.50 @ 60 gwei |
| **V2** (zap from ETH) | ~250k gas | 0.6% | ~$15.60 @ 60 gwei |
| **V2** (zap from USDC) | ~280k gas | 0.6% | ~$17.50 @ 60 gwei |

**Best for gas**: Balanced dual deposit under threshold  
**Best for UX**: Zap deposit (any token)

---

## 🔒 Security Considerations

### **Slippage Protection**
All swaps include `maxSlippage` parameter (default 5%):
```solidity
uint256 minAmountOut = (amountIn * (10000 - maxSlippage)) / 10000;
```

### **MEV Protection**
- All zap functions check `minSharesOut`
- Recommend users set 5-10% slippage for volatile markets
- Consider using private RPC endpoints for large zaps

### **Unbalanced Deposit Warning**
Vault emits `UnbalancedDeposit` event if ratio is extreme:
```solidity
if (wlfiRatio > 8000 || wlfiRatio < 2000) {
    emit UnbalancedDeposit(msg.sender, wlfiRatio);
}
```

Listen for this in your UI to warn users.

---

## 🚀 Deployment

### **Required Contracts**
```solidity
// Mainnet addresses (example)
address wlfi = 0x...; // WLFI token
address usd1 = 0x...; // USD1 token
address swapRouter = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // Uniswap V3 Router
address weth9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH9
address owner = msg.sender;

// Deploy vault
EagleOVaultV2 vault = new EagleOVaultV2(
    wlfi,
    usd1,
    swapRouter,
    weth9,
    owner
);
```

### **Configuration**
```solidity
// Set deployment params (optional, has defaults)
vault.setDeploymentParams(10_000e18, 1 hours);

// Set target ratio (optional, default 50/50)
vault.setTargetRatio(5000);

// Add Charm strategy
vault.addStrategy(charmStrategyAddress, 7000); // 70% allocation
```

---

## ⚙️ Configuration Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `targetRatio` | 5000 (50%) | Target WLFI percentage |
| `maxSlippage` | 500 (5%) | Maximum slippage for swaps |
| `rebalanceThreshold` | 1000 (10%) | Trigger rebalance if deviation > 10% |
| `deploymentThreshold` | 10,000e18 | Deploy to strategies at $10k |
| `minDeploymentInterval` | 1 hour | Min time between deployments |
| `poolFeeWlfiUsd1` | 10000 (1%) | Uniswap pool fee tier |
| `maxStrategies` | 5 | Max number of strategies |
| `protocolFee` | 200 (2%) | Protocol fee on profits |
| `managerFee` | 100 (1%) | Manager fee on profits |

---

## 🎓 Advanced Topics

### **Multi-Hop Swaps**
For tokens without direct WLFI/USD1 pairs, implement multi-hop:
```solidity
// e.g., TokenX → WETH → WLFI
// Requires updating _swapExactInput to support paths
```

### **Oracle Integration**
For better price discovery on swaps:
```solidity
// Add Chainlink oracle for WLFI/USD1 price
// Compare against Uniswap TWAP
// Reject swaps if price deviation > threshold
```

### **Dynamic Ratio Adjustment**
Automatically adjust `targetRatio` based on market conditions:
```solidity
// If WLFI performing better → increase WLFI allocation
// If USD1 performing better → increase USD1 allocation
```

---

## 📞 Support

For questions or issues:
- GitHub Issues: [your-repo/issues]
- Discord: [your-discord]
- Docs: [your-docs-site]

---

**Built with 🔥 by the Eagle team**


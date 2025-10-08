# 🎯 How EagleOVault Deposits into Charm - Complete Flow

## 🏗️ The Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: User                                           │
│  • Deposits ANY token (ETH, USDC, etc.)                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: EagleOVault (Your vault)                      │
│  • Address: 0x4f00fAB0361009d975Eb04E172268Bf1E73737bC  │
│  • Receives deposits, converts to WLFI+USD1             │
│  • Mints EAGLE shares to user                           │
│  • Holds tokens until threshold met ($100 for testing) │
└────────────────┬────────────────────────────────────────┘
                 │ When threshold met
                 ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: CharmAlphaVaultStrategy (Adapter)             │
│  • Contract that connects vault to Charm                │
│  • Only callable by EagleOVault                         │
│  • Receives WLFI+USD1 from vault                        │
│  • Deposits into Charm Alpha Vault                      │
│  • Holds MEAGLE shares                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: Charm Alpha Vault (MEAGLE)                    │
│  • Address: 0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e │
│  • Receives WLFI+USD1                                   │
│  • Creates Uniswap V3 LP position                       │
│  • Mints MEAGLE shares to strategy                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 5: Uniswap V3 Pool (WLFI/USD1)                  │
│  • Provides liquidity                                    │
│  • Earns trading fees                                    │
│  • Fees increase LP value                                │
└──────────────────────────────────────────────────────────┘
```

---

## 📝 **Step-by-Step Flow**

### **Step 1: User Deposits to EagleOVault**

```solidity
// User deposits 100 WLFI + 100 USD1
vault.depositDual(100, 100, userAddress);
```

**What happens:**
```solidity
// In EagleOVault
function depositDual(wlfi, usd1, receiver) {
    // Transfer tokens from user
    WLFI.transferFrom(user, vault, 100);
    USD1.transferFrom(user, vault, 100);
    
    // Update internal tracking
    wlfiBalance += 100;  // Now vault has 100 WLFI
    usd1Balance += 100;  // Now vault has 100 USD1
    
    // Mint EAGLE shares to user
    _mint(receiver, shares);
    
    // Check if should deploy to strategies
    if (_shouldDeployToStrategies()) {
        _deployToStrategies(wlfiBalance, usd1Balance);
    }
}
```

### **Step 2: Check Deployment Threshold**

```solidity
function _shouldDeployToStrategies() internal view returns (bool) {
    // Don't deploy if no strategies
    if (totalStrategyWeight == 0) return false;
    
    // Check if enough idle funds accumulated
    uint256 idleFunds = wlfiBalance + usd1Balance;
    if (idleFunds < deploymentThreshold) return false;  // Need $100+ for testing
    
    // Check if enough time passed since last deployment
    if (block.timestamp < lastDeployment + minDeploymentInterval) return false;  // Need 5+ minutes
    
    return true;
}
```

**Current thresholds** (testing mode):
- `deploymentThreshold`: 100 tokens ($100)
- `minDeploymentInterval`: 5 minutes

**When threshold MET**: Deploys to strategies  
**When threshold NOT MET**: Keeps tokens in vault (still safe, just not earning Charm yield yet)

### **Step 3: Deploy to Strategies**

```solidity
function _deployToStrategies(uint256 wlfiAmount, uint256 usd1Amount) internal {
    // For each active strategy
    for (uint256 i = 0; i < strategyList.length; i++) {
        address strategy = strategyList[i];
        
        if (activeStrategies[strategy] && strategyWeights[strategy] > 0) {
            // Calculate this strategy's allocation
            uint256 strategyValue = (totalValue * strategyWeights[strategy]) / totalStrategyWeight;
            
            // If Charm strategy has 70% weight:
            uint256 strategyWlfi = 70 WLFI;  // 70% of 100
            uint256 strategyUsd1 = 70 USD1;  // 70% of 100
            
            // Update vault balances
            wlfiBalance -= 70;  // Vault now has 30 WLFI
            usd1Balance -= 70;  // Vault now has 30 USD1
            
            // Approve strategy to spend tokens
            WLFI_TOKEN.safeIncreaseAllowance(strategy, 70);
            USD1_TOKEN.safeIncreaseAllowance(strategy, 70);
            
            // Call strategy's deposit function
            IStrategy(strategy).deposit(strategyWlfi, strategyUsd1);
        }
    }
}
```

**Result:**
- Vault keeps: 30 WLFI + 30 USD1 (for withdrawals)
- Strategy gets: 70 WLFI + 70 USD1 (to deploy to Charm)

### **Step 4: Strategy Deposits to Charm**

```solidity
// In CharmAlphaVaultStrategy.deposit()
function deposit(uint256 wlfiAmount, uint256 usd1Amount) external onlyVault {
    // Transfer tokens from EagleOVault to Strategy
    WLFI_TOKEN.safeTransferFrom(EAGLE_VAULT, address(this), 70);
    USD1_TOKEN.safeTransferFrom(EAGLE_VAULT, address(this), 70);
    
    // Approve Charm Alpha Vault (MEAGLE contract)
    WLFI_TOKEN.safeIncreaseAllowance(address(alphaVault), 70);
    USD1_TOKEN.safeIncreaseAllowance(address(alphaVault), 70);
    
    // Calculate minimum amounts (slippage protection)
    uint256 amount0Min = 70 * 0.95;  // 5% slippage tolerance
    uint256 amount1Min = 70 * 0.95;
    
    // Deposit into Charm Alpha Vault (MEAGLE)
    (uint256 meagleShares, , ) = alphaVault.deposit(
        70,           // wlfiAmount
        70,           // usd1Amount
        amount0Min,   // min WLFI
        amount1Min,   // min USD1
        address(this) // Strategy receives MEAGLE
    );
    
    // Strategy now holds MEAGLE shares!
    // meagleShares ≈ 140 (depends on Charm's price)
}
```

### **Step 5: Charm Creates LP Position**

```
Charm Alpha Vault (MEAGLE contract) receives:
  • 70 WLFI
  • 70 USD1

What Charm does:
  1. Creates/adds to Uniswap V3 LP position
  2. Concentrates liquidity at optimal price ranges
  3. Mints MEAGLE shares to strategy
  4. Auto-rebalances position as prices move
  5. Collects trading fees
```

---

## 💰 **Token Ownership After Full Flow**

```
USER holds:
  └─ 200 EAGLE shares
     (represents 100% of vault)

EAGLEOVAULT holds:
  ├─ 30 WLFI (direct)
  ├─ 30 USD1 (direct)
  └─ CharmAlphaVaultStrategy (owns the strategy)

CHARMALPHAVALULTSTRATEGY holds:
  └─ ~140 MEAGLE shares
     (represents Charm position)

CHARM ALPHA VAULT (MEAGLE contract) holds:
  └─ Uniswap V3 LP position
     (70 WLFI + 70 USD1 providing liquidity)

UNISWAP V3 POOL contains:
  └─ Actual liquidity earning fees
```

---

## 📊 **Tracking Value Through the Layers**

### **User's Perspective:**

```javascript
// User checks their EAGLE balance
const eagleBalance = await vault.balanceOf(userAddress);
// Returns: 200 EAGLE

// Check total value
const totalAssets = await vault.totalAssets();
// Returns: 200 value (30+30 direct + 70+70 in strategy)

// User's value
const userValue = (eagleBalance * totalAssets) / totalSupply;
// Returns: 200 value (they own 100%)
```

### **Vault's Perspective:**

```solidity
function totalAssets() public view returns (uint256) {
    uint256 total = wlfiBalance + usd1Balance;  // 30 + 30 = 60
    
    // Add strategy assets
    for (uint256 i = 0; i < strategyList.length; i++) {
        if (activeStrategies[strategyList[i]]) {
            (uint256 wlfi, uint256 usd1) = IStrategy(strategyList[i]).getTotalAmounts();
            total += wlfi + usd1;  // 70 + 70 = 140
        }
    }
    
    return total;  // 60 + 140 = 200 ✅
}
```

### **Strategy's Perspective:**

```solidity
function getTotalAmounts() external view returns (uint256 wlfi, uint256 usd1) {
    // Get our MEAGLE share balance
    uint256 ourMeagleShares = alphaVault.balanceOf(address(this));
    // Returns: 140 MEAGLE
    
    // Get Charm vault's total holdings
    (uint256 total0, uint256 total1) = alphaVault.getTotalAmounts();
    // Returns total WLFI+USD1 in Charm vault (all depositors)
    
    uint256 totalMeagleShares = alphaVault.totalSupply();
    
    // Calculate our proportional share
    wlfiAmount = (total0 * ourMeagleShares) / totalMeagleShares;
    usd1Amount = (total1 * ourMeagleShares) / totalMeagleShares;
    // Returns: ~70 WLFI, ~70 USD1 (our portion)
}
```

---

## 🔄 **Complete Cycle Example**

### **Day 1: Initial Deposit**

```
1. User deposits 100 WLFI + 100 USD1
   ↓
2. Vault receives, mints 200 EAGLE to user
   ↓
3. Threshold MET! (100+100 = 200 > $100 threshold)
   ↓
4. Vault calls strategy.deposit(70, 70)
   ↓
5. Strategy deposits to Charm, gets 140 MEAGLE
   ↓
6. Charm creates Uniswap V3 LP position

Final state:
  • User: 200 EAGLE
  • Vault: 30 WLFI + 30 USD1 (idle)
  • Strategy: 140 MEAGLE
  • Charm: 70 WLFI + 70 USD1 (in Uniswap)
```

### **Day 2-30: Earning Fees**

```
Uniswap traders swap WLFI ↔ USD1
   ↓
Trading fees accumulate (e.g., 1% per swap)
   ↓
Charm LP position earns fees
   ↓
MEAGLE value increases

Example: Earn 7 WLFI + 7 USD1 in fees
   ↓
Strategy's position now worth: 77 WLFI + 77 USD1
   ↓
Vault's totalAssets: 30+30 (direct) + 77+77 (strategy) = 214
   ↓
User's EAGLE value: 200 shares × (214/200) = 214 value
   ↓
User profit: +14 value (+7% return!)
```

### **Day 31: User Withdraws**

```
User withdraws 100 EAGLE shares
   ↓
Vault calculates: (100 shares / 200 total) = 50% of assets
50% of 214 = 107 value needed
   ↓
Vault tries direct balance first:
  • Can provide: 30 WLFI + 30 USD1 = 60 value
  • Still need: 107 - 60 = 47 value
   ↓
Vault withdraws from strategy:
  • Calls strategy.withdraw(47 value worth of MEAGLE)
   ↓
Strategy withdraws from Charm:
  • Burns ~47 MEAGLE shares
  • Charm removes liquidity from Uniswap
  • Returns ~23.5 WLFI + 23.5 USD1 to strategy
   ↓
Strategy sends to vault, vault sends to user
   ↓
User receives: ~53.5 WLFI + 53.5 USD1 (worth 107 value)
```

---

## 🔧 **The Code Flow**

### **In EagleOVaultV2Hybrid.sol**

```solidity
// User deposits → triggers this when threshold met
function _deployToStrategies(uint256 wlfiAmount, uint256 usd1Amount) internal {
    for (uint256 i = 0; i < strategyList.length; i++) {
        address strategy = strategyList[i];
        
        if (activeStrategies[strategy]) {
            // Calculate allocation (e.g., 70%)
            uint256 strategyWlfi = (wlfiAmount * strategyWeights[strategy]) / 10000;
            uint256 strategyUsd1 = (usd1Amount * strategyWeights[strategy]) / 10000;
            
            // Approve strategy
            WLFI_TOKEN.safeIncreaseAllowance(strategy, strategyWlfi);
            USD1_TOKEN.safeIncreaseAllowance(strategy, strategyUsd1);
            
            // IMPORTANT: Call strategy's deposit function
            IStrategy(strategy).deposit(strategyWlfi, strategyUsd1);
            //                   ↑
            //                   This calls CharmAlphaVaultStrategy
        }
    }
}
```

### **In CharmAlphaVaultStrategy.sol**

```solidity
function deposit(uint256 wlfiAmount, uint256 usd1Amount) 
    external 
    onlyVault  // ← Only EagleOVault can call this!
    returns (uint256 shares) 
{
    // 1. Transfer tokens from EagleOVault to this strategy
    WLFI_TOKEN.safeTransferFrom(EAGLE_VAULT, address(this), wlfiAmount);
    USD1_TOKEN.safeTransferFrom(EAGLE_VAULT, address(this), usd1Amount);
    
    // 2. Approve Charm Alpha Vault
    WLFI_TOKEN.safeIncreaseAllowance(address(alphaVault), wlfiAmount);
    USD1_TOKEN.safeIncreaseAllowance(address(alphaVault), usd1Amount);
    
    // 3. Deposit into Charm (MEAGLE contract)
    (shares, , ) = alphaVault.deposit(
        wlfiAmount,
        usd1Amount,
        amount0Min,
        amount1Min,
        address(this)  // Strategy receives the MEAGLE shares
    );
    
    // Now strategy holds MEAGLE shares!
    // These represent ownership in Charm's LP position
}
```

### **In Charm Alpha Vault (MEAGLE)**

```solidity
// This is Charm's code (you don't control this)
function deposit(amount0, amount1, ...) external returns (uint256 shares) {
    // Transfer WLFI and USD1 from strategy
    token0.transferFrom(msg.sender, address(this), amount0);
    token1.transferFrom(msg.sender, address(this), amount1);
    
    // Create/add to Uniswap V3 LP position
    _addLiquidity(amount0, amount1);
    
    // Mint MEAGLE shares
    shares = calculateShares(amount0, amount1);
    _mint(msg.sender, shares);  // Strategy gets MEAGLE
    
    return shares;
}
```

---

## 🎯 **Why This Architecture?**

### **Benefits:**

1. **User Simplicity**
   - User only deals with EAGLE
   - Never needs to understand MEAGLE or Charm
   - One-click deposits

2. **Capital Efficiency**
   - Vault automatically deploys to best yield
   - No manual rebalancing needed
   - Batch deployments save gas

3. **Security**
   - Strategy can only be called by vault
   - Users can't accidentally interact with Charm directly
   - Vault maintains full control

4. **Omnichain**
   - EAGLE works on all chains (LayerZero)
   - MEAGLE stays on Arbitrum
   - Users don't care about the complexity

---

## 📊 **Token Flow Diagram**

```
WLFI/USD1 Flow:
User → EagleOVault → CharmStrategy → Charm (MEAGLE) → Uniswap V3

Receipt Token Flow:
User ← EAGLE ← EagleOVault
       └─ Internally tracks →  CharmStrategy holds MEAGLE
```

---

## 🧪 **To See This in Action**

I can create a script that:
1. Deploys the Charm strategy
2. Points it to your MEAGLE vault
3. Adds strategy to EagleOVault
4. Deposits enough to trigger deployment
5. Shows MEAGLE balance in strategy

Would you like me to create and run that?


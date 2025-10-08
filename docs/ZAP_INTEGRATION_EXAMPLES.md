# 🔄 Zap Integration Examples

## What is "Zapping"?

**Zapping** = One-click deposits from any token into complex DeFi positions.

Instead of:
```
❌ User buys WLFI
❌ User buys USD1  
❌ User approves both
❌ User deposits both
= 4 transactions, complex UX
```

With Zap:
```
✅ User deposits ETH/USDC/any token
= 1 transaction, simple UX
```

---

## 🎯 Real-World Examples

### **Example 1: Zap from ETH (Most Common)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./EagleOVaultV2.sol";

contract SimpleZapExample {
    EagleOVaultV2 public vault;
    
    constructor(address _vault) {
        vault = EagleOVaultV2(_vault);
    }
    
    /**
     * @notice Deposit ETH and get EAGLE shares
     */
    function zapFromETH() external payable {
        require(msg.value > 0, "Need ETH");
        
        // Calculate minimum shares (5% slippage tolerance)
        uint256 expectedShares = vault.previewZapDeposit(address(0), msg.value);
        uint256 minShares = (expectedShares * 95) / 100;
        
        // Execute zap
        uint256 shares = vault.zapDepositETH{value: msg.value}(
            msg.sender,     // receiver
            minShares       // slippage protection
        );
        
        // User now has EAGLE shares!
    }
}
```

**Flow:**
```
User: 1 ETH
  ↓
Vault wraps: 1 WETH
  ↓
Swap 1: 0.5 WETH → ~245 WLFI
Swap 2: 0.5 WETH → ~245 USD1
  ↓
Vault: 245 WLFI + 245 USD1
  ↓
Mint: ~490 EAGLE shares
  ↓
User receives: 490 EAGLE
```

---

### **Example 2: Zap from Stablecoin (USDC)**

```solidity
contract StablecoinZapExample {
    EagleOVaultV2 public vault;
    IERC20 public USDC;
    
    constructor(address _vault, address _usdc) {
        vault = EagleOVaultV2(_vault);
        USDC = IERC20(_usdc);
    }
    
    /**
     * @notice Deposit USDC and get EAGLE shares
     */
    function zapFromUSDC(uint256 amount) external {
        // Transfer USDC from user
        USDC.transferFrom(msg.sender, address(this), amount);
        
        // Approve vault
        USDC.approve(address(vault), amount);
        
        // Preview and calculate slippage
        uint256 expectedShares = vault.previewZapDeposit(address(USDC), amount);
        uint256 minShares = (expectedShares * 95) / 100;
        
        // Execute zap
        uint256 shares = vault.zapDeposit(
            address(USDC),  // tokenIn
            amount,         // amountIn
            msg.sender,     // receiver
            minShares       // min shares out
        );
    }
}
```

**Flow:**
```
User: 1000 USDC
  ↓
Swap 1: 500 USDC → ~245 WLFI (via Uniswap)
Swap 2: 500 USDC → ~500 USD1 (if USD1 is stablecoin)
  ↓
Vault: 245 WLFI + 500 USD1
  ↓
Auto-rebalance: Swap some USD1 → WLFI to get 50/50
  ↓
Final: 372 WLFI + 372 USD1
  ↓
Mint: ~744 EAGLE shares
```

---

### **Example 3: Frontend Integration (TypeScript)**

```typescript
import { ethers } from 'ethers';

class EagleVaultZap {
    private vault: ethers.Contract;
    private signer: ethers.Signer;
    
    constructor(vaultAddress: string, signer: ethers.Signer) {
        this.vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
        this.signer = signer;
    }
    
    /**
     * Zap from ETH
     */
    async zapFromETH(ethAmount: string, maxSlippage: number = 5) {
        const amountWei = ethers.utils.parseEther(ethAmount);
        
        // Preview expected shares
        const expectedShares = await this.vault.previewZapDeposit(
            ethers.constants.AddressZero,
            amountWei
        );
        
        // Calculate minimum shares (slippage protection)
        const minShares = expectedShares.mul(100 - maxSlippage).div(100);
        
        // Get user address
        const userAddress = await this.signer.getAddress();
        
        // Execute zap
        const tx = await this.vault.zapDepositETH(
            userAddress,
            minShares,
            { value: amountWei }
        );
        
        const receipt = await tx.wait();
        
        // Parse ZapDeposit event
        const zapEvent = receipt.events?.find(
            (e: any) => e.event === 'ZapDeposit'
        );
        
        return {
            shares: zapEvent?.args?.shares,
            txHash: receipt.transactionHash
        };
    }
    
    /**
     * Zap from any ERC20 token
     */
    async zapFromToken(
        tokenAddress: string,
        amount: string,
        maxSlippage: number = 5
    ) {
        const token = new ethers.Contract(
            tokenAddress,
            ['function approve(address,uint256) returns(bool)'],
            this.signer
        );
        
        // Approve vault
        const approveTx = await token.approve(this.vault.address, amount);
        await approveTx.wait();
        
        // Preview expected shares
        const expectedShares = await this.vault.previewZapDeposit(
            tokenAddress,
            amount
        );
        
        // Calculate minimum shares
        const minShares = expectedShares.mul(100 - maxSlippage).div(100);
        
        // Get user address
        const userAddress = await this.signer.getAddress();
        
        // Execute zap
        const tx = await this.vault.zapDeposit(
            tokenAddress,
            amount,
            userAddress,
            minShares
        );
        
        const receipt = await tx.wait();
        
        // Parse event
        const zapEvent = receipt.events?.find(
            (e: any) => e.event === 'ZapDeposit'
        );
        
        return {
            shares: zapEvent?.args?.shares,
            txHash: receipt.transactionHash
        };
    }
    
    /**
     * Get optimal deposit amounts for direct deposit
     */
    async getOptimalAmounts(totalValue: string) {
        const [wlfi, usd1] = await this.vault.getOptimalDepositAmounts(
            ethers.utils.parseEther(totalValue)
        );
        
        return {
            wlfi: ethers.utils.formatEther(wlfi),
            usd1: ethers.utils.formatEther(usd1)
        };
    }
    
    /**
     * Check if deposit is balanced
     */
    async checkBalance(wlfiAmount: string, usd1Amount: string) {
        const [isImbalanced, ratio] = await this.vault.checkDepositBalance(
            ethers.utils.parseEther(wlfiAmount),
            ethers.utils.parseEther(usd1Amount)
        );
        
        return {
            isImbalanced,
            wlfiPercentage: ratio / 100, // Convert from basis points to percentage
            warningMessage: isImbalanced 
                ? '⚠️ Unbalanced deposit will incur swap fees (~0.3%)'
                : '✅ Deposit is well balanced'
        };
    }
}

// Usage in React component
const zapToEagle = async () => {
    const zap = new EagleVaultZap(VAULT_ADDRESS, signer);
    
    try {
        setLoading(true);
        
        const result = await zap.zapFromETH('1.0', 5); // 1 ETH, 5% slippage
        
        toast.success(`Success! Got ${result.shares} EAGLE shares`);
        toast.info(`TX: ${result.txHash}`);
    } catch (error) {
        toast.error(`Zap failed: ${error.message}`);
    } finally {
        setLoading(false);
    }
};
```

---

### **Example 4: React Component with Balance Check**

```tsx
import React, { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';

export const ZapInterface: React.FC = () => {
    const { address } = useAccount();
    const [zapAmount, setZapAmount] = useState('');
    const [tokenType, setTokenType] = useState<'ETH' | 'USDC'>('ETH');
    const [expectedShares, setExpectedShares] = useState('0');
    const [isImbalanced, setIsImbalanced] = useState(false);
    
    // Preview zap
    useEffect(() => {
        const preview = async () => {
            if (!zapAmount || parseFloat(zapAmount) === 0) return;
            
            const vault = getVaultContract();
            const tokenAddress = tokenType === 'ETH' 
                ? ethers.constants.AddressZero 
                : USDC_ADDRESS;
            
            const amount = ethers.utils.parseEther(zapAmount);
            const shares = await vault.previewZapDeposit(tokenAddress, amount);
            
            setExpectedShares(ethers.utils.formatEther(shares));
        };
        
        preview();
    }, [zapAmount, tokenType]);
    
    const handleZap = async () => {
        const zap = new EagleVaultZap(VAULT_ADDRESS, signer);
        
        if (tokenType === 'ETH') {
            await zap.zapFromETH(zapAmount, 5);
        } else {
            await zap.zapFromToken(
                USDC_ADDRESS,
                ethers.utils.parseUnits(zapAmount, 6),
                5
            );
        }
    };
    
    return (
        <div className="zap-interface">
            <h2>🔄 Zap into Eagle Vault</h2>
            
            {/* Token Selector */}
            <div className="token-selector">
                <button 
                    onClick={() => setTokenType('ETH')}
                    className={tokenType === 'ETH' ? 'active' : ''}
                >
                    ETH
                </button>
                <button 
                    onClick={() => setTokenType('USDC')}
                    className={tokenType === 'USDC' ? 'active' : ''}
                >
                    USDC
                </button>
            </div>
            
            {/* Amount Input */}
            <input
                type="number"
                value={zapAmount}
                onChange={(e) => setZapAmount(e.target.value)}
                placeholder={`Enter ${tokenType} amount`}
                className="amount-input"
            />
            
            {/* Preview */}
            {expectedShares !== '0' && (
                <div className="preview">
                    <p>You will receive approximately:</p>
                    <h3>{parseFloat(expectedShares).toFixed(2)} EAGLE</h3>
                    <small>* Actual amount may vary due to slippage</small>
                </div>
            )}
            
            {/* Zap Button */}
            <button 
                onClick={handleZap}
                disabled={!zapAmount || parseFloat(zapAmount) === 0}
                className="zap-button"
            >
                Zap to Eagle 🚀
            </button>
            
            {/* Info */}
            <div className="info-box">
                <h4>How it works:</h4>
                <ol>
                    <li>Your {tokenType} is automatically split 50/50</li>
                    <li>Half swapped to WLFI, half to USD1</li>
                    <li>Both deposited into Eagle Vault</li>
                    <li>You receive EAGLE shares</li>
                </ol>
            </div>
        </div>
    );
};
```

---

### **Example 5: Advanced - Check Optimal Deposit**

```tsx
export const OptimalDepositChecker: React.FC = () => {
    const [totalValue, setTotalValue] = useState('1000');
    const [optimal, setOptimal] = useState<{wlfi: string, usd1: string}>();
    const [userWlfi, setUserWlfi] = useState('');
    const [userUsd1, setUserUsd1] = useState('');
    const [balance, setBalance] = useState<{
        isImbalanced: boolean,
        wlfiPercentage: number,
        warning: string
    }>();
    
    // Get optimal amounts
    useEffect(() => {
        const fetchOptimal = async () => {
            const vault = getVaultContract();
            const [wlfi, usd1] = await vault.getOptimalDepositAmounts(
                ethers.utils.parseEther(totalValue)
            );
            
            setOptimal({
                wlfi: ethers.utils.formatEther(wlfi),
                usd1: ethers.utils.formatEther(usd1)
            });
        };
        
        fetchOptimal();
    }, [totalValue]);
    
    // Check user's deposit balance
    useEffect(() => {
        const checkBalance = async () => {
            if (!userWlfi || !userUsd1) return;
            
            const vault = getVaultContract();
            const [isImbalanced, ratio] = await vault.checkDepositBalance(
                ethers.utils.parseEther(userWlfi),
                ethers.utils.parseEther(userUsd1)
            );
            
            setBalance({
                isImbalanced,
                wlfiPercentage: ratio / 100,
                warning: isImbalanced 
                    ? '⚠️ This will incur swap fees'
                    : '✅ Well balanced'
            });
        };
        
        checkBalance();
    }, [userWlfi, userUsd1]);
    
    return (
        <div className="optimal-checker">
            <h3>💡 Optimal Deposit Calculator</h3>
            
            {/* Total Value Input */}
            <div>
                <label>Total Value to Deposit ($):</label>
                <input
                    type="number"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                />
            </div>
            
            {/* Optimal Amounts */}
            {optimal && (
                <div className="optimal-display">
                    <h4>✅ Recommended (No swap fees):</h4>
                    <div className="amounts">
                        <span>WLFI: {parseFloat(optimal.wlfi).toFixed(2)}</span>
                        <span>USD1: {parseFloat(optimal.usd1).toFixed(2)}</span>
                    </div>
                </div>
            )}
            
            {/* User's Amounts */}
            <div className="user-amounts">
                <h4>Your Deposit:</h4>
                <input
                    type="number"
                    placeholder="WLFI amount"
                    value={userWlfi}
                    onChange={(e) => setUserWlfi(e.target.value)}
                />
                <input
                    type="number"
                    placeholder="USD1 amount"
                    value={userUsd1}
                    onChange={(e) => setUserUsd1(e.target.value)}
                />
            </div>
            
            {/* Balance Check Result */}
            {balance && (
                <div className={`balance-result ${balance.isImbalanced ? 'warning' : 'success'}`}>
                    <p>{balance.warning}</p>
                    <p>WLFI: {balance.wlfiPercentage.toFixed(2)}%</p>
                    <p>USD1: {(100 - balance.wlfiPercentage).toFixed(2)}%</p>
                    
                    {balance.isImbalanced && (
                        <button onClick={() => {
                            setUserWlfi(optimal?.wlfi || '');
                            setUserUsd1(optimal?.usd1 || '');
                        }}>
                            Use Optimal Amounts
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
```

---

## 🎨 UI/UX Best Practices

### **1. Always Show Preview**
```tsx
// Before user clicks "Zap"
const preview = await vault.previewZapDeposit(tokenIn, amount);
// Show: "You will receive ~X EAGLE shares"
```

### **2. Warn About Slippage**
```tsx
if (slippage > 5) {
    showWarning("High slippage! Consider reducing amount or trying later");
}
```

### **3. Suggest Optimal Deposits**
```tsx
const [optimal] = await vault.getOptimalDepositAmounts(totalValue);
showSuggestion(`💡 Tip: Deposit ${optimal} to avoid swap fees`);
```

### **4. Transaction Status**
```tsx
// Show clear status
"Approving token..." → "Swapping..." → "Depositing..." → "Success!"
```

### **5. Gas Estimation**
```tsx
const gasEstimate = await vault.estimateGas.zapDepositETH(...);
showGasEstimate(`~${gasEstimate} gas (~$X)`);
```

---

## 🔍 Testing Checklist

- [ ] Test zap with ETH
- [ ] Test zap with USDC
- [ ] Test zap with WLFI (should be more efficient)
- [ ] Test zap with USD1 (should be more efficient)
- [ ] Test very small amounts (dust)
- [ ] Test very large amounts (slippage)
- [ ] Test with insufficient balance
- [ ] Test with zero amount
- [ ] Test slippage protection (set minShares high)
- [ ] Test during volatile market conditions
- [ ] Test preview accuracy
- [ ] Test event emissions

---

## 📊 Analytics to Track

```typescript
// Track zap usage
analytics.track('Zap Deposit', {
    tokenIn: 'ETH',
    amountIn: '1.0',
    sharesOut: '950',
    slippage: '2.3%',
    gasUsed: 250000,
    txHash: '0x...'
});

// Track deposit method preference
// - Direct dual deposit: 30%
// - Zap from ETH: 50%
// - Zap from stablecoins: 20%
```

---

**Pro Tips:**
- Zapping saves users time but costs slightly more gas + swap fees
- For large deposits (>$10k), suggest direct dual deposit to save on fees
- Monitor Uniswap pool liquidity - low liquidity = high slippage
- Consider implementing limit orders for very large zaps

---

**Questions?** Check the main [EagleOVault V2 Guide](./EAGLEOVAULT_V2_GUIDE.md)


# 🌐 Portals Integration Guide

## 🎯 Overview

**Portals.fi integration = Zap from ANY token in the world!**

Your EagleOVault now supports deposits from:
- ✅ ETH
- ✅ All stablecoins (USDC, USDT, DAI, FRAX, etc.)
- ✅ Major tokens (WBTC, LINK, UNI, etc.)
- ✅ LP tokens (Uniswap, Curve, Balancer, etc.)
- ✅ Yield tokens (aUSDC, cDAI, stETH, etc.)
- ✅ **Literally ANY ERC20!**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User has ANY token (ETH, USDC, WBTC, etc.)            │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  1. Call Portals API (Off-chain)                        │
│     GET /v2/portal?inputToken=...&outputToken=WLFI+USD1│
│     Returns: Optimal route + transaction data           │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  2. Execute Portals Tx via Vault (On-chain)            │
│     vault.zapViaPortals(portalsCallData, mins)          │
│     • Portals converts ANY token → WLFI + USD1         │
│     • Vault receives both tokens                        │
│     • Vault mints EAGLE shares                          │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  3. Vault Manages Rest (As Before)                     │
│     • Deploys to Charm when threshold met              │
│     • Manages strategies                                │
│     • Omnichain distribution via LayerZero             │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Complete Implementation

### **Step 1: Get Portals API Key**

1. Go to https://portals.fi/
2. Sign up for an account
3. Get your API key from dashboard
4. **Note**: API key is OPTIONAL for zaps, but recommended for rate limits

### **Step 2: Frontend Integration**

```typescript
// File: src/lib/portals.ts

import axios from 'axios';

const PORTALS_API = 'https://api.portals.fi/v2';
const PORTALS_API_KEY = process.env.NEXT_PUBLIC_PORTALS_API_KEY; // Optional

interface PortalsQuoteParams {
  inputToken: string;  // e.g., "ethereum:0x0000...0000" (ETH)
  inputAmount: string; // In base units (wei)
  outputToken: string; // e.g., "ethereum:0xWLFI_ADDRESS"
  sender: string;      // User's wallet address
  slippageTolerancePercentage?: number;
  validate?: boolean;
}

interface PortalsQuote {
  tx: {
    data: string;
    to: string;
    from: string;
    value: string;
    gasLimit: string;
  };
  context: {
    orderId: string;
    minOutputAmount: string;
    outputAmount: string;
    inputAmountUsd: number;
    outputAmountUsd: number;
    route: string[];
    steps: string[];
  };
}

/**
 * Get quote from Portals to convert any token to WLFI + USD1
 * @param params Quote parameters
 * @returns Portals quote with transaction data
 */
export async function getPortalsQuote(
  params: PortalsQuoteParams
): Promise<PortalsQuote> {
  try {
    const { data } = await axios.get(`${PORTALS_API}/portal`, {
      params: {
        ...params,
        validate: params.validate ?? true, // Default to validating
      },
      headers: PORTALS_API_KEY 
        ? { 'Authorization': `Bearer ${PORTALS_API_KEY}` }
        : undefined
    });
    
    return data;
  } catch (error) {
    console.error('Portals API error:', error);
    throw error;
  }
}

/**
 * Get TWO Portals quotes: one for WLFI, one for USD1
 * This gives us both tokens needed for the vault
 */
export async function getDualPortalsQuotes(
  inputToken: string,
  inputAmount: string,
  sender: string,
  wlfiAddress: string,
  usd1Address: string
): Promise<{ wlfiQuote: PortalsQuote; usd1Quote: PortalsQuote }> {
  // Split input amount 50/50
  const halfAmount = (BigInt(inputAmount) / BigInt(2)).toString();
  
  // Get quote for WLFI
  const wlfiQuote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${wlfiAddress}`,
    sender,
    slippageTolerancePercentage: 0.5, // 0.5% slippage
    validate: true
  });
  
  // Get quote for USD1
  const usd1Quote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${usd1Address}`,
    sender,
    slippageTolerancePercentage: 0.5,
    validate: true
  });
  
  return { wlfiQuote, usd1Quote };
}
```

### **Step 3: Vault Integration Component**

```typescript
// File: src/components/PortalsZap.tsx

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, encodeFunctionData } from 'viem';
import { getPortalsQuote } from '@/lib/portals';

const VAULT_ADDRESS = '0x...'; // Your EagleOVaultV2Portals address
const WLFI_ADDRESS = '0x...';
const USD1_ADDRESS = '0x...';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export function PortalsZap() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ETH' | 'USDC'>('ETH');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  
  /**
   * Step 1: Get Portals quote
   */
  const getQuote = async () => {
    if (!address || !amount) return;
    
    setLoading(true);
    
    try {
      const inputToken = token === 'ETH' 
        ? 'ethereum:0x0000000000000000000000000000000000000000'
        : `ethereum:${USDC_ADDRESS}`;
      
      const inputAmount = token === 'ETH'
        ? parseEther(amount).toString()
        : (parseFloat(amount) * 1e6).toString(); // USDC has 6 decimals
      
      // We need to get TWO quotes: one for WLFI, one for USD1
      // For simplicity, this example shows getting a single quote
      // In production, you'd call Portals twice or use their batch API
      
      const portalsQuote = await getPortalsQuote({
        inputToken,
        inputAmount,
        outputToken: `ethereum:${WLFI_ADDRESS}`, // Or USD1
        sender: address,
        slippageTolerancePercentage: 0.5,
        validate: true
      });
      
      setQuote(portalsQuote);
      console.log('Portals quote:', portalsQuote);
      
    } catch (error) {
      console.error('Failed to get quote:', error);
      alert('Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Step 2: Execute zap via vault
   */
  const executeZap = async () => {
    if (!address || !walletClient || !quote) return;
    
    setLoading(true);
    
    try {
      // The Portals tx.data from the quote
      const portalsCallData = quote.tx.data;
      
      // Minimum amounts for slippage protection
      const expectedWlfiMin = quote.context.minOutputAmount;
      const expectedUsd1Min = '0'; // Set appropriately based on your logic
      
      // Call vault's zapViaPortals function
      const hash = await walletClient.writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'zapViaPortals',
        args: [portalsCallData, expectedWlfiMin, expectedUsd1Min],
        value: token === 'ETH' ? BigInt(quote.tx.value) : 0n,
      });
      
      console.log('Transaction sent:', hash);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      console.log('Transaction confirmed!', receipt);
      alert('Zap successful! You now have EAGLE shares.');
      
    } catch (error) {
      console.error('Zap failed:', error);
      alert('Zap failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="portals-zap">
      <h2>🌐 Zap into Eagle Vault</h2>
      
      {/* Token Selector */}
      <div>
        <label>Select Token:</label>
        <select value={token} onChange={(e) => setToken(e.target.value as any)}>
          <option value="ETH">ETH</option>
          <option value="USDC">USDC</option>
        </select>
      </div>
      
      {/* Amount Input */}
      <div>
        <label>Amount:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Enter ${token} amount`}
        />
      </div>
      
      {/* Get Quote Button */}
      <button onClick={getQuote} disabled={loading || !amount}>
        {loading ? 'Getting Quote...' : 'Get Quote'}
      </button>
      
      {/* Quote Display */}
      {quote && (
        <div className="quote-display">
          <h3>Quote Preview</h3>
          <p>Input: {quote.context.inputAmountUsd.toFixed(2)} USD</p>
          <p>Output: {quote.context.outputAmountUsd.toFixed(2)} USD</p>
          <p>Route: {quote.context.route.join(' → ')}</p>
          <p>Steps: {quote.context.steps.length} operations</p>
          
          <button onClick={executeZap} disabled={loading}>
            {loading ? 'Executing...' : 'Execute Zap'}
          </button>
        </div>
      )}
    </div>
  );
}

const VAULT_ABI = [
  {
    inputs: [
      { name: 'portalsCallData', type: 'bytes' },
      { name: 'expectedWlfiMin', type: 'uint256' },
      { name: 'expectedUsd1Min', type: 'uint256' }
    ],
    name: 'zapViaPortals',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;
```

---

## 🎨 Advanced: Split Zap for Both Tokens

For optimal results, we want to zap into BOTH WLFI and USD1 in one transaction. Here's how:

```typescript
// File: src/lib/portalsAdvanced.ts

/**
 * Generate Portals transaction for zapping to BOTH WLFI and USD1
 * This uses Portals' multi-output capability
 */
export async function getPortalsDualZapQuote(
  inputToken: string,
  inputAmount: string,
  sender: string
): Promise<PortalsQuote> {
  // Strategy: Use Portals to convert to USDC first (most liquid)
  // Then vault can handle USDC → WLFI + USD1 efficiently
  
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  
  const quote = await getPortalsQuote({
    inputToken,
    inputAmount,
    outputToken: `ethereum:${usdcAddress}`,
    sender: VAULT_ADDRESS, // Important: sender is the vault!
    slippageTolerancePercentage: 0.5,
    validate: true
  });
  
  return quote;
}

/**
 * Alternative: Use TWO Portals calls (more precise)
 */
export async function getPortalsSplitZapQuotes(
  inputToken: string,
  inputAmount: string,
  userAddress: string,
  vaultAddress: string
): Promise<{
  wlfiTx: any;
  usd1Tx: any;
  totalValue: string;
}> {
  const halfAmount = (BigInt(inputAmount) / BigInt(2)).toString();
  
  // Get WLFI quote
  const wlfiQuote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${WLFI_ADDRESS}`,
    sender: vaultAddress, // Vault receives the tokens
    validate: true
  });
  
  // Get USD1 quote  
  const usd1Quote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${USD1_ADDRESS}`,
    sender: vaultAddress,
    validate: true
  });
  
  return {
    wlfiTx: wlfiQuote.tx,
    usd1Tx: usd1Quote.tx,
    totalValue: (
      BigInt(wlfiQuote.context.outputAmount) + 
      BigInt(usd1Quote.context.outputAmount)
    ).toString()
  };
}
```

---

## 📊 Comparison: With vs Without Portals

### **Scenario: User wants to deposit $1000 WBTC**

#### **Without Portals (Current V2)**
```
❌ Complex for user:
1. User swaps WBTC → ETH on DEX
2. User swaps half ETH → WLFI on Uniswap
3. User swaps half ETH → USD1 on Uniswap
4. User approves WLFI to vault
5. User approves USD1 to vault
6. User deposits to vault
= 6 transactions, ~$150 gas, 30+ minutes
```

#### **With Portals (New Version)**
```
✅ Simple for user:
1. User calls vault.zapViaPortals()
= 1 transaction, ~$50 gas, 2 minutes
```

---

## 🔐 Security Considerations

### **1. Slippage Protection**

```typescript
// ALWAYS set minimum amounts
const expectedWlfiMin = (
  BigInt(quote.context.outputAmount) * BigInt(95) / BigInt(100)
).toString(); // 5% slippage tolerance
```

### **2. Validate Portals Response**

```typescript
// Before executing, validate:
if (quote.context.slippageTolerancePercentage > 5) {
  throw new Error('Slippage too high!');
}

if (quote.context.outputAmountUsd < expectedUsd * 0.90) {
  throw new Error('Output too low!');
}
```

### **3. Simulate First**

```typescript
// Always use validate=true in Portals API
const quote = await getPortalsQuote({
  ...params,
  validate: true // Simulates transaction
});
```

---

## 💰 Gas & Fees

### **Gas Costs**

| Operation | Gas | Cost @ 50 gwei |
|-----------|-----|----------------|
| Portals zap (simple) | ~300k | $18.75 |
| Portals zap (complex) | ~500k | $31.25 |
| Direct dual deposit | ~120k | $7.50 |

**Note**: Portals costs more gas but saves user multiple transactions

### **Fees**

Portals allows you to charge a fee:

```typescript
const quote = await getPortalsQuote({
  ...params,
  partner: '0xYourAddress',
  feePercentage: 0.3 // 0.3% fee to you
});
```

Set in vault:
```solidity
vault.setPortalsPartner('0xYourAddress');
vault.setPortalsFee(30); // 0.3% in basis points
```

---

## 🧪 Testing Checklist

Before mainnet:

- [ ] Test zap from ETH
- [ ] Test zap from USDC
- [ ] Test zap from WBTC
- [ ] Test zap from obscure token
- [ ] Test with small amount ($10)
- [ ] Test with large amount ($10k)
- [ ] Test slippage protection
- [ ] Test with low liquidity token
- [ ] Test Portals API rate limits
- [ ] Test error handling
- [ ] Verify gas costs are reasonable
- [ ] Check Portals router is approved correctly

---

## 🎯 Best Practices

### **1. Show Route to User**

```typescript
// Display the swap route from Portals
quote.context.route.forEach((step, i) => {
  console.log(`Step ${i + 1}: ${step}`);
});

// Show detailed steps
quote.context.steps.forEach((step, i) => {
  console.log(`  ${i + 1}. ${step}`);
});
```

### **2. Cache Quotes**

```typescript
// Quotes are valid for ~30 seconds
const QUOTE_CACHE_TIME = 20_000; // 20 seconds

let cachedQuote = null;
let cacheTime = 0;

function getCachedOrFetchQuote(params) {
  if (Date.now() - cacheTime < QUOTE_CACHE_TIME && cachedQuote) {
    return cachedQuote;
  }
  
  cachedQuote = await getPortalsQuote(params);
  cacheTime = Date.now();
  return cachedQuote;
}
```

### **3. Handle Rate Limits**

```typescript
// Portals rate limit: 100 RPM
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

const quotes = await Promise.all(
  tokens.map(token => 
    limit(() => getPortalsQuote({ ...params, inputToken: token }))
  )
);
```

---

## 📚 Additional Resources

- **Portals Docs**: https://docs.portals.fi/
- **API Reference**: https://docs.portals.fi/api-reference
- **Swagger UI**: https://api.portals.fi/docs
- **Discord**: https://discord.gg/portals

---

## ✅ Summary

### **What You Get with Portals**

✅ Zap from **ANY token**  
✅ **Best prices** across all DEXs  
✅ **Multi-hop routing**  
✅ **Built-in slippage protection**  
✅ **Transaction simulation**  
✅ **Gasless approvals** (permit)  
✅ **90% less code** to maintain  

### **How to Use**

1. **Off-chain**: Call Portals API to get transaction data
2. **On-chain**: Execute via `vault.zapViaPortals()`
3. **Done**: User gets EAGLE shares!

### **Gas Trade-off**

- **Pro**: 1 transaction instead of 6
- **Con**: ~300k gas vs ~120k for direct deposit
- **Result**: Better UX, worth the extra gas for most users

---

**Ready to accept deposits from the entire crypto universe! 🌐**


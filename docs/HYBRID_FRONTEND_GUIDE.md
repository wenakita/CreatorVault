# 🎨 Hybrid Vault Frontend Integration Guide

## 🎯 Complete Integration for All Three Deposit Methods

Your `EagleOVaultV2Hybrid` supports three deposit methods. This guide shows how to integrate ALL of them in your frontend!

---

## 📁 Project Structure

```
src/
├── lib/
│   ├── portals.ts          # Portals API integration
│   ├── vault.ts             # Vault contract helpers
│   └── constants.ts         # Addresses & ABIs
├── components/
│   ├── DepositSelector.tsx  # Choose deposit method
│   ├── PortalsZap.tsx       # Method 1: Portals
│   ├── UniswapZap.tsx       # Method 2: Uniswap
│   └── DirectDeposit.tsx    # Method 3: Direct
└── hooks/
    └── useVault.ts          # Vault interaction hook
```

---

## 🔧 Setup

### **1. Install Dependencies**

```bash
npm install viem wagmi axios
```

### **2. Constants & Config**

```typescript
// src/lib/constants.ts

export const ADDRESSES = {
  // Vault
  VAULT: '0x...', // Your EagleOVaultV2Hybrid address
  
  // Tokens
  WLFI: '0x...',
  USD1: '0x...',
  
  // Common tokens for UI
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  
  // Integrations
  UNISWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  PORTALS_ROUTER: '0xbf5a7f3629fb325e2a8453d595ab103465f75e62',
} as const;

export const PORTALS_API_URL = 'https://api.portals.fi/v2';
export const PORTALS_API_KEY = process.env.NEXT_PUBLIC_PORTALS_API_KEY;

// Vault ABI (only functions we need)
export const VAULT_ABI = [
  // Method 1: Portals
  {
    name: 'zapETHViaPortals',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'portalsCallData', type: 'bytes' },
      { name: 'expectedWlfiMin', type: 'uint256' },
      { name: 'expectedUsd1Min', type: 'uint256' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    name: 'zapViaPortals',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'portalsCallData', type: 'bytes' },
      { name: 'expectedWlfiMin', type: 'uint256' },
      { name: 'expectedUsd1Min', type: 'uint256' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  // Method 2: Uniswap
  {
    name: 'zapDepositETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'minSharesOut', type: 'uint256' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    name: 'zapDeposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'minSharesOut', type: 'uint256' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  // Method 3: Direct
  {
    name: 'depositDual',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wlfiAmount', type: 'uint256' },
      { name: 'usd1Amount', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  // View functions
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  }
] as const;
```

---

## 🌐 Portals API Integration

```typescript
// src/lib/portals.ts

import axios from 'axios';
import { PORTALS_API_URL, PORTALS_API_KEY, ADDRESSES } from './constants';

interface PortalsQuoteParams {
  inputToken: string;
  inputAmount: string;
  outputToken: string;
  sender: string;
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
    slippageTolerancePercentage: number;
    route: string[];
    steps: string[];
  };
}

/**
 * Get Portals quote for converting any token to WLFI+USD1
 */
export async function getPortalsQuote(
  params: PortalsQuoteParams
): Promise<PortalsQuote> {
  const { data } = await axios.get(`${PORTALS_API_URL}/portal`, {
    params: {
      ...params,
      validate: params.validate ?? true,
    },
    headers: PORTALS_API_KEY 
      ? { 'Authorization': `Bearer ${PORTALS_API_KEY}` }
      : undefined
  });
  
  return data;
}

/**
 * Get DUAL quotes for WLFI and USD1
 * User's input is split 50/50 between both tokens
 */
export async function getDualPortalsQuotes(
  inputToken: string,
  inputAmount: string,
  sender: string
): Promise<{
  wlfiQuote: PortalsQuote;
  usd1Quote: PortalsQuote;
  totalExpectedWlfi: string;
  totalExpectedUsd1: string;
}> {
  const halfAmount = (BigInt(inputAmount) / BigInt(2)).toString();
  
  // Get quote for WLFI
  const wlfiQuote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${ADDRESSES.WLFI}`,
    sender,
    slippageTolerancePercentage: 0.5,
    validate: true
  });
  
  // Get quote for USD1
  const usd1Quote = await getPortalsQuote({
    inputToken,
    inputAmount: halfAmount,
    outputToken: `ethereum:${ADDRESSES.USD1}`,
    sender,
    slippageTolerancePercentage: 0.5,
    validate: true
  });
  
  return {
    wlfiQuote,
    usd1Quote,
    totalExpectedWlfi: wlfiQuote.context.outputAmount,
    totalExpectedUsd1: usd1Quote.context.outputAmount
  };
}

/**
 * Format token address for Portals API
 */
export function formatPortalsToken(address: string, chainId: number = 1): string {
  const chainName = chainId === 1 ? 'ethereum' : 'unknown';
  return `${chainName}:${address}`;
}
```

---

## 🪝 React Hook for Vault

```typescript
// src/hooks/useVault.ts

import { useAccount, useContractWrite, useContractRead } from 'wagmi';
import { parseEther } from 'viem';
import { ADDRESSES, VAULT_ABI } from '@/lib/constants';
import { getPortalsQuote, getDualPortalsQuotes } from '@/lib/portals';

export function useVault() {
  const { address } = useAccount();
  
  // Read user's EAGLE balance
  const { data: eagleBalance } = useContractRead({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    watch: true
  });
  
  // Read total vault assets
  const { data: totalAssets } = useContractRead({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
    watch: true
  });
  
  // Method 1: Portals Zap (ETH)
  const { writeAsync: zapETHViaPortals } = useContractWrite({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'zapETHViaPortals'
  });
  
  // Method 1: Portals Zap (ERC20)
  const { writeAsync: zapViaPortals } = useContractWrite({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'zapViaPortals'
  });
  
  // Method 2: Uniswap Zap (ETH)
  const { writeAsync: zapDepositETH } = useContractWrite({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'zapDepositETH'
  });
  
  // Method 2: Uniswap Zap (ERC20)
  const { writeAsync: zapDeposit } = useContractWrite({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'zapDeposit'
  });
  
  // Method 3: Direct Deposit
  const { writeAsync: depositDual } = useContractWrite({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'depositDual'
  });
  
  return {
    eagleBalance,
    totalAssets,
    zapETHViaPortals,
    zapViaPortals,
    zapDepositETH,
    zapDeposit,
    depositDual
  };
}
```

---

## 🎨 Component: Deposit Selector

```typescript
// src/components/DepositSelector.tsx

import { useState } from 'react';
import { PortalsZap } from './PortalsZap';
import { UniswapZap } from './UniswapZap';
import { DirectDeposit } from './DirectDeposit';

type DepositMethod = 'portals' | 'uniswap' | 'direct';

export function DepositSelector() {
  const [method, setMethod] = useState<DepositMethod>('portals');
  
  return (
    <div className="deposit-container">
      {/* Method Selector */}
      <div className="method-selector">
        <h2>Choose Deposit Method</h2>
        
        <div className="methods">
          <button
            onClick={() => setMethod('portals')}
            className={method === 'portals' ? 'active' : ''}
          >
            <span className="icon">🌐</span>
            <div>
              <h3>Portals</h3>
              <p>ANY token • Best prices</p>
              <small>~$25 gas</small>
            </div>
          </button>
          
          <button
            onClick={() => setMethod('uniswap')}
            className={method === 'uniswap' ? 'active' : ''}
          >
            <span className="icon">⚡</span>
            <div>
              <h3>Direct Swap</h3>
              <p>ETH, USDC • Fast</p>
              <small>~$18 gas</small>
            </div>
          </button>
          
          <button
            onClick={() => setMethod('direct')}
            className={method === 'direct' ? 'active' : ''}
          >
            <span className="icon">💎</span>
            <div>
              <h3>Direct Deposit</h3>
              <p>WLFI+USD1 • Best gas</p>
              <small>~$7 gas</small>
            </div>
          </button>
        </div>
      </div>
      
      {/* Selected Method Component */}
      <div className="deposit-interface">
        {method === 'portals' && <PortalsZap />}
        {method === 'uniswap' && <UniswapZap />}
        {method === 'direct' && <DirectDeposit />}
      </div>
    </div>
  );
}
```

---

## 🌐 Component: Portals Zap

```typescript
// src/components/PortalsZap.tsx

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useVault } from '@/hooks/useVault';
import { getDualPortalsQuotes, formatPortalsToken } from '@/lib/portals';
import { ADDRESSES } from '@/lib/constants';

export function PortalsZap() {
  const { address } = useAccount();
  const { zapETHViaPortals, zapViaPortals } = useVault();
  
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ETH' | 'USDC'>('ETH');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  
  const handleGetQuote = async () => {
    if (!address || !amount) return;
    
    setLoading(true);
    
    try {
      const inputToken = token === 'ETH'
        ? formatPortalsToken('0x0000000000000000000000000000000000000000')
        : formatPortalsToken(ADDRESSES.USDC);
      
      const inputAmount = token === 'ETH'
        ? parseEther(amount).toString()
        : (parseFloat(amount) * 1e6).toString();
      
      // Get dual quotes for WLFI and USD1
      const quotes = await getDualPortalsQuotes(
        inputToken,
        inputAmount,
        ADDRESSES.VAULT // Vault is the recipient
      );
      
      setQuote(quotes);
    } catch (error) {
      console.error('Failed to get quote:', error);
      alert('Failed to get quote');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExecute = async () => {
    if (!quote) return;
    
    setLoading(true);
    
    try {
      if (token === 'ETH') {
        // Execute ETH zap via Portals
        await zapETHViaPortals({
          args: [
            quote.wlfiQuote.tx.data, // WLFI transaction data
            BigInt(quote.totalExpectedWlfi) * BigInt(95) / BigInt(100), // 5% slippage
            BigInt(quote.totalExpectedUsd1) * BigInt(95) / BigInt(100)
          ],
          value: parseEther(amount)
        });
      } else {
        // Execute ERC20 zap via Portals
        // (User needs to approve first)
        await zapViaPortals({
          args: [
            ADDRESSES.USDC,
            BigInt(parseFloat(amount) * 1e6),
            quote.wlfiQuote.tx.data,
            BigInt(quote.totalExpectedWlfi) * BigInt(95) / BigInt(100),
            BigInt(quote.totalExpectedUsd1) * BigInt(95) / BigInt(100)
          ]
        });
      }
      
      alert('Zap successful!');
      setQuote(null);
      setAmount('');
    } catch (error) {
      console.error('Zap failed:', error);
      alert('Zap failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="portals-zap">
      <h3>🌐 Zap from ANY Token</h3>
      
      <div className="input-group">
        <label>Token</label>
        <select value={token} onChange={(e) => setToken(e.target.value as any)}>
          <option value="ETH">ETH</option>
          <option value="USDC">USDC</option>
        </select>
      </div>
      
      <div className="input-group">
        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Enter ${token} amount`}
        />
      </div>
      
      <button onClick={handleGetQuote} disabled={loading || !amount}>
        {loading ? 'Getting Quote...' : 'Get Quote'}
      </button>
      
      {quote && (
        <div className="quote-display">
          <h4>Quote Preview</h4>
          <p>Input: ${quote.wlfiQuote.context.inputAmountUsd.toFixed(2)}</p>
          <p>Output: ${quote.wlfiQuote.context.outputAmountUsd.toFixed(2)}</p>
          <p>Route: {quote.wlfiQuote.context.route.join(' → ')}</p>
          
          <button onClick={handleExecute} disabled={loading}>
            {loading ? 'Executing...' : 'Execute Zap'}
          </button>
        </div>
      )}
      
      <div className="info">
        <p>✅ Best prices across all DEXs</p>
        <p>✅ Supports ANY ERC20 token</p>
        <p>✅ Optimal multi-hop routing</p>
      </div>
    </div>
  );
}
```

---

## ⚡ Component: Uniswap Zap

```typescript
// src/components/UniswapZap.tsx

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useVault } from '@/hooks/useVault';

export function UniswapZap() {
  const { address } = useAccount();
  const { zapDepositETH } = useVault();
  
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleZap = async () => {
    if (!address || !amount) return;
    
    setLoading(true);
    
    try {
      const amountWei = parseEther(amount);
      const minShares = amountWei * BigInt(95) / BigInt(100); // 5% slippage
      
      await zapDepositETH({
        args: [address, minShares],
        value: amountWei
      });
      
      alert('Zap successful!');
      setAmount('');
    } catch (error) {
      console.error('Zap failed:', error);
      alert('Zap failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="uniswap-zap">
      <h3>⚡ Direct Swap (Uniswap)</h3>
      
      <div className="input-group">
        <label>ETH Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter ETH amount"
        />
      </div>
      
      <button onClick={handleZap} disabled={loading || !amount}>
        {loading ? 'Zapping...' : 'Zap ETH'}
      </button>
      
      <div className="info">
        <p>✅ Fast execution via Uniswap</p>
        <p>✅ Lower gas (~$18)</p>
        <p>✅ Great for ETH and common tokens</p>
      </div>
    </div>
  );
}
```

---

## 💎 Component: Direct Deposit

```typescript
// src/components/DirectDeposit.tsx

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useVault } from '@/hooks/useVault';

export function DirectDeposit() {
  const { address } = useAccount();
  const { depositDual } = useVault();
  
  const [wlfiAmount, setWlfiAmount] = useState('');
  const [usd1Amount, setUsd1Amount] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleDeposit = async () => {
    if (!address || (!wlfiAmount && !usd1Amount)) return;
    
    setLoading(true);
    
    try {
      await depositDual({
        args: [
          parseEther(wlfiAmount || '0'),
          parseEther(usd1Amount || '0'),
          address
        ]
      });
      
      alert('Deposit successful!');
      setWlfiAmount('');
      setUsd1Amount('');
    } catch (error) {
      console.error('Deposit failed:', error);
      alert('Deposit failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="direct-deposit">
      <h3>💎 Direct Deposit</h3>
      
      <div className="input-group">
        <label>WLFI Amount</label>
        <input
          type="number"
          value={wlfiAmount}
          onChange={(e) => setWlfiAmount(e.target.value)}
          placeholder="Enter WLFI amount"
        />
      </div>
      
      <div className="input-group">
        <label>USD1 Amount</label>
        <input
          type="number"
          value={usd1Amount}
          onChange={(e) => setUsd1Amount(e.target.value)}
          placeholder="Enter USD1 amount"
        />
      </div>
      
      <button onClick={handleDeposit} disabled={loading || (!wlfiAmount && !usd1Amount)}>
        {loading ? 'Depositing...' : 'Deposit'}
      </button>
      
      <div className="info">
        <p>✅ Lowest gas (~$7.50)</p>
        <p>✅ No swaps needed</p>
        <p>✅ Perfect for power users</p>
        <p>💡 Tip: Use 50/50 ratio for best results</p>
      </div>
    </div>
  );
}
```

---

## 🎨 CSS Styling

```css
/* styles/deposit.css */

.deposit-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.method-selector {
  margin-bottom: 2rem;
}

.methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.methods button {
  padding: 1.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.methods button:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
}

.methods button.active {
  border-color: #4CAF50;
  background: #f0f9f0;
}

.methods button .icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.methods button h3 {
  font-size: 1.1rem;
  margin: 0.5rem 0;
}

.methods button p {
  font-size: 0.9rem;
  color: #666;
  margin: 0.25rem 0;
}

.methods button small {
  color: #999;
  font-size: 0.8rem;
}

.deposit-interface {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 2rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.input-group input,
.input-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}

button {
  width: 100%;
  padding: 1rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #45a049;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.quote-display {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.info {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 8px;
  font-size: 0.9rem;
}

.info p {
  margin: 0.5rem 0;
}
```

---

## ✅ Complete! Your users can now:

1. **🌐 Zap from ANY token** (Portals) - Best prices, widest reach
2. **⚡ Zap from ETH/USDC** (Uniswap) - Fast & efficient
3. **💎 Direct deposit WLFI+USD1** - Lowest gas

**All in one beautiful UI!** 🎉

Want me to add analytics tracking or advanced features?


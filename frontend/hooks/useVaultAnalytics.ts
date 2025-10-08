import { useState, useEffect } from 'react';
import { useContractReads } from 'wagmi';
import { formatEther } from 'viem';

const VAULT_ADDRESS = '0x4f00fAB0361009d975Eb04E172268Bf1E73737bC';
const STRATEGY_ADDRESSES = [
  '0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1', // SmartCharmStrategy
  // Add more strategies as you deploy them
];

const VAULT_ABI = [
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1)',
  'function balanceOf(address) external view returns (uint256)'
] as const;

const STRATEGY_ABI = [
  'function getTotalAmounts() external view returns (uint256 wlfi, uint256 usd1)'
] as const;

export interface VaultAnalytics {
  // Basic metrics
  totalValue: number;
  sharePrice: number;
  totalShares: number;
  
  // Distribution
  directValue: number;
  strategyValue: number;
  directPercent: number;
  strategyPercent: number;
  
  // Strategies
  strategies: Array<{
    address: string;
    value: number;
    percent: number;
  }>;
  
  // APR
  estimatedAPR: number;
  
  // User (if connected)
  userShares?: number;
  userValue?: number;
  userPercent?: number;
  
  // Status
  isLoading: boolean;
  error?: string;
}

/**
 * Hook to fetch and calculate all vault analytics
 * @param userAddress Optional user address to include user position
 * @returns Complete vault analytics
 */
export function useVaultAnalytics(userAddress?: `0x${string}`): VaultAnalytics {
  const [analytics, setAnalytics] = useState<VaultAnalytics>({
    totalValue: 0,
    sharePrice: 1,
    totalShares: 0,
    directValue: 0,
    strategyValue: 0,
    directPercent: 0,
    strategyPercent: 0,
    strategies: [],
    estimatedAPR: 0,
    isLoading: true
  });

  // Build contract read array
  const contracts = [
    { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets' },
    { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalSupply' },
    { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getVaultBalances' },
    ...STRATEGY_ADDRESSES.map(addr => ({
      address: addr as `0x${string}`,
      abi: STRATEGY_ABI,
      functionName: 'getTotalAmounts' as const
    })),
    ...(userAddress ? [{
      address: VAULT_ADDRESS as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [userAddress]
    }] : [])
  ];

  const { data, isLoading, error } = useContractReads({
    contracts,
    watch: true,
    cacheTime: 10_000 // 10 seconds
  });

  useEffect(() => {
    if (!data || isLoading) return;

    try {
      const [totalAssetsResult, totalSupplyResult, vaultBalancesResult, ...rest] = data;

      const totalAssets = BigInt(totalAssetsResult.result || 0);
      const totalSupply = BigInt(totalSupplyResult.result || 0);
      const [vaultWlfi, vaultUsd1] = vaultBalancesResult.result || [0n, 0n];

      const directValue = vaultWlfi + vaultUsd1;
      
      // Calculate strategy values
      let strategyValue = 0n;
      const strategyBreakdown = [];
      
      for (let i = 0; i < STRATEGY_ADDRESSES.length; i++) {
        const strategyResult = rest[i];
        if (strategyResult?.result) {
          const [wlfi, usd1] = strategyResult.result as [bigint, bigint];
          const value = wlfi + usd1;
          strategyValue += value;
          
          strategyBreakdown.push({
            address: STRATEGY_ADDRESSES[i],
            value: parseFloat(formatEther(value)),
            percent: totalAssets > 0n ? Number(value * 100n / totalAssets) : 0
          });
        }
      }

      const sharePrice = totalSupply > 0n 
        ? Number(totalAssets) / Number(totalSupply)
        : 1.0;

      // Calculate weighted APR (example: Charm at 13.5%)
      const directPct = totalAssets > 0n ? Number(directValue * 100n / totalAssets) : 0;
      const strategyPct = totalAssets > 0n ? Number(strategyValue * 100n / totalAssets) : 0;
      const estimatedAPR = (directPct * 0 + strategyPct * 13.5) / 100;

      // User position (if address provided)
      let userAnalytics = {};
      if (userAddress && rest[STRATEGY_ADDRESSES.length]) {
        const userShares = BigInt(rest[STRATEGY_ADDRESSES.length].result || 0);
        const userValue = totalSupply > 0n ? (userShares * totalAssets) / totalSupply : 0n;
        const userPercent = totalSupply > 0n ? Number(userShares * 10000n / totalSupply) / 100 : 0;

        userAnalytics = {
          userShares: parseFloat(formatEther(userShares)),
          userValue: parseFloat(formatEther(userValue)),
          userPercent
        };
      }

      setAnalytics({
        totalValue: parseFloat(formatEther(totalAssets)),
        sharePrice,
        totalShares: parseFloat(formatEther(totalSupply)),
        directValue: parseFloat(formatEther(directValue)),
        strategyValue: parseFloat(formatEther(strategyValue)),
        directPercent: totalAssets > 0n ? Number(directValue * 100n / totalAssets) : 0,
        strategyPercent: totalAssets > 0n ? Number(strategyValue * 100n / totalAssets) : 0,
        strategies: strategyBreakdown,
        estimatedAPR,
        ...userAnalytics,
        isLoading: false
      });
    } catch (err) {
      setAnalytics(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }));
    }
  }, [data, isLoading, userAddress]);

  return analytics;
}

/**
 * Hook to calculate APR from historical share prices
 * @param currentPrice Current share price
 * @param previousPrice Share price from 24h ago
 * @returns APR calculation
 */
export function useAPRCalculation(currentPrice: number, previousPrice: number) {
  const dailyReturn = previousPrice > 0 
    ? (currentPrice - previousPrice) / previousPrice 
    : 0;
  
  const apr = dailyReturn * 365 * 100;
  const apy = ((1 + dailyReturn) ** 365 - 1) * 100; // Compound daily

  return {
    dailyReturn: dailyReturn * 100,
    apr,
    apy
  };
}

/**
 * Hook to track share price history
 * Stores prices in localStorage for APR calculation
 */
export function useSharePriceHistory() {
  const STORAGE_KEY = 'eagle_vault_price_history';

  const savePrice = (price: number) => {
    const history = getHistory();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    history[today] = price;
    
    // Keep only last 30 days
    const dates = Object.keys(history).sort();
    if (dates.length > 30) {
      const toKeep = dates.slice(-30);
      const filtered: Record<string, number> = {};
      toKeep.forEach(date => filtered[date] = history[date]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  };

  const getHistory = (): Record<string, number> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  };

  const getPriceFromDaysAgo = (days: number): number | null => {
    const history = getHistory();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    return history[dateStr] || null;
  };

  return {
    savePrice,
    getHistory,
    getPriceFromDaysAgo
  };
}


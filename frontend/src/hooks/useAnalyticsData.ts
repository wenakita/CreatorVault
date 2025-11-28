import { useState, useEffect, useCallback } from 'react';
import { CONTRACTS } from '../config/contracts';

interface VaultMetrics {
  tvlToken0: string;
  tvlToken1: string;
  totalSupply: string;
  snapshotCount: number;
  firstSnapshotDate: string | null;
  lastSnapshotDate: string | null;
  // These would need price feeds to calculate properly
  estimatedApy: string | null;
}

interface HistoricalSnapshot {
  timestamp: number;
  date: string;
  tvlToken0: number;
  tvlToken1: number;
  totalSupply: number;
}

interface VaultData {
  address: string;
  name: string;
  token0Symbol: string;
  token1Symbol: string;
  metrics: VaultMetrics | null;
  historicalSnapshots: HistoricalSnapshot[];
}

interface AnalyticsData {
  vaults: {
    USD1_WLFI: VaultData;
    WETH_WLFI: VaultData;
  };
  meta: {
    totalSnapshots: number;
    generatedAt: string;
    note: string;
  };
}

interface UseAnalyticsDataResult {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  source: 'cache' | 'graphql' | null;
}

// Fetch from Charm Finance GraphQL
async function fetchFromGraphQLDirect(vaultAddress: string) {
  const query = `
    query GetVault($address: ID!) {
      vault(id: $address) {
        totalSupply
        snapshot(orderBy: timestamp, orderDirection: asc, first: 1000) {
          timestamp
          totalAmount0
          totalAmount1
          totalSupply
        }
      }
    }
  `;

  const response = await fetch('https://stitching-v2.herokuapp.com/1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { address: vaultAddress.toLowerCase() } })
  });

  const result = await response.json();
  return result.data?.vault?.snapshot || [];
}

// Format token amounts (from wei to human readable)
function formatTokenAmount(amount: string, decimals: number = 18): string {
  const value = parseFloat(amount) / Math.pow(10, decimals);
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function processSnapshots(snapshots: any[]): {
  metrics: VaultMetrics | null;
  historicalSnapshots: HistoricalSnapshot[];
} {
  if (!snapshots || snapshots.length === 0) {
    return { metrics: null, historicalSnapshots: [] };
  }

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];

  const historicalSnapshots: HistoricalSnapshot[] = snapshots.map((s: any) => ({
    timestamp: parseInt(s.timestamp),
    date: formatDate(parseInt(s.timestamp)),
    tvlToken0: parseFloat(s.totalAmount0) / 1e18,
    tvlToken1: parseFloat(s.totalAmount1) / 1e18,
    totalSupply: parseFloat(s.totalSupply) / 1e18,
  }));

  const metrics: VaultMetrics = {
    tvlToken0: formatTokenAmount(latest.totalAmount0),
    tvlToken1: formatTokenAmount(latest.totalAmount1),
    totalSupply: formatTokenAmount(latest.totalSupply),
    snapshotCount: snapshots.length,
    firstSnapshotDate: formatDate(parseInt(first.timestamp)),
    lastSnapshotDate: formatDate(parseInt(latest.timestamp)),
    // Note: Real APY calculation requires USD price feeds for both tokens
    // The vault earns fees from Uniswap V3 LP positions managed by Charm
    estimatedApy: null, // Would need Charm's fee data or price feeds
  };

  return { metrics, historicalSnapshots };
}

export function useAnalyticsData(days: number = 90): UseAnalyticsDataResult {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'cache' | 'graphql' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from GraphQL directly
      console.log('[useAnalyticsData] Fetching from GraphQL...');
      
      const [usd1Snapshots, wethSnapshots] = await Promise.all([
        fetchFromGraphQLDirect(CONTRACTS.CHARM_VAULT),
        fetchFromGraphQLDirect('0x3314e248f3f752cd16939773d83beb3a362f0aef'),
      ]);

      const usd1Data = processSnapshots(usd1Snapshots);
      const wethData = processSnapshots(wethSnapshots);

      const analyticsData: AnalyticsData = {
        vaults: {
          USD1_WLFI: {
            address: CONTRACTS.CHARM_VAULT,
            name: 'USD1/WLFI Vault',
            token0Symbol: 'USD1',
            token1Symbol: 'WLFI',
            metrics: usd1Data.metrics,
            historicalSnapshots: usd1Data.historicalSnapshots,
          },
          WETH_WLFI: {
            address: '0x3314e248f3f752cd16939773d83beb3a362f0aef',
            name: 'WETH/WLFI Vault',
            token0Symbol: 'WETH',
            token1Symbol: 'WLFI',
            metrics: wethData.metrics,
            historicalSnapshots: wethData.historicalSnapshots,
          },
        },
        meta: {
          totalSnapshots: usd1Snapshots.length + wethSnapshots.length,
          generatedAt: new Date().toISOString(),
          note: 'APY calculation requires USD price feeds. TVL shown in token amounts.',
        },
      };

      setData(analyticsData);
      setSource('graphql');

    } catch (err: any) {
      console.error('[useAnalyticsData] Error:', err);
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    source,
  };
}

// Hook for getting real APY - would need price feed integration
export function useVaultApy(): {
  apy: string | null;
  loading: boolean;
  source: string;
} {
  // TODO: Integrate with:
  // 1. Chainlink price feeds for USD1 and WLFI
  // 2. Or Charm Finance's API if they provide APY data
  // 3. Or calculate from actual fee earnings in the pool
  
  return {
    apy: null,
    loading: false,
    source: 'Price feeds required for accurate APY calculation',
  };
}

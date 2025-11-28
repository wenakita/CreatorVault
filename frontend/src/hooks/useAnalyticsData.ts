import { useState, useEffect, useCallback } from 'react';
import { CONTRACTS } from '../config/contracts';

interface VaultMetrics {
  currentFeeApr: string | null;
  weeklyApy: string | null;
  monthlyApy: string | null;
  inceptionApy: string | null;
  weeklyFeeApr: string | null;
  snapshotCount: number;
}

interface HistoricalSnapshot {
  timestamp: number;
  feeApr: string | null;
  annualVsHold: string | null;
}

interface VaultData {
  address: string;
  metrics: VaultMetrics | null;
  historicalSnapshots: HistoricalSnapshot[];
}

interface AnalyticsData {
  vaults: {
    USD1_WLFI: VaultData;
    WETH_WLFI: VaultData;
  };
  syncStatus: Record<string, {
    lastSyncAt: string | null;
    syncErrors: number;
    lastError: string | null;
  }>;
  meta: {
    daysRequested: number;
    totalSnapshots: number;
    generatedAt: string;
  };
}

interface UseAnalyticsDataResult {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  source: 'cache' | 'graphql' | null;
}

// Fallback: Direct GraphQL fetch from Charm Finance
async function fetchFromGraphQLDirect(vaultAddress: string) {
  const query = `
    query GetVault($address: ID!) {
      vault(id: $address) {
        snapshot(orderBy: timestamp, orderDirection: asc, first: 1000) {
          timestamp
          feeApr
          annualVsHoldPerfSince
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

function calculateMetricsFromSnapshots(snapshots: any[]): VaultMetrics | null {
  if (!snapshots || snapshots.length === 0) return null;

  const now = Date.now() / 1000;
  const oneWeekAgo = now - (7 * 24 * 60 * 60);
  const oneMonthAgo = now - (30 * 24 * 60 * 60);

  const current = snapshots[snapshots.length - 1];
  const weeklySnapshots = snapshots.filter((s: any) => parseInt(s.timestamp) >= oneWeekAgo);
  const monthlySnapshots = snapshots.filter((s: any) => parseInt(s.timestamp) >= oneMonthAgo);

  const avgApy = (snaps: any[]) => {
    const valid = snaps.filter(s => s.annualVsHoldPerfSince);
    if (valid.length === 0) return null;
    return (valid.reduce((sum, s) => sum + parseFloat(s.annualVsHoldPerfSince || '0'), 0) / valid.length * 100).toFixed(2);
  };

  const avgApr = (snaps: any[]) => {
    const valid = snaps.filter(s => s.feeApr);
    if (valid.length === 0) return null;
    return (valid.reduce((sum, s) => sum + parseFloat(s.feeApr || '0'), 0) / valid.length * 100).toFixed(2);
  };

  return {
    currentFeeApr: current?.feeApr ? (parseFloat(current.feeApr) * 100).toFixed(2) : null,
    weeklyApy: avgApy(weeklySnapshots),
    monthlyApy: avgApy(monthlySnapshots),
    inceptionApy: avgApy(snapshots),
    weeklyFeeApr: avgApr(weeklySnapshots),
    snapshotCount: snapshots.length,
  };
}

export function useAnalyticsData(days: number = 30): UseAnalyticsDataResult {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'cache' | 'graphql' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try cached API first
      const apiUrl = `/api/analytics?days=${days}`;
      
      try {
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.data) {
            setData(result.data);
            setSource('cache');
            setLoading(false);
            return;
          }
        }
      } catch (apiError) {
        console.log('[useAnalyticsData] Cache API unavailable, falling back to GraphQL');
      }

      // Fallback to direct GraphQL
      console.log('[useAnalyticsData] Fetching from GraphQL directly...');
      
      const [usd1Snapshots, wethSnapshots] = await Promise.all([
        fetchFromGraphQLDirect(CONTRACTS.CHARM_VAULT),
        fetchFromGraphQLDirect('0x3314e248f3f752cd16939773d83beb3a362f0aef'),
      ]);

      const analyticsData: AnalyticsData = {
        vaults: {
          USD1_WLFI: {
            address: CONTRACTS.CHARM_VAULT,
            metrics: calculateMetricsFromSnapshots(usd1Snapshots),
            historicalSnapshots: usd1Snapshots.map((s: any) => ({
              timestamp: parseInt(s.timestamp),
              feeApr: s.feeApr ? (parseFloat(s.feeApr) * 100).toFixed(2) : null,
              annualVsHold: s.annualVsHoldPerfSince ? (parseFloat(s.annualVsHoldPerfSince) * 100).toFixed(2) : null,
            })),
          },
          WETH_WLFI: {
            address: '0x3314e248f3f752cd16939773d83beb3a362f0aef',
            metrics: calculateMetricsFromSnapshots(wethSnapshots),
            historicalSnapshots: wethSnapshots.map((s: any) => ({
              timestamp: parseInt(s.timestamp),
              feeApr: s.feeApr ? (parseFloat(s.feeApr) * 100).toFixed(2) : null,
              annualVsHold: s.annualVsHoldPerfSince ? (parseFloat(s.annualVsHoldPerfSince) * 100).toFixed(2) : null,
            })),
          },
        },
        syncStatus: {},
        meta: {
          daysRequested: days,
          totalSnapshots: usd1Snapshots.length + wethSnapshots.length,
          generatedAt: new Date().toISOString(),
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

// Combined APY from both vaults (weighted by TVL or simple average)
export function useCombinedApy(): {
  combinedApy: string | null;
  loading: boolean;
} {
  const { data, loading } = useAnalyticsData(7);

  if (loading || !data) {
    return { combinedApy: null, loading };
  }

  const usd1Apy = data.vaults.USD1_WLFI.metrics?.weeklyApy;
  const wethApy = data.vaults.WETH_WLFI.metrics?.weeklyApy;

  if (!usd1Apy && !wethApy) {
    return { combinedApy: null, loading: false };
  }

  // Simple average (could be weighted by TVL)
  const apys = [usd1Apy, wethApy].filter(Boolean).map(Number);
  const avgApy = apys.reduce((a, b) => a + b, 0) / apys.length;

  return {
    combinedApy: avgApy.toFixed(2),
    loading: false,
  };
}


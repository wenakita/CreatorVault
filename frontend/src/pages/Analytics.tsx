import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowserProvider } from 'ethers';
import { CONTRACTS } from '../config/contracts';
import { NeoButton, NeoCard, NeoStatCard } from '../components/neumorphic';
import { ICONS } from '../config/icons';
import { useAnalyticsData } from '../hooks/useAnalyticsData';

interface Props {
  provider: BrowserProvider | null;
  account: string;
  onNavigateUp?: () => void;
}

export default function Analytics({ provider, account, onNavigateUp }: Props) {
  const [selectedVault, setSelectedVault] = useState<'USD1_WLFI' | 'WETH_WLFI' | 'combined'>('combined');
  const { data, loading, error, refetch, source } = useAnalyticsData(90);

  // Get metrics based on selected vault
  const getDisplayMetrics = () => {
    if (!data) return null;

    if (selectedVault === 'combined') {
      const usd1 = data.vaults.USD1_WLFI.metrics;
      const weth = data.vaults.WETH_WLFI.metrics;

      return {
        tvlToken0: `${usd1?.tvlToken0 || '0'} + ${weth?.tvlToken0 || '0'}`,
        tvlToken1: `${usd1?.tvlToken1 || '0'} + ${weth?.tvlToken1 || '0'}`,
        totalSupply: 'Combined',
        snapshotCount: (usd1?.snapshotCount || 0) + (weth?.snapshotCount || 0),
        firstSnapshotDate: usd1?.firstSnapshotDate || weth?.firstSnapshotDate,
        lastSnapshotDate: usd1?.lastSnapshotDate || weth?.lastSnapshotDate,
      };
    }

    return data.vaults[selectedVault]?.metrics || null;
  };

  const metrics = getDisplayMetrics();

  // Get historical data for chart
  const getHistoricalData = () => {
    if (!data) return [];

    if (selectedVault === 'combined') {
      const usd1 = data.vaults.USD1_WLFI.historicalSnapshots || [];
      return usd1; // Use USD1 as primary for combined view
    }

    return data.vaults[selectedVault]?.historicalSnapshots || [];
  };

  const historicalData = getHistoricalData();

  // Get vault info
  const getVaultInfo = () => {
    if (!data || selectedVault === 'combined') {
      return { token0: 'Token0', token1: 'Token1', name: 'Combined Vaults' };
    }
    const vault = data.vaults[selectedVault];
    return {
      token0: vault.token0Symbol,
      token1: vault.token1Symbol,
      name: vault.name,
    };
  };

  const vaultInfo = getVaultInfo();

  return (
    <div className="bg-neo-bg min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        {/* Back Button */}
        {onNavigateUp ? (
          <NeoButton 
            onClick={onNavigateUp}
            label="Back to Home"
            icon={
              <svg className="w-4 h-4 -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            }
            className="mb-6 !text-gray-700"
          />
        ) : (
          <Link 
            to="/app"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors text-sm inline-flex"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to home
          </Link>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <img 
            src={ICONS.EAGLE}
            alt="Analytics"
            className="w-16 h-16 rounded-2xl"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Vault Analytics</h1>
            <p className="text-sm text-gray-600">
              TVL and vault activity data
              {source && (
                <span className="ml-2 text-xs text-gray-400">
                  (via {source === 'cache' ? 'cached data' : 'live GraphQL'})
                </span>
              )}
            </p>
          </div>
          <NeoButton
            onClick={refetch}
            disabled={loading}
            label=""
            icon={
              <svg 
                className={`w-4 h-4 text-gray-700 ${loading ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
            className="!px-3 !py-2 !w-auto !rounded-full"
          />
        </div>

        {/* Vault Selector */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'combined', label: 'Combined' },
            { key: 'USD1_WLFI', label: 'USD1/WLFI' },
            { key: 'WETH_WLFI', label: 'WETH/WLFI' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedVault(key as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedVault === key
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-white/50 text-gray-700 hover:bg-white/80 shadow-neo'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* TVL Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <NeoStatCard
            label={selectedVault === 'combined' ? 'USD1 TVL' : `${vaultInfo.token0} TVL`}
            value={metrics?.tvlToken0 || (loading ? '...' : 'N/A')}
            subtitle="Token 0 balance"
          />
          <NeoStatCard
            label={selectedVault === 'combined' ? 'WLFI TVL' : `${vaultInfo.token1} TVL`}
            value={metrics?.tvlToken1 || (loading ? '...' : 'N/A')}
            subtitle="Token 1 balance"
          />
          <NeoStatCard
            label="Vault Shares"
            value={metrics?.totalSupply || (loading ? '...' : 'N/A')}
            subtitle="Total supply"
          />
          <NeoStatCard
            label="Snapshots"
            value={metrics?.snapshotCount?.toString() || (loading ? '...' : '0')}
            highlighted
            subtitle="Data points"
          />
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-amber-800 font-semibold text-sm">APY Calculation Note</p>
              <p className="text-amber-700 text-xs mt-1">
                Accurate APY calculation requires USD price feeds for both tokens. The TVL shown above is in raw token amounts. 
                For real-time APY, visit the Charm Finance vaults directly.
              </p>
            </div>
          </div>
        </div>

        {/* TVL Chart */}
        <NeoCard className="mb-8">
          <div className="p-6">
            <h3 className="text-gray-900 font-bold text-xl mb-4">TVL Over Time</h3>
            <div className="bg-white/30 border border-gray-300 rounded-xl p-6 h-64">
              {historicalData.length > 0 ? (
                <div className="h-full flex flex-col">
                  <svg className="w-full flex-1" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="tvl-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#eab308" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Calculate max TVL for scaling */}
                    {(() => {
                      const maxTvl = Math.max(...historicalData.map(s => s.tvlToken0 + s.tvlToken1));
                      const minTvl = Math.min(...historicalData.map(s => s.tvlToken0 + s.tvlToken1));
                      const range = maxTvl - minTvl || 1;
                      
                      return (
                        <>
                          {/* Area under curve */}
                          <polygon
                            points={`0,30 ${historicalData.map((snap, i) => {
                              const x = (i / Math.max(historicalData.length - 1, 1)) * 100;
                              const tvl = snap.tvlToken0 + snap.tvlToken1;
                              const y = 30 - ((tvl - minTvl) / range) * 25;
                              return `${x},${y}`;
                            }).join(' ')} 100,30`}
                            fill="url(#area-gradient)"
                          />
                          
                          {/* Line */}
                          <polyline
                            points={historicalData.map((snap, i) => {
                              const x = (i / Math.max(historicalData.length - 1, 1)) * 100;
                              const tvl = snap.tvlToken0 + snap.tvlToken1;
                              const y = 30 - ((tvl - minTvl) / range) * 25;
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="url(#tvl-gradient)"
                            strokeWidth="0.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      );
                    })()}
                  </svg>
                  
                  {/* X-axis labels */}
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{historicalData[0]?.date}</span>
                    <span>{historicalData[historicalData.length - 1]?.date}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600">
                    {loading ? 'Loading TVL data...' : 'No data available yet'}
                  </p>
                </div>
              )}
            </div>
            {historicalData.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {historicalData.length} snapshots • {metrics?.firstSnapshotDate} to {metrics?.lastSnapshotDate}
              </p>
            )}
          </div>
        </NeoCard>

        {/* Fee Breakdown */}
        <NeoCard>
          <div className="p-6">
            <h3 className="text-gray-900 font-bold text-xl mb-6">Fee Structure</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-gray-700 font-semibold mb-4">Eagle Vault Fees</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-b border-gray-300">
                    <div>
                      <span className="text-gray-900 font-semibold block mb-1">Deposit Fee</span>
                      <p className="text-xs text-gray-600">One-time fee on deposits</p>
                    </div>
                    <span className="text-gray-900 font-bold text-lg">1%</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-gray-300">
                    <div>
                      <span className="text-gray-900 font-semibold block mb-1">Withdrawal Fee</span>
                      <p className="text-xs text-gray-600">One-time fee on withdrawals</p>
                    </div>
                    <span className="text-gray-900 font-bold text-lg">2%</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b-2 border-amber-400 bg-amber-50/50 -mx-2 px-2 rounded">
                    <div>
                      <span className="text-gray-900 font-semibold block mb-1">Performance Fee</span>
                      <p className="text-xs text-gray-600 mb-2">Charged on profits only</p>
                      <p className="text-xs text-gray-700">
                        • 3.7% to Eagle Vault<br />
                        • 1% to Charm Finance
                      </p>
                    </div>
                    <span className="text-amber-700 font-bold text-lg">4.7%</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-gray-700 font-semibold mb-4">Active Strategies</h4>
                <div className="space-y-3">
                  <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">Strategy 1 (50%)</div>
                    <p className="text-gray-900 font-bold">USD1/WLFI Alpha Vault</p>
                    <p className="text-xs text-gray-600 mt-1">Uniswap V3 • 1% Fee Tier</p>
                    {data?.vaults.USD1_WLFI.metrics && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        TVL: {data.vaults.USD1_WLFI.metrics.tvlToken0} USD1 + {data.vaults.USD1_WLFI.metrics.tvlToken1} WLFI
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">Strategy 2 (50%)</div>
                    <p className="text-gray-900 font-bold">WETH/WLFI Alpha Vault</p>
                    <p className="text-xs text-gray-600 mt-1">Uniswap V3 • 1% Fee Tier</p>
                    {data?.vaults.WETH_WLFI.metrics && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        TVL: {data.vaults.WETH_WLFI.metrics.tvlToken0} WETH + {data.vaults.WETH_WLFI.metrics.tvlToken1} WLFI
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">Rebalancing</div>
                    <p className="text-gray-900 font-bold">Automatic</p>
                    <p className="text-xs text-gray-600 mt-1">Matches Charm's ratio before deposit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Source */}
            <div className="mt-6 pt-6 border-t border-gray-300">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Data Source:</span> Charm Finance Subgraph
                {data?.meta?.totalSnapshots && (
                  <span className="ml-2">• {data.meta.totalSnapshots} total snapshots</span>
                )}
              </p>
              <div className="flex gap-4 mt-2">
                <a 
                  href={`https://alpha.charm.fi/vault/${CONTRACTS.CHARM_VAULT}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                >
                  USD1/WLFI Vault on Charm
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a 
                  href="https://alpha.charm.fi/vault/0x3314e248f3f752cd16939773d83beb3a362f0aef"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                >
                  WETH/WLFI Vault on Charm
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </NeoCard>

        {/* Contract Addresses */}
        <NeoCard className="mt-8">
          <div className="p-6">
            <h3 className="text-gray-900 font-bold text-xl mb-6">Contract Addresses</h3>
            
            <div className="space-y-4">
              {/* USD1/WLFI Pool */}
              <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">
                  USD1/WLFI Charm Vault
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-gray-900 font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg flex-1 break-all">
                    {CONTRACTS.CHARM_VAULT}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(CONTRACTS.CHARM_VAULT)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <a
                    href={`https://etherscan.io/address/${CONTRACTS.CHARM_VAULT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="View on Etherscan"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* WETH/WLFI Vault */}
              <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">
                  WETH/WLFI Charm Vault
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-gray-900 font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg flex-1 break-all">
                    0x3314e248F3F752Cd16939773D83bEb3a362F0AEF
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText('0x3314e248F3F752Cd16939773D83bEb3a362F0AEF')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <a
                    href="https://etherscan.io/address/0x3314e248F3F752Cd16939773D83bEb3a362F0AEF"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="View on Etherscan"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Eagle Vault */}
              <div className="bg-white/50 shadow-neo-inset rounded-xl p-4">
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 font-semibold">
                  Eagle OVault Contract
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-gray-900 font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg flex-1 break-all">
                    0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText('0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <a
                    href="https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    title="View on Etherscan"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </NeoCard>
      </div>
    </div>
  );
}

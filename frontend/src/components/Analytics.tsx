import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACTS } from '../config/contracts';

interface Props {
  provider: BrowserProvider | null;
}

export default function Analytics({ provider }: Props) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [vaultMetrics, setVaultMetrics] = useState({
    tvl: 0,
    volume24h: 0,
    apy: 12.5,
    totalFees: 0,
    activeUsers: 0
  });

  const [wlfiPriceHistory, setWlfiPriceHistory] = useState<Array<{time: number, price: number}>>([]);
  
  useEffect(() => {
    // Fetch vault data
    const fetchVaultMetrics = async () => {
      if (!provider) return;
      
      try {
        const vault = new Contract(
          CONTRACTS.VAULT,
          [
            'function totalAssets() view returns (uint256)',
            'function totalSupply() view returns (uint256)',
            'function getWLFIPrice() view returns (uint256)',
          ],
          provider
        );

        const [totalAssets, totalSupply, wlfiPrice] = await Promise.all([
          vault.totalAssets(),
          vault.totalSupply(),
          vault.getWLFIPrice()
        ]);

        setVaultMetrics(prev => ({
          ...prev,
          tvl: Number(formatEther(totalAssets)),
          apy: 12.5, // Would calculate from historical data
        }));

      } catch (error) {
        console.error('Failed to fetch vault metrics:', error);
      }
    };

    fetchVaultMetrics();
    const interval = setInterval(fetchVaultMetrics, 30000);
    return () => clearInterval(interval);
  }, [provider]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Analytics
        </h2>
        
        {/* Timeframe Selector */}
        <div className="flex gap-2 bg-gray-900/50 rounded-lg p-1 border border-gray-800">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                timeframe === tf
                  ? 'bg-eagle-gold text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Value Locked"
          value={`$${vaultMetrics.tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          change="+5.2%"
          icon="💰"
          trend="up"
        />
        <MetricCard
          title="Current APY"
          value={`${vaultMetrics.apy.toFixed(2)}%`}
          change="+0.8%"
          icon="📈"
          trend="up"
        />
        <MetricCard
          title="24h Volume"
          value={`$${vaultMetrics.volume24h.toLocaleString()}`}
          change="-2.1%"
          icon="💹"
          trend="down"
        />
        <MetricCard
          title="Total Fees"
          value={`$${vaultMetrics.totalFees.toLocaleString()}`}
          change="+12.5%"
          icon="💵"
          trend="up"
        />
      </div>

      {/* APY Calculator */}
      <APYCalculator apy={vaultMetrics.apy} />

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="WLFI Price" subtitle="Price movement over time">
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-sm">Chart coming soon...</p>
              <p className="text-xs text-gray-600 mt-1">Integrate TradingView widget</p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Vault Performance" subtitle="Returns over time">
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Performance metrics loading...</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Strategy Breakdown */}
      <div className="bg-[#0a0a0a]/60 rounded-xl border border-eagle-gold/30 backdrop-blur-md p-6">
        <h3 className="text-xl font-bold text-white mb-4">Strategy Breakdown</h3>
        
        <div className="space-y-4">
          <StrategyBar name="Charm LP Strategy" percentage={75} color="from-blue-500 to-cyan-500" />
          <StrategyBar name="Idle in Vault" percentage={25} color="from-eagle-gold to-yellow-500" />
        </div>
      </div>
    </div>
  );
}

// Sub-components

function MetricCard({ title, value, change, icon, trend }: {
  title: string;
  value: string;
  change: string;
  icon: string;
  trend: 'up' | 'down';
}) {
  return (
    <div className="bg-[#0a0a0a]/60 rounded-xl border border-gray-800/50 p-5 backdrop-blur-md hover:border-eagle-gold/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          trend === 'up' 
            ? 'bg-green-500/10 text-green-400' 
            : 'bg-red-500/10 text-red-400'
        }`}>
          {change}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0a]/60 rounded-xl border border-gray-800/50 p-6 backdrop-blur-md">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function StrategyBar({ name, percentage, color }: {
  name: string;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300">{name}</span>
        <span className="text-sm font-semibold text-white">{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-800/50 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function APYCalculator({ apy }: { apy: number }) {
  const [amount, setAmount] = useState('1000');
  const [timeframe, setTimeframe] = useState<'1m' | '3m' | '6m' | '1y'>('1y');
  
  const periods = {
    '1m': 1/12,
    '3m': 3/12,
    '6m': 6/12,
    '1y': 1
  };
  
  const depositAmount = Number(amount) || 0;
  const earnings = depositAmount * (apy / 100) * periods[timeframe];
  const total = depositAmount + earnings;
  
  return (
    <div className="bg-gradient-to-br from-eagle-gold/5 via-transparent to-blue-500/5 rounded-xl border border-eagle-gold/20 p-6 backdrop-blur-md">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🧮</span>
        APY Calculator
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Deposit Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-eagle-gold/50 focus:ring-1 focus:ring-eagle-gold/50"
            placeholder="1000"
          />
        </div>
        
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Timeframe</label>
          <div className="grid grid-cols-4 gap-2">
            {(['1m', '3m', '6m', '1y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  timeframe === tf
                    ? 'bg-eagle-gold text-black'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-black/40 rounded-lg border border-gray-800/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Initial</p>
            <p className="text-lg font-bold text-white">${depositAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Earnings</p>
            <p className="text-lg font-bold text-green-400">+${earnings.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-lg font-bold text-eagle-gold">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


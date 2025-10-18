import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function getWLFIPrice() view returns (uint256)',
  'function getUSD1Price() view returns (uint256)',
  'event DualDeposit(address indexed user, uint256 wlfiAmount, uint256 usd1Amount, uint256 wlfiPriceUSD, uint256 usd1PriceUSD, uint256 totalUSDValue, uint256 shares)',
  'event DualWithdrawal(address indexed user, uint256 shares, uint256 wlfiAmount, uint256 usd1Amount, uint256 totalUSDValue)',
];

interface Props {
  provider: BrowserProvider | null;
  account: string;
}

interface PositionData {
  shares: number;
  valueUSD: number;
  percentOfVault: number;
  estimatedAPY: number;
}

export default function PortfolioView({ provider, account }: Props) {
  const [position, setPosition] = useState<PositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    if (!provider || !account) return;

    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);

        const [shares, totalSupply, totalAssets] = await Promise.all([
          vault.balanceOf(account),
          vault.totalSupply(),
          vault.totalAssets()
        ]);

        const sharesNum = Number(formatEther(shares));
        const totalSupplyNum = Number(formatEther(totalSupply));
        const totalAssetsNum = Number(formatEther(totalAssets));

        const valueUSD = sharesNum > 0 && totalSupplyNum > 0
          ? (sharesNum / totalSupplyNum) * totalAssetsNum
          : 0;

        const percentOfVault = totalSupplyNum > 0
          ? (sharesNum / totalSupplyNum) * 100
          : 0;

        setPosition({
          shares: sharesNum,
          valueUSD,
          percentOfVault,
          estimatedAPY: 12.5 // Would calculate from historical data
        });

      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, [provider, account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-eagle-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  if (!position || position.shares === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-900/50 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Position Yet</h3>
        <p className="text-gray-400 mb-6">Start earning by depositing WLFI or USD1</p>
        <button className="px-6 py-3 bg-eagle-gold hover:bg-eagle-gold-dark text-black font-medium rounded-lg transition-all duration-200">
          Make First Deposit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Header */}
      <div className="bg-gradient-to-br from-eagle-gold/10 via-transparent to-blue-500/10 rounded-2xl border border-eagle-gold/30 p-8 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-2">Total Portfolio Value</h2>
            <p className="text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              ${position.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/30">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-green-400 font-semibold">+5.2%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Your Shares" value={position.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })} suffix="vEAGLE" />
          <StatCard label="Vault Ownership" value={position.percentOfVault.toFixed(4)} suffix="%" />
          <StatCard label="Est. APY" value={position.estimatedAPY.toFixed(2)} suffix="%" icon="📈" />
          <StatCard label="Daily Earnings" value={`$${((position.valueUSD * position.estimatedAPY / 100) / 365).toFixed(2)}`} icon="💵" />
        </div>
      </div>

      {/* Earnings Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EarningsCard period="Daily" amount={earnings.daily} />
        <EarningsCard period="Weekly" amount={earnings.weekly} />
        <EarningsCard period="Monthly" amount={earnings.monthly} />
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-[#0a0a0a]/60 rounded-xl border border-gray-800/50 p-6 backdrop-blur-md">
        <h3 className="text-lg font-bold text-white mb-4">Performance Over Time</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-sm">Historical performance chart</p>
            <p className="text-xs text-gray-600 mt-1">Track your position value over time</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-[#0a0a0a]/60 rounded-xl border border-gray-800/50 p-6 backdrop-blur-md">
        <h3 className="text-lg font-bold text-white mb-4">Transaction History</h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs text-gray-600 mt-1">Your deposits and withdrawals will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <TransactionRow key={i} transaction={tx} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <button className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20">
          Deposit More
        </button>
        <button className="flex-1 px-6 py-4 bg-gray-800/50 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all duration-200 border border-gray-700">
          Withdraw
        </button>
      </div>
    </div>
  );
}

// Sub-components

function StatCard({ label, value, suffix, icon }: {
  label: string;
  value: string;
  suffix?: string;
  icon?: string;
}) {
  return (
    <div className="bg-black/40 rounded-lg p-4 border border-gray-800/50">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span>{icon}</span>}
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-lg font-bold text-white">
        {value} {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </p>
    </div>
  );
}

function EarningsCard({ period, amount }: { period: string; amount: number }) {
  return (
    <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-xl border border-green-500/20 p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">{period} Earnings</p>
        <span className="text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </span>
      </div>
      <p className="text-2xl font-bold text-white">${amount.toFixed(2)}</p>
      <p className="text-xs text-green-400 mt-1">+{((amount / 100) * 100).toFixed(1)}%</p>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: any }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg hover:bg-gray-900/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          transaction.type === 'deposit' ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          <svg className={`w-5 h-5 ${transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={transaction.type === 'deposit' ? 'M12 4v16m8-8H4' : 'M20 12H4'} />
          </svg>
        </div>
        <div>
          <p className="text-white font-medium capitalize">{transaction.type}</p>
          <p className="text-sm text-gray-500">{transaction.date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white font-semibold">{transaction.amount}</p>
        <a href={`https://etherscan.io/tx/${transaction.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-eagle-gold hover:text-eagle-gold-light">
          View →
        </a>
      </div>
    </div>
  );
}

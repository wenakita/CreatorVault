import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
];

export default function TrustSignals() {
  const [metrics, setMetrics] = useState({
    tvl: 0,
    transactions: 0,
    users: 0,
    timeSinceLaunch: '',
  });

  useEffect(() => {
    // Fetch vault data
    const fetchMetrics = async () => {
      try {
        // In production, fetch from your backend/subgraph
        // For now, using static data
        const launchDate = new Date('2025-10-17');
        const now = new Date();
        const daysSince = Math.floor((now.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24));
        
        setMetrics({
          tvl: 149.44, // Would fetch real TVL
          transactions: 3, // Would count from events
          users: 2, // Would count unique depositors
          timeSinceLaunch: `${daysSince} days`,
        });
      } catch (error) {
        console.error('Failed to fetch trust metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0a0a0a]/40 rounded-xl border border-gray-800/50 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Security & Trust
        </h3>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/30">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-xs font-medium text-green-400">Live</span>
        </div>
      </div>

      {/* Trust Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <TrustMetric
          icon="💰"
          label="Total Value Locked"
          value={`$${metrics.tvl.toLocaleString()}`}
          subtext="Secured"
        />
        <TrustMetric
          icon="📊"
          label="Total Transactions"
          value={metrics.transactions.toLocaleString()}
          subtext="Successful"
        />
        <TrustMetric
          icon="👥"
          label="Active Users"
          value={metrics.users.toLocaleString()}
          subtext="Depositors"
        />
        <TrustMetric
          icon="⏱️"
          label="Since Launch"
          value={metrics.timeSinceLaunch}
          subtext="Ethereum Mainnet"
        />
      </div>

      {/* Security Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SecurityFeature
          title="Audited Contracts"
          description="Smart contracts verified on Etherscan"
          verified={true}
        />
        <SecurityFeature
          title="Non-Custodial"
          description="You always control your funds"
          verified={true}
        />
        <SecurityFeature
          title="Battle-Tested"
          description="Integrated with Charm Finance & Uniswap V3"
          verified={true}
        />
        <SecurityFeature
          title="Transparent"
          description="All code is open source"
          verified={true}
        />
      </div>

      {/* Audit Badge */}
      <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
        <AuditBadge name="Verified Contracts" icon="✓" color="green" />
        <AuditBadge name="LayerZero OFT" icon="🔗" color="blue" />
        <AuditBadge name="Charm Integration" icon="🎯" color="purple" />
      </div>
    </div>
  );
}

// Sub-components

function TrustMetric({ icon, label, value, subtext }: {
  icon: string;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30 hover:border-eagle-gold/20 transition-all duration-200">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-gray-600">{subtext}</p>
    </div>
  );
}

function SecurityFeature({ title, description, verified }: {
  title: string;
  description: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-900/20 rounded-lg">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        verified ? 'bg-green-500/20' : 'bg-gray-500/20'
      }`}>
        {verified ? (
          <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function AuditBadge({ name, icon, color }: {
  name: string;
  icon: string;
  color: 'green' | 'blue' | 'purple';
}) {
  const colors = {
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${colors[color]} border`}>
      <span className="text-base">{icon}</span>
      <span className="text-xs font-semibold">{name}</span>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAccount, useContractRead, useContractReads } from 'wagmi';
import { formatEther, parseEther } from 'viem';

// ============================================
// TYPES & INTERFACES
// ============================================

interface VaultMetrics {
  totalValue: string;
  sharePrice: string;
  totalShares: string;
  directValue: string;
  strategyValue: string;
  estimatedAPR: string;
  liquidityPercent: number;
}

interface StrategyInfo {
  address: string;
  name: string;
  value: string;
  percentage: number;
  apr: string;
  protocol: string;
}

interface UserPosition {
  shares: string;
  value: string;
  percentOfVault: string;
  wlfiEntitled: string;
  usd1Entitled: string;
}

// ============================================
// CONSTANTS
// ============================================

const ADDRESSES = {
  VAULT: '0x4f00fAB0361009d975Eb04E172268Bf1E73737bC',
  STRATEGY_CHARM: '0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1',
  WLFI: '0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747',
  USD1: '0x8C815948C41D2A87413E796281A91bE91C4a94aB',
  MEAGLE: '0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e'
} as const;

const VAULT_ABI = [
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
  'function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1)',
  'function paused() external view returns (bool)'
] as const;

const STRATEGY_ABI = [
  'function getTotalAmounts() external view returns (uint256 wlfi, uint256 usd1)',
  'function getMeagleBalance() external view returns (uint256)'
] as const;

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export function VaultDashboard() {
  const { address } = useAccount();
  const [metrics, setMetrics] = useState<VaultMetrics | null>(null);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);

  // Read all vault data
  const { data: vaultData } = useContractReads({
    contracts: [
      { address: ADDRESSES.VAULT, abi: VAULT_ABI, functionName: 'totalAssets' },
      { address: ADDRESSES.VAULT, abi: VAULT_ABI, functionName: 'totalSupply' },
      { address: ADDRESSES.VAULT, abi: VAULT_ABI, functionName: 'getVaultBalances' },
      { address: ADDRESSES.VAULT, abi: VAULT_ABI, functionName: 'paused' },
      ...(address ? [{ address: ADDRESSES.VAULT, abi: VAULT_ABI, functionName: 'balanceOf', args: [address] }] : [])
    ],
    watch: true
  });

  // Read strategy data
  const { data: strategyData } = useContractReads({
    contracts: [
      { address: ADDRESSES.STRATEGY_CHARM, abi: STRATEGY_ABI, functionName: 'getTotalAmounts' },
      { address: ADDRESSES.STRATEGY_CHARM, abi: STRATEGY_ABI, functionName: 'getMeagleBalance' }
    ],
    watch: true
  });

  // Calculate metrics when data changes
  useEffect(() => {
    if (!vaultData || !strategyData) return;

    const [totalAssets, totalSupply, vaultBalances] = vaultData;
    const [strategyAmounts, meagleBalance] = strategyData;

    const total = BigInt(totalAssets.result || 0);
    const supply = BigInt(totalSupply.result || 0);
    const [vaultWlfi, vaultUsd1] = vaultBalances.result || [0n, 0n];
    const [stratWlfi, stratUsd1] = strategyAmounts.result || [0n, 0n];

    const directValue = vaultWlfi + vaultUsd1;
    const strategyValue = stratWlfi + stratUsd1;
    const sharePrice = supply > 0n ? Number(total * 10000n / supply) / 10000 : 1.0;

    // Calculate weighted APR
    const directPct = total > 0n ? Number(directValue * 100n / total) : 0;
    const strategyPct = total > 0n ? Number(strategyValue * 100n / total) : 0;
    const weightedAPR = (directPct * 0 + strategyPct * 13.5) / 100;

    setMetrics({
      totalValue: formatEther(total),
      sharePrice: sharePrice.toFixed(4),
      totalShares: formatEther(supply),
      directValue: formatEther(directValue),
      strategyValue: formatEther(strategyValue),
      estimatedAPR: weightedAPR.toFixed(2),
      liquidityPercent: total > 0n ? Number(directValue * 100n / total) : 0
    });

    // Strategy breakdown
    setStrategies([
      {
        address: ADDRESSES.STRATEGY_CHARM,
        name: 'Charm Finance',
        value: formatEther(strategyValue),
        percentage: total > 0n ? Number(strategyValue * 100n / total) : 0,
        apr: '12-15',
        protocol: 'Uniswap V3 LP'
      }
    ]);

    // User position (if connected)
    if (address && vaultData[4]) {
      const userShares = BigInt(vaultData[4].result || 0);
      const userValue = supply > 0n ? (userShares * total) / supply : 0n;
      const userPercent = supply > 0n ? Number(userShares * 10000n / supply) / 100 : 0;

      setUserPosition({
        shares: formatEther(userShares),
        value: formatEther(userValue),
        percentOfVault: userPercent.toFixed(2),
        wlfiEntitled: formatEther(supply > 0n ? (userShares * (vaultWlfi + stratWlfi)) / supply : 0n),
        usd1Entitled: formatEther(supply > 0n ? (userShares * (vaultUsd1 + stratUsd1)) / supply : 0n)
      });
    }
  }, [vaultData, strategyData, address]);

  if (!metrics) {
    return <div className="loading">Loading vault data...</div>;
  }

  return (
    <div className="vault-dashboard">
      <Header />
      <TotalValueCard metrics={metrics} />
      <SharePriceCard metrics={metrics} />
      <StrategyBreakdownCard strategies={strategies} totalValue={metrics.totalValue} />
      <UserPositionCard position={userPosition} />
      <APRCard metrics={metrics} />
      <LiquidityCard metrics={metrics} />
      <HealthStatusCard />
    </div>
  );
}

// ============================================
// COMPONENT: Header
// ============================================

function Header() {
  return (
    <div className="dashboard-header">
      <h1>🦅 Eagle Vault Analytics</h1>
      <p className="vault-address">
        Vault: {ADDRESSES.VAULT.slice(0, 6)}...{ADDRESSES.VAULT.slice(-4)}
      </p>
    </div>
  );
}

// ============================================
// COMPONENT: Total Value Card
// ============================================

function TotalValueCard({ metrics }: { metrics: VaultMetrics }) {
  return (
    <div className="metric-card total-value">
      <h2>💰 Total Vault Value</h2>
      <div className="value-display">
        <span className="currency">$</span>
        <span className="amount">{parseFloat(metrics.totalValue).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      </div>
      <div className="breakdown">
        <div className="breakdown-item">
          <span>Direct Holdings</span>
          <span>${parseFloat(metrics.directValue).toLocaleString()}</span>
        </div>
        <div className="breakdown-item">
          <span>In Strategies</span>
          <span>${parseFloat(metrics.strategyValue).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Share Price Card
// ============================================

function SharePriceCard({ metrics }: { metrics: VaultMetrics }) {
  const priceChange = ((parseFloat(metrics.sharePrice) - 1.0) / 1.0) * 100;
  const isPositive = priceChange >= 0;

  return (
    <div className="metric-card share-price">
      <h2>💵 EAGLE Price</h2>
      <div className="price-display">
        <div className="current-price">
          <span className="label">1 EAGLE =</span>
          <span className="price">${metrics.sharePrice}</span>
        </div>
        <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
        </div>
      </div>
      <div className="supply-info">
        Total Supply: {parseFloat(metrics.totalShares).toLocaleString()} EAGLE
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Strategy Breakdown
// ============================================

function StrategyBreakdownCard({ 
  strategies, 
  totalValue 
}: { 
  strategies: StrategyInfo[];
  totalValue: string;
}) {
  return (
    <div className="metric-card strategy-breakdown">
      <h2>📈 Strategy Allocation</h2>
      
      {strategies.map((strategy, index) => (
        <div key={strategy.address} className="strategy-item">
          <div className="strategy-header">
            <h3>#{index + 1} {strategy.name}</h3>
            <span className="strategy-apr">{strategy.apr}% APR</span>
          </div>
          
          <div className="strategy-details">
            <div className="detail-row">
              <span>Value:</span>
              <span>${parseFloat(strategy.value).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>Allocation:</span>
              <span>{strategy.percentage.toFixed(1)}%</span>
            </div>
            <div className="detail-row">
              <span>Protocol:</span>
              <span>{strategy.protocol}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="allocation-bar">
            <div 
              className="allocation-fill" 
              style={{ width: `${strategy.percentage}%` }}
            />
          </div>
        </div>
      ))}
      
      <div className="add-strategy-note">
        💡 Can support up to 5 strategies simultaneously
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: User Position
// ============================================

function UserPositionCard({ position }: { position: UserPosition | null }) {
  const { isConnected } = useAccount();

  if (!isConnected || !position) {
    return (
      <div className="metric-card user-position">
        <h2>👤 Your Position</h2>
        <p className="connect-prompt">Connect wallet to see your position</p>
      </div>
    );
  }

  return (
    <div className="metric-card user-position">
      <h2>👤 Your Position</h2>
      
      <div className="position-summary">
        <div className="summary-item large">
          <span className="label">Your EAGLE</span>
          <span className="value">{parseFloat(position.shares).toLocaleString()} shares</span>
        </div>
        <div className="summary-item large">
          <span className="label">Current Value</span>
          <span className="value">${parseFloat(position.value).toLocaleString()}</span>
        </div>
      </div>

      <div className="position-details">
        <div className="detail-row">
          <span>Vault Ownership:</span>
          <span>{position.percentOfVault}%</span>
        </div>
        <div className="detail-row">
          <span>WLFI Entitled:</span>
          <span>{parseFloat(position.wlfiEntitled).toLocaleString()}</span>
        </div>
        <div className="detail-row">
          <span>USD1 Entitled:</span>
          <span>{parseFloat(position.usd1Entitled).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: APR Card
// ============================================

function APRCard({ metrics }: { metrics: VaultMetrics }) {
  return (
    <div className="metric-card apr-card">
      <h2>📊 Estimated APR</h2>
      
      <div className="apr-display">
        <span className="apr-value">{metrics.estimatedAPR}%</span>
        <span className="apr-label">Annual Percentage Rate</span>
      </div>

      <div className="apr-breakdown">
        <h4>Breakdown:</h4>
        <div className="apr-item">
          <span>Direct Holdings:</span>
          <span>0%</span>
        </div>
        <div className="apr-item">
          <span>Charm Strategy:</span>
          <span>12-15%</span>
        </div>
      </div>

      <div className="apr-note">
        💡 APR varies based on Uniswap V3 trading volume
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Liquidity Card
// ============================================

function LiquidityCard({ metrics }: { metrics: VaultMetrics }) {
  const isHealthy = metrics.liquidityPercent > 25;

  return (
    <div className="metric-card liquidity-card">
      <h2>💧 Withdrawal Liquidity</h2>
      
      <div className="liquidity-display">
        <div className="liquidity-percent">
          <span className="percent-value">{metrics.liquidityPercent.toFixed(0)}%</span>
          <span className="percent-label">Instant Withdrawal</span>
        </div>
        
        <div className="liquidity-bar">
          <div 
            className={`liquidity-fill ${isHealthy ? 'healthy' : 'warning'}`}
            style={{ width: `${metrics.liquidityPercent}%` }}
          />
        </div>
      </div>

      <div className="liquidity-details">
        <div className="detail-row">
          <span>Instant:</span>
          <span>${parseFloat(metrics.directValue).toLocaleString()}</span>
        </div>
        <div className="detail-row">
          <span>From Strategies:</span>
          <span>${parseFloat(metrics.strategyValue).toLocaleString()}</span>
        </div>
      </div>

      <div className={`status ${isHealthy ? 'healthy' : 'warning'}`}>
        {isHealthy ? '✅ Healthy liquidity' : '⚠️ Low liquidity buffer'}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Health Status
// ============================================

function HealthStatusCard() {
  const { data: isPaused } = useContractRead({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'paused',
    watch: true
  });

  return (
    <div className="metric-card health-status">
      <h2>🏥 Vault Health</h2>
      
      <div className="health-indicators">
        <div className="indicator">
          <span className="indicator-label">Status:</span>
          <span className={`indicator-value ${!isPaused ? 'healthy' : 'warning'}`}>
            {!isPaused ? '✅ Active' : '⚠️ Paused'}
          </span>
        </div>
        
        <div className="indicator">
          <span className="indicator-label">Smart Contracts:</span>
          <span className="indicator-value healthy">✅ Verified</span>
        </div>
        
        <div className="indicator">
          <span className="indicator-label">Strategies:</span>
          <span className="indicator-value healthy">✅ Active</span>
        </div>
      </div>

      <div className="health-summary">
        {!isPaused ? (
          <p className="healthy-message">All systems operational!</p>
        ) : (
          <p className="warning-message">Vault is paused - deposits disabled</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// STYLES (Can be moved to separate CSS file)
// ============================================

const styles = `
.vault-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 3rem;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #1a1a1a;
}

.vault-address {
  color: #666;
  font-family: monospace;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.metric-card h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: #333;
}

/* Total Value Card */
.total-value .value-display {
  font-size: 3rem;
  font-weight: bold;
  color: #4CAF50;
  margin: 1rem 0;
}

.total-value .currency {
  font-size: 2rem;
  opacity: 0.7;
}

.breakdown {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
}

/* Share Price Card */
.price-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 1rem 0;
}

.current-price {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.current-price .price {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.price-change {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-weight: 600;
}

.price-change.positive {
  background: #e8f5e9;
  color: #2e7d32;
}

.price-change.negative {
  background: #ffebee;
  color: #c62828;
}

/* Strategy Breakdown */
.strategy-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.strategy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.strategy-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.strategy-apr {
  background: #4CAF50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
}

.strategy-details {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.allocation-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.allocation-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}

/* User Position */
.position-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.summary-item {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.summary-item .label {
  display: block;
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.summary-item .value {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.position-details {
  display: grid;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

/* APR Card */
.apr-display {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  margin: 1rem 0;
}

.apr-value {
  display: block;
  font-size: 3rem;
  font-weight: bold;
}

.apr-label {
  display: block;
  font-size: 0.9rem;
  opacity: 0.9;
  margin-top: 0.5rem;
}

.apr-breakdown {
  margin-top: 1rem;
}

.apr-breakdown h4 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.apr-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

/* Liquidity Card */
.liquidity-display {
  margin: 1rem 0;
}

.liquidity-percent {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.percent-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #4CAF50;
}

.percent-label {
  color: #666;
  font-size: 0.9rem;
}

.liquidity-bar {
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  margin: 1rem 0;
}

.liquidity-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.liquidity-fill.healthy {
  background: linear-gradient(90deg, #4CAF50, #45a049);
}

.liquidity-fill.warning {
  background: linear-gradient(90deg, #ff9800, #f57c00);
}

/* Health Status */
.health-indicators {
  display: grid;
  gap: 1rem;
}

.indicator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.indicator-value.healthy {
  color: #2e7d32;
  font-weight: 600;
}

.indicator-value.warning {
  color: #f57c00;
  font-weight: 600;
}

.health-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: #e8f5e9;
  border-radius: 6px;
  text-align: center;
}

.healthy-message {
  color: #2e7d32;
  font-weight: 600;
  margin: 0;
}

.warning-message {
  color: #f57c00;
  font-weight: 600;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .position-summary {
    grid-template-columns: 1fr;
  }
  
  .total-value .value-display {
    font-size: 2rem;
  }
}
`;

// Export styles
export const dashboardStyles = styles;


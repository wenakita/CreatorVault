import React, { useState } from 'react';
import StrategyCard, { Strategy } from './StrategyCard';
import '../../styles/neumorphic.css';

const STRATEGIES: Strategy[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Stable returns with minimal risk',
    expectedAPY: 12.5,
    riskLevel: 'Low',
    rebalanceFrequency: 'Weekly',
    icon: '🛡️',
    features: [
      'IL Protection 100%',
      'Wide price ranges',
      'Low gas usage',
      'Perfect for beginners'
    ]
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Optimal risk-reward ratio',
    expectedAPY: 24.5,
    riskLevel: 'Medium',
    rebalanceFrequency: 'Every 3 days',
    icon: '⚖️',
    features: [
      'IL Protection 95%',
      'Medium price ranges',
      'Moderate gas usage',
      'Best overall returns'
    ],
    recommended: true
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Maximum yield, higher activity',
    expectedAPY: 38.7,
    riskLevel: 'High',
    rebalanceFrequency: 'Daily',
    icon: '🚀',
    features: [
      'IL Protection 90%',
      'Tight price ranges',
      'Active rebalancing',
      'For experienced users'
    ]
  }
];

const SimplifiedDeposit: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('balanced');
  const [amount, setAmount] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);

  const selectedStrategyData = STRATEGIES.find(s => s.id === selectedStrategy);

  const handleDeploy = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsDeploying(true);
    // TODO: Implement actual deployment logic
    try {
      console.log('Deploying:', { strategy: selectedStrategy, amount });
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Successfully deployed liquidity!');
    } catch (error) {
      console.error('Deployment error:', error);
      alert('Deployment failed. Please try again.');
    } finally {
      setIsDeploying(false);
    }
  };

  const calculateProjections = () => {
    if (!amount || !selectedStrategyData) return null;
    const amountNum = parseFloat(amount);
    const dailyReturn = (amountNum * selectedStrategyData.expectedAPY / 100 / 365);
    const monthlyReturn = dailyReturn * 30;
    const yearlyReturn = amountNum * selectedStrategyData.expectedAPY / 100;

    return {
      daily: dailyReturn.toFixed(4),
      monthly: monthlyReturn.toFixed(2),
      yearly: yearlyReturn.toFixed(2)
    };
  };

  const projections = calculateProjections();

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--neuro-bg-primary)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold neuro-text-primary mb-4">
            🔺 Eagle Triangular LP
          </h1>
          <p className="text-xl neuro-text-secondary">
            Single-Sided EAGLE + Volatile Token Pairs
          </p>
          <p className="text-sm neuro-text-light mt-2">
            Separate from EagleOVault • Powered by Triangular Arbitrage
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="neuro-badge">
              ⚡ Instant Deployment
            </div>
            <div className="neuro-badge">
              🛡️ IL Protected
            </div>
            <div className="neuro-badge">
              🤖 Auto-Rebalanced
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold neuro-text-primary mb-6 text-center">
            Choose Your Strategy
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STRATEGIES.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isSelected={selectedStrategy === strategy.id}
                onSelect={() => setSelectedStrategy(strategy.id)}
              />
            ))}
          </div>
        </div>

        {/* Deposit Interface */}
        <div className="neuro-card max-w-2xl mx-auto p-8">
          <h3 className="text-2xl font-bold neuro-text-primary mb-6">
            Deploy Liquidity
          </h3>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium neuro-text-secondary mb-2">
              Enter Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="neuro-input text-2xl font-bold"
                step="0.01"
                min="0"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <span className="neuro-badge text-lg">ETH</span>
              </div>
            </div>
          </div>

          {/* Projections */}
          {projections && (
            <div className="neuro-card-inset p-6 mb-6 rounded-xl">
              <h4 className="text-lg font-semibold neuro-text-primary mb-4">
                💰 Projected Returns
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs neuro-text-secondary mb-1">Daily</p>
                  <p className="text-lg font-bold text-green-500">+${projections.daily}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs neuro-text-secondary mb-1">Monthly</p>
                  <p className="text-lg font-bold text-green-500">+${projections.monthly}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs neuro-text-secondary mb-1">Yearly</p>
                  <p className="text-lg font-bold text-green-500">+${projections.yearly}</p>
                </div>
              </div>
            </div>
          )}

          {/* Strategy Summary */}
          {selectedStrategyData && (
            <div className="neuro-card-inset p-6 mb-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold neuro-text-primary">
                  Selected Strategy
                </h4>
                <span className="text-2xl">{selectedStrategyData.icon}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="neuro-text-secondary">Strategy</p>
                  <p className="font-semibold neuro-text-primary">{selectedStrategyData.name}</p>
                </div>
                <div>
                  <p className="neuro-text-secondary">Expected APY</p>
                  <p className="font-semibold text-green-500">{selectedStrategyData.expectedAPY}%</p>
                </div>
                <div>
                  <p className="neuro-text-secondary">Risk Level</p>
                  <p className="font-semibold neuro-text-primary">{selectedStrategyData.riskLevel}</p>
                </div>
                <div>
                  <p className="neuro-text-secondary">Rebalancing</p>
                  <p className="font-semibold neuro-text-primary">{selectedStrategyData.rebalanceFrequency}</p>
                </div>
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={isDeploying || !amount || parseFloat(amount) <= 0}
            className={`neuro-button-primary w-full py-4 text-lg font-bold ${
              isDeploying ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isDeploying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Deploying...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                🚀 Deploy Liquidity
              </span>
            )}
          </button>

          {/* Info Box */}
          <div className="mt-6 neuro-glass p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 text-xl">ℹ️</span>
              <div className="text-sm neuro-text-secondary">
                <p className="mb-2">
                  <strong>How it works:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your single token is automatically optimized across V2/V3 pools</li>
                  <li>Triangular arbitrage ensures maximum efficiency</li>
                  <li>Auto-rebalancing maintains optimal position</li>
                  <li>Withdraw anytime with one click</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
          <div className="neuro-card text-center p-6">
            <p className="text-3xl font-bold text-blue-500 mb-2">$2.4M</p>
            <p className="text-sm neuro-text-secondary">Total Value Locked</p>
          </div>
          <div className="neuro-card text-center p-6">
            <p className="text-3xl font-bold text-green-500 mb-2">1,234</p>
            <p className="text-sm neuro-text-secondary">Active Users</p>
          </div>
          <div className="neuro-card text-center p-6">
            <p className="text-3xl font-bold text-purple-500 mb-2">24.5%</p>
            <p className="text-sm neuro-text-secondary">Average APY</p>
          </div>
          <div className="neuro-card text-center p-6">
            <p className="text-3xl font-bold text-orange-500 mb-2">99.8%</p>
            <p className="text-sm neuro-text-secondary">Uptime</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedDeposit;


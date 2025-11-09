import React from 'react';
import '../../styles/neumorphic.css';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  expectedAPY: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  rebalanceFrequency: string;
  icon: string;
  features: string[];
  recommended?: boolean;
}

interface StrategyCardProps {
  strategy: Strategy;
  isSelected: boolean;
  onSelect: () => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, isSelected, onSelect }) => {
  const riskColors = {
    Low: '#50C878',
    Medium: '#FF9F43',
    High: '#E74C3C'
  };

  return (
    <div
      className={`neuro-card relative cursor-pointer transition-all duration-300 ${
        isSelected ? 'ring-4 ring-blue-400' : ''
      }`}
      onClick={onSelect}
      style={{
        minHeight: '320px',
        opacity: isSelected ? 1 : 0.9,
      }}
    >
      {strategy.recommended && (
        <div className="absolute -top-3 -right-3">
          <span className="neuro-badge bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1">
            ⭐ Recommended
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="neuro-icon-button text-3xl">
            {strategy.icon}
          </div>
          <div>
            <h3 className="text-xl font-bold neuro-text-primary">{strategy.name}</h3>
            <p className="text-sm neuro-text-secondary">{strategy.description}</p>
          </div>
        </div>
      </div>

      <div className="neuro-divider my-4" />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="neuro-card-inset p-3 rounded-xl">
          <p className="text-xs neuro-text-secondary mb-1">Expected APY</p>
          <p className="text-2xl font-bold text-green-500">{strategy.expectedAPY}%</p>
        </div>
        <div className="neuro-card-inset p-3 rounded-xl">
          <p className="text-xs neuro-text-secondary mb-1">Risk Level</p>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: riskColors[strategy.riskLevel] }}
            />
            <p className="text-lg font-semibold neuro-text-primary">{strategy.riskLevel}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs neuro-text-secondary mb-2">Rebalance Frequency</p>
        <div className="neuro-card-inset p-2 rounded-lg text-center">
          <p className="text-sm font-medium neuro-text-primary">🔄 {strategy.rebalanceFrequency}</p>
        </div>
      </div>

      <div>
        <p className="text-xs neuro-text-secondary mb-2">Key Features</p>
        <ul className="space-y-2">
          {strategy.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm neuro-text-primary">
              <span className="text-green-500">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-4 border-blue-400 rounded-xl pointer-events-none" />
      )}
    </div>
  );
};

export default StrategyCard;


import React, { useMemo } from 'react';
import { calculateTokenPrices, formatPrice } from '../../utils/price';

interface SelectedTokenType {
  name: string;
  symbol: string;
  logoURI: string;
  address: string;
  decimals: number;
}

interface LiquidityVisualizationProps {
  currentTick: number;
  lowerTick: number;
  upperTick: number;
  amount: string;
  calculatedAPR: number;
  selectedToken: SelectedTokenType | null;
}

const LiquidityVisualization: React.FC<LiquidityVisualizationProps> = ({
  currentTick,
  lowerTick,
  upperTick,
  amount,
  calculatedAPR,
  selectedToken
}) => {
  const prices = useMemo(() => 
    calculateTokenPrices(
      amount, 
      selectedToken?.decimals || 18, 
      currentTick, 
      lowerTick, 
      upperTick
    ),
    [amount, selectedToken?.decimals, currentTick, lowerTick, upperTick]
  );

  const positionWidth = useMemo(() => {
    const range = Math.abs(upperTick - lowerTick);
    return Math.min(Math.max(range / 100, 20), 80); // Keep width between 20% and 80%
  }, [upperTick, lowerTick]);

  const currentPosition = useMemo(() => {
    const totalRange = Math.abs(upperTick - lowerTick);
    const currentRange = Math.abs(currentTick - lowerTick);
    return (currentRange / totalRange) * 100;
  }, [currentTick, lowerTick, upperTick]);

  return (
    <div className="bg-[#1B1B1B] rounded-xl p-4 w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-gray-400">Position Range</div>
        {calculatedAPR !== undefined && (
          <div className="text-green-400">
            {calculatedAPR.toFixed(2)}% APR
          </div>
        )}
      </div>

      {/* Price Range Visualization */}
      <div className="relative h-16 bg-[#111111] rounded-lg mb-4">
        <div
          className="absolute h-full bg-blue-500/20 rounded-lg"
          style={{
            width: `${positionWidth}%`,
            left: `${Math.max(0, Math.min(100 - positionWidth, currentPosition - positionWidth / 2))}%`
          }}
        />
        <div
          className="absolute w-1 h-full bg-yellow-400"
          style={{
            left: `${Math.max(0, Math.min(100, currentPosition))}%`
          }}
        />
      </div>

      {/* Price Information */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-400 mb-1">Min Price</div>
          <div className="text-white font-medium">
            {formatPrice(prices.lowerPrice)} {selectedToken?.symbol}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Current Price</div>
          <div className="text-yellow-400 font-medium">
            {formatPrice(prices.currentPrice)} {selectedToken?.symbol}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Max Price</div>
          <div className="text-white font-medium">
            {formatPrice(prices.upperPrice)} {selectedToken?.symbol}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(LiquidityVisualization); 
// Constants
export const TICK_BASE = 1.0001;
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

// Convert tick to price
export const tickToPrice = (tick: number): number => {
  return Math.pow(TICK_BASE, tick);
};

// Format price for display
export const formatPrice = (price: number | string): string => {
  if (typeof price === 'string') {
    price = parseFloat(price);
  }
  if (isNaN(price) || price === 0) return '0';

  if (price < 0.0001) {
    return price.toExponential(2);
  } else if (price < 1) {
    return price.toPrecision(4);
  } else if (price < 1000) {
    return price.toFixed(2);
  } else {
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
};

// Calculate token ratios based on ticks
export const calculateTokenRatios = (currentTick: number, lowerTick: number, upperTick: number) => {
  const effectiveCurrentTick = currentTick || lowerTick;
  const currentPrice = tickToPrice(effectiveCurrentTick);
  const lowerPrice = tickToPrice(lowerTick);
  const upperPrice = tickToPrice(upperTick);
  
  if (currentPrice <= lowerPrice) {
    return { depositedToken: 100, hermes: 0 };
  } else if (currentPrice >= upperPrice) {
    return { depositedToken: 0, hermes: 100 };
  } else {
    const position = (currentPrice - lowerPrice) / (upperPrice - lowerPrice);
    const hermes = Math.round(position * 100);
    const depositedToken = 100 - hermes;
    return { depositedToken, hermes };
  }
};

// Calculate position value
export const calculatePositionValue = (
  initialAmount: string,
  currentTick: number,
  lowerTick: number,
  upperTick: number,
  initialUsdValue: number
): string => {
  try {
    if (!initialAmount || initialUsdValue <= 0) return '$0.00';

    const effectiveCurrentTick = currentTick || lowerTick;
    const rangeProgress = Math.max(0, Math.min(1, 
      (effectiveCurrentTick - lowerTick) / (upperTick - lowerTick)
    ));

    const maxValue = initialUsdValue * 2;  // Double the value at full conversion
    const currentValue = initialUsdValue + (maxValue - initialUsdValue) * rangeProgress;

    return currentValue.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  } catch (error) {
    console.error('Error calculating position value:', error);
    return '$0.00';
  }
};

// Calculate liquidity range percentage
export const calculateLiquidityRange = (lowerTick: number, upperTick: number): number => {
  const lowerPrice = tickToPrice(lowerTick);
  const upperPrice = tickToPrice(upperTick);
  return ((upperPrice - lowerPrice) / lowerPrice) * 100;
};

// Calculate box height for visualization
export const calculateBoxHeight = (amount: string): number => {
  const baseHeight = 15;
  const amountNum = parseFloat(amount || '0');
  return Math.max(
    baseHeight * (amountNum > 1000 
      ? Math.log10(amountNum) / 3 
      : amountNum / 1000
    ),
    5  // Minimum height
  );
};

// Debug price calculations
export const debugPriceCalculations = (
  currentTick: number,
  lowerTick: number,
  upperTick: number,
  amount: string
) => {
  const currentPrice = tickToPrice(currentTick);
  const lowerPrice = tickToPrice(lowerTick);
  const upperPrice = tickToPrice(upperTick);
  const rangePercentage = ((upperPrice - lowerPrice) / lowerPrice) * 100;
  const rangeProgress = (currentTick - lowerTick) / (upperTick - lowerTick);

  return {
    ticks: { currentTick, lowerTick, upperTick },
    prices: {
      currentPrice: currentPrice.toFixed(4),
      lowerPrice: lowerPrice.toFixed(4),
      upperPrice: upperPrice.toFixed(4)
    },
    range: {
      percentage: rangePercentage.toFixed(2) + '%',
      progress: (rangeProgress * 100).toFixed(2) + '%'
    },
    amount: amount
  };
}; 
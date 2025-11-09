// Constants
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [-100, 69, -100];
export const MIN_AXIS_RANGE = 1000;
export const MIN_AXIS_DELTA = 1;

// Calculate axis values for visualization
export const calculateAxisValues = (lowerTick: number, upperTick: number) => {
  const axisC = Math.max(
    Math.abs(lowerTick) + 2 * Math.abs(upperTick - lowerTick),
    MIN_AXIS_RANGE
  );
  
  const axisDelta = Math.max(
    Math.abs(upperTick - lowerTick),
    MIN_AXIS_DELTA
  );

  return { axisC, axisDelta };
};

// Calculate height for liquidity visualization
export const calculateLiquidityHeight = (liquidity: string): number => {
  try {
    if (!liquidity || liquidity === "0") {
      return 0.5; // Minimum height for zero liquidity
    }

    const liquidityBigInt = BigInt(liquidity);
    const scaleFactor = BigInt(10 ** 18);
    const scaledLiquidity = Number(liquidityBigInt / scaleFactor);
    const height = Math.max(Math.log10(scaledLiquidity + 1) * 2, 0.5);
    
    return isNaN(height) || !isFinite(height) ? 0.5 : height;
  } catch (error) {
    console.error('Error calculating height:', error, 'liquidity:', liquidity);
    return 0.5;
  }
};

// Calculate slider value from tick position
export const calculateSliderValue = (
  currentTick: number,
  lowerTick: number,
  upperTick: number
): number => {
  if (!upperTick || !lowerTick || upperTick === lowerTick) return 0;
  const progress = ((currentTick - lowerTick) / (upperTick - lowerTick)) * 100;
  return isNaN(progress) ? 0 : progress;
};

// Calculate tick from slider value
export const calculateTickFromSlider = (
  value: number,
  lowerTick: number,
  upperTick: number
): number => {
  if (!upperTick || !lowerTick || upperTick === lowerTick) {
    return lowerTick || 0;
  }
  
  const newTick = lowerTick + ((upperTick - lowerTick) * value / 100);
  return Math.max(lowerTick, Math.min(upperTick, newTick));
}; 
import { ethers } from 'ethers';
import univ3prices from '@thanpolas/univ3prices';

export const calculateTokenPrices = (
  amount: string,
  decimals: number,
  currentTick: number,
  lowerTick: number,
  upperTick: number
) => {
  try {
    const amountBigInt = ethers.parseUnits(amount || '0', decimals);
    const sqrtPriceX96 = Math.sqrt(Math.pow(1.0001, currentTick)) * Math.pow(2, 96);
    const sqrtPriceAX96 = Math.sqrt(Math.pow(1.0001, lowerTick)) * Math.pow(2, 96);
    const sqrtPriceBX96 = Math.sqrt(Math.pow(1.0001, upperTick)) * Math.pow(2, 96);

    const prices = univ3prices([sqrtPriceAX96, sqrtPriceBX96], decimals, decimals);
    const currentPrice = univ3prices([sqrtPriceX96, sqrtPriceX96], decimals, decimals);

    return {
      lowerPrice: prices.toSignificant(6),
      upperPrice: prices.toSignificant(6),
      currentPrice: currentPrice.toSignificant(6),
      amount: amountBigInt.toString()
    };
  } catch (error) {
    console.error('Error calculating token prices:', error);
    return {
      lowerPrice: '0',
      upperPrice: '0',
      currentPrice: '0',
      amount: '0'
    };
  }
};

export const calculateAPR = (
  amount: string,
  tokenPrice: number,
  volume24h: number,
  feeTier: number
): number => {
  try {
    const amountUSD = parseFloat(amount) * tokenPrice;
    if (amountUSD === 0) return 0;

    const dailyFees = (volume24h * feeTier) / 100;
    const yearlyFees = dailyFees * 365;
    const apr = (yearlyFees / amountUSD) * 100;

    return Math.min(Math.max(apr, 0), 1000); // Cap APR between 0% and 1000%
  } catch (error) {
    console.error('Error calculating APR:', error);
    return 0;
  }
};

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
export const Q96 = 2n ** 96n
export const MAX_UINT128 = (2n ** 128n) - 1n

export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('mulDiv: denominator is 0')
  return (a * b) / denominator
}

/**
 * Convert a Q96 fixed-point price (currencyBase/tokenBase * Q96) into currency base units per 1 token.
 *
 * Example:
 * - If currency is ETH (wei) and token has 18 decimals, this returns wei per 1 token.
 */
export function q96ToCurrencyPerTokenBaseUnits(priceQ96: bigint, tokenDecimals: number): bigint {
  const tokenScale = 10n ** BigInt(tokenDecimals)
  return mulDiv(priceQ96, tokenScale, Q96)
}

/**
 * Convert currency base units per 1 token into Q96 fixed-point price.
 *
 * Example:
 * - If currency is ETH (wei) and token has 18 decimals, pass weiPerToken to get priceQ96.
 */
export function currencyPerTokenBaseUnitsToQ96(currencyPerTokenBaseUnits: bigint, tokenDecimals: number): bigint {
  const tokenScale = 10n ** BigInt(tokenDecimals)
  return mulDiv(currencyPerTokenBaseUnits, Q96, tokenScale)
}

export function applyBps(value: bigint, bps: number): bigint {
  return (value * BigInt(bps)) / 10_000n
}




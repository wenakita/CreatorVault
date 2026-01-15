export function resolveCdpPaymasterUrl(
  paymaster: string | null | undefined,
  apiKey: string | undefined,
): string | null {
  if (paymaster && typeof paymaster === 'string') return paymaster
  if (apiKey) return `https://api.developer.coinbase.com/rpc/v1/base/${apiKey}`
  return null
}

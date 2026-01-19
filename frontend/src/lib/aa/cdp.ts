export function resolveCdpPaymasterUrl(
  paymaster: string | null | undefined,
  apiKey: string | undefined,
): string | null {
  // Prefer same-origin proxy when the URL points at it.
  // This avoids cross-domain SIWE/session issues when multiple domains (e.g. 4626.fun vs erc4626.fun)
  // are used for the frontend, but the paymaster URL was configured as an absolute URL.
  const normalizePaymasterUrl = (value: string): string => {
    const v = value.trim()
    if (!v) return v
    if (v === '/api/paymaster') return v
    try {
      const u = new URL(v)
      if (u.pathname === '/api/paymaster') return '/api/paymaster'
      return v
    } catch {
      return v
    }
  }

  if (paymaster && typeof paymaster === 'string') return normalizePaymasterUrl(paymaster)
  if (apiKey) return `https://api.developer.coinbase.com/rpc/v1/base/${apiKey}`
  return null
}

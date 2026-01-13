type PrivyRuntime = {
  /** Privy App ID (public). */
  appId: string | null
  /** True when Privy should be used in this runtime/origin. */
  enabled: boolean
  /** Current origin (browser-only). */
  origin: string | null
  /** Parsed allowlist values from env (may be empty). */
  allowedOrigins: string[]
}

function normalize(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\/+$/g, '')
    .toLowerCase()
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (!v) return []
  return v
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

function originIsAllowed(origin: string, allowed: string[]): boolean {
  const o = normalize(origin)
  if (!o) return false

  for (const entryRaw of allowed) {
    const entry = normalize(entryRaw)
    if (!entry) continue
    if (entry === '*' || entry === 'all') return true

    // Accept either full origins (https://erc4626.fun) or bare hostnames (erc4626.fun).
    if (entry.includes('://')) {
      if (entry === o) return true
    } else {
      try {
        const host = new URL(o).hostname.toLowerCase()
        if (host === entry) return true
      } catch {
        // ignore
      }
    }
  }

  return false
}

/**
 * Privy is great, but if the Privy dashboard "Allowed Origins" isn't configured
 * for the current domain, the iframe will be blocked (CSP frame-ancestors) and
 * wallet connect will break.
 *
 * To prevent production outages, we only enable Privy when:
 * - `VITE_PRIVY_APP_ID` is set, AND
 * - (DEV) OR the current origin is explicitly allowlisted via `VITE_PRIVY_ALLOWED_ORIGINS`.
 *
 * Set `VITE_PRIVY_ALLOWED_ORIGINS=https://erc4626.fun` in Vercel to enable Privy on prod.
 */
export function getPrivyRuntime(): PrivyRuntime {
  const appIdRaw = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim()
  const appId = appIdRaw && appIdRaw.length > 0 ? appIdRaw : null

  const origin = typeof window !== 'undefined' ? window.location.origin : null
  const allowedOrigins = parseAllowedOrigins(import.meta.env.VITE_PRIVY_ALLOWED_ORIGINS as string | undefined)

  // Privy can hard-fail on some browsers/adblockers due to CSP + 3p iframe settings.
  // Make it explicitly opt-in so normal connectors (injected/Coinbase/WalletConnect) remain available.
  const explicitEnable = String(import.meta.env.VITE_PRIVY_ENABLED ?? '').trim().toLowerCase()
  const privyExplicitlyEnabled = explicitEnable === '1' || explicitEnable === 'true' || explicitEnable === 'yes'

  const enabled =
    Boolean(appId) &&
    privyExplicitlyEnabled &&
    (Boolean(import.meta.env.DEV) || (typeof origin === 'string' && originIsAllowed(origin, allowedOrigins)))

  return { appId, enabled, origin, allowedOrigins }
}


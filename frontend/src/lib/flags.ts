export function isPublicSiteMode(): boolean {
  const v = String(import.meta.env.VITE_PUBLIC_SITE_MODE ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function isTruthyEnv(v: unknown): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

export function getPrivyAppId(): string | null {
  const appId = String(import.meta.env.VITE_PRIVY_APP_ID ?? '').trim()
  return appId.length > 0 ? appId : null
}

function getAllowedOriginsFromEnv(): Set<string> {
  const raw = String(import.meta.env.VITE_PRIVY_ALLOWED_ORIGINS ?? '').trim()
  const out = new Set<string>()
  if (!raw) return out
  for (const part of raw.split(/[\s,]+/g)) {
    const t = part.trim()
    if (!t) continue
    try {
      out.add(new URL(t).origin)
    } catch {
      // ignore invalid values
    }
  }
  return out
}

export function isPrivyClientEnabled(): boolean {
  // Explicit enable flag (so Privy can't break production unexpectedly).
  if (!isTruthyEnv(import.meta.env.VITE_PRIVY_ENABLED)) return false
  if (!getPrivyAppId()) return false

  // Local dev is allowed by default.
  if (import.meta.env.DEV) return true

  // Production safety: only allow on explicitly allowlisted origins.
  if (typeof window === 'undefined') return false
  const allowed = getAllowedOriginsFromEnv()
  if (allowed.size === 0) return false
  return allowed.has(window.location.origin)
}


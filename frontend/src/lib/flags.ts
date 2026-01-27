export function isPublicSiteMode(): boolean {
  const v = String(import.meta.env.VITE_PUBLIC_SITE_MODE ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const DEFAULT_PRIVY_APP_ID = 'cmk411efm034jl50cs618o8cy'
const DEFAULT_PRIVY_ALLOWED_ORIGINS = new Set<string>(['https://4626.fun', 'https://app.4626.fun'])

function isTruthyEnv(v: unknown): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

export function getPrivyAppId(): string | null {
  const appId = String(import.meta.env.VITE_PRIVY_APP_ID ?? '').trim()
  if (appId.length > 0) return appId
  return DEFAULT_PRIVY_APP_ID
}

function getAllowedOriginsFromEnv(): Set<string> {
  const raw = String(import.meta.env.VITE_PRIVY_ALLOWED_ORIGINS ?? '').trim()
  const out = new Set<string>()
  if (!raw) return new Set(DEFAULT_PRIVY_ALLOWED_ORIGINS)
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
  return true
}

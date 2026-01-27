export function isPublicSiteMode(): boolean {
  const v = String(import.meta.env.VITE_PUBLIC_SITE_MODE ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const DEFAULT_PRIVY_APP_ID = 'cmk411efm034jl50cs618o8cy'

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

export function isPrivyClientEnabled(): boolean {
  // Explicit enable flag (so Privy can't break production unexpectedly).
  if (!isTruthyEnv(import.meta.env.VITE_PRIVY_ENABLED)) return false
  if (!getPrivyAppId()) return false
  return true
}

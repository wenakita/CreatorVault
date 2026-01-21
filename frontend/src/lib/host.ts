export type HostMode = 'app' | 'marketing'

export function getHostMode(): HostMode {
  if (typeof window === 'undefined') return 'marketing'
  const host = window.location.hostname.toLowerCase()
  // Local dev: treat localhost as the app host so app routes render without redirect loops.
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'
  ) {
    return 'app'
  }
  return host.startsWith('app.') ? 'app' : 'marketing'
}

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://app.4626.fun'
  const host = window.location.hostname.toLowerCase()
  // Local dev: do not rewrite localhost/loopback hosts to `app.*` (it breaks Vite and TLS).
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'
  ) {
    return window.location.origin
  }
  // If we're already on app.*, keep same origin.
  if (host.startsWith('app.')) return window.location.origin
  // Otherwise, swap to app.<root-domain>
  const parts = host.split('.')
  const root = parts.length >= 2 ? parts.slice(-2).join('.') : host
  return `https://app.${root}`
}


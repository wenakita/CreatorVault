import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'

import { useMiniAppContext } from '@/hooks'

type SignManifestResult = { header: string; payload: string; signature: string }

const DEFAULT_DOMAIN = '4626.fun'

function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

export function AdminMiniApp() {
  const mini = useMiniAppContext()
  const [capabilities, setCapabilities] = useState<string[] | null>(null)
  const [capsError, setCapsError] = useState<string | null>(null)

  const [domain, setDomain] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_DOMAIN
    const qs = new URLSearchParams(window.location.search)
    const fromQuery = (qs.get('domain') || '').trim()
    if (fromQuery) return fromQuery
    const host = (window.location.hostname || '').trim()
    return host || DEFAULT_DOMAIN
  })

  const [result, setResult] = useState<SignManifestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const caps = await sdk.getCapabilities().catch(() => null)
        if (cancelled) return

        if (!caps) {
          setCapabilities(null)
          setCapsError('Capabilities not available (not running inside a Mini App).')
          return
        }

        setCapabilities(Array.from(caps).map(String))
        setCapsError(null)
      } catch (e: unknown) {
        if (cancelled) return
        setCapabilities(null)
        setCapsError(e instanceof Error ? e.message : 'Failed to read capabilities')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const canSignManifest = useMemo(() => {
    if (!capabilities) return null
    return capabilities.includes('experimental.signManifest')
  }, [capabilities])

  const accountAssociationJson = useMemo(() => {
    if (!result) return null
    return {
      accountAssociation: {
        header: result.header,
        payload: result.payload,
        signature: result.signature,
      },
    }
  }, [result])

  const decodedHeader = useMemo(() => {
    const h = result?.header
    if (!h) return null
    if (typeof window === 'undefined') return null

    // base64url decode
    const padded = h.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((h.length + 3) % 4)
    const json = atob(padded)
    return tryParseJson(json)
  }, [result?.header])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  async function sign() {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      const signed = await sdk.experimental.signManifest({ domain: domain.trim() || DEFAULT_DOMAIN })
      setResult({ header: signed.header, payload: signed.payload, signature: signed.signature })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Manifest signing failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
              <div className="space-y-2">
                <div className="label">Mini App</div>
                <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Manifest signing (developer)</div>
                <div className="text-sm text-zinc-600 max-w-prose">
                  Use this page <span className="text-zinc-300">inside the Base app preview</span> to generate the{' '}
                  <span className="font-mono text-zinc-300">accountAssociation</span> block for{' '}
                  <span className="font-mono text-zinc-300">{domain}</span>.
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="text-sm text-zinc-200">Domain to sign</div>
                <div className="text-xs text-zinc-600">
                  This must match the <span className="font-mono text-zinc-400">canonicalDomain</span> in{' '}
                  <span className="font-mono text-zinc-400">/.well-known/farcaster.json</span>.
                </div>
                <input
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={DEFAULT_DOMAIN}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={`https://${(domain.trim() || DEFAULT_DOMAIN).replace(/^https?:\/\//, '')}/.well-known/farcaster.json?t=${Date.now()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    View manifest
                  </span>
                  <ExternalLink className="w-4 h-4 text-zinc-600" />
                </a>

                <a
                  href="https://www.base.dev/preview"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-zinc-500" />
                    Base Build preview
                  </span>
                  <ExternalLink className="w-4 h-4 text-zinc-600" />
                </a>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="text-sm text-zinc-200 flex items-center justify-between gap-3">
                  <span>Environment</span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {mini.isMiniApp === null ? 'Detecting…' : mini.isMiniApp ? 'Mini App' : 'Web'}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 space-y-1">
                  <div>
                    User: <span className="text-zinc-400">{mini.username ? `@${mini.username}` : '—'}</span>
                    {mini.fid ? <span className="text-zinc-700"> · </span> : null}
                    {mini.fid ? <span className="text-zinc-500">FID {mini.fid}</span> : null}
                  </div>
                  <div>
                    Capabilities:{' '}
                    {capabilities ? (
                      <span className="text-zinc-400">
                        {canSignManifest === true ? 'signManifest supported' : canSignManifest === false ? 'signManifest not supported' : '—'}
                      </span>
                    ) : (
                      <span className="text-zinc-500">{capsError ?? '—'}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={busy || mini.isMiniApp === false || canSignManifest === false}
                  className="w-full sm:w-auto btn-accent rounded-lg px-5 py-3 text-sm disabled:opacity-60"
                  title={mini.isMiniApp === false ? 'Open this page inside Base app preview to sign.' : undefined}
                >
                  {busy ? 'Signing…' : 'Generate accountAssociation'}
                </button>

                {error ? <div className="text-[11px] text-red-400/90">{error}</div> : null}
              </div>

              {accountAssociationJson ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                  <div className="text-sm text-zinc-200 flex items-center justify-between gap-3">
                    <span>Copy/paste this</span>
                    <button
                      type="button"
                      onClick={() => void copy(JSON.stringify(accountAssociationJson.accountAssociation, null, 2))}
                      className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Copy accountAssociation JSON"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <pre className="text-[11px] leading-relaxed text-zinc-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-auto">
{JSON.stringify(accountAssociationJson.accountAssociation, null, 2)}
                  </pre>

                  {decodedHeader && typeof decodedHeader === 'object' ? (
                    <div className="text-[11px] text-zinc-600">
                      Header (decoded): <span className="text-zinc-500">{JSON.stringify(decodedHeader)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}




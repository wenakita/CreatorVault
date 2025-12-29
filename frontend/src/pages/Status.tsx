import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { AKITA } from '@/config/contracts'

type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'

type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}

type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

type ProtocolReportResponse = {
  chainId: number
  generatedAt: string
  sections: CheckSection[]
}

type VaultReportResponse = {
  chainId: number
  generatedAt: string
  sections: CheckSection[]
  context?: Record<string, unknown>
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function summarize(sections: CheckSection[]) {
  let pass = 0
  let fail = 0
  let warn = 0
  let info = 0
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === 'pass') pass++
      else if (c.status === 'fail') fail++
      else if (c.status === 'warn') warn++
      else info++
    }
  }
  return { pass, fail, warn, info }
}

function StatusPill({ status }: { status: CheckStatus }) {
  const styles =
    status === 'pass'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : status === 'fail'
        ? 'bg-red-500/10 text-red-200 border-red-500/20'
        : status === 'warn'
          ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
          : 'bg-zinc-900/40 text-zinc-300 border-zinc-900/60'
  const label = status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : status === 'warn' ? 'Warning' : 'Info'

  return <span className={`px-2 py-0.5 rounded-full border text-[10px] ${styles}`}>{label}</span>
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-300" />
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-300" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-300" />
  return <div className="w-4 h-4 rounded-full border border-zinc-700" />
}

function SectionCard({ section }: { section: CheckSection }) {
  const counts = useMemo(() => summarize([section]), [section])
  const worst: CheckStatus = section.checks.some((c) => c.status === 'fail')
    ? 'fail'
    : section.checks.some((c) => c.status === 'warn')
      ? 'warn'
      : section.checks.some((c) => c.status === 'pass')
        ? 'pass'
        : 'info'

  return (
    <details className="group border border-zinc-900/50 rounded-xl bg-black/20 overflow-hidden" open>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 py-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm text-zinc-200">{section.title}</div>
            <StatusPill status={worst} />
          </div>
          {section.description ? <div className="text-xs text-zinc-600">{section.description}</div> : null}
        </div>
        <div className="text-[10px] text-zinc-600 mt-1 whitespace-nowrap">
          {counts.pass} pass · {counts.warn} warn · {counts.fail} fail
        </div>
      </summary>

      <div className="border-t border-zinc-900/50">
        {section.checks.map((c) => (
          <div
            key={c.id}
            className="px-5 py-3 flex items-start justify-between gap-4 border-b border-zinc-900/40 last:border-b-0"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5">
                <StatusIcon status={c.status} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{c.label}</div>
                {c.details ? <div className="text-xs text-zinc-600 break-words mt-0.5">{c.details}</div> : null}
              </div>
            </div>
            {c.href ? (
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 whitespace-nowrap flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <StatusPill status={c.status} />
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const json = await r.json().catch(() => null)
  if (!r.ok || !json || json.success === false) {
    const msg = (json && json.error) || `Request failed (${r.status})`
    throw new Error(msg)
  }
  return json.data as T
}

function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

export function Status() {
  const [searchParams, setSearchParams] = useSearchParams()

  const vaultParam = useMemo(() => searchParams.get('vault') ?? '', [searchParams])
  const [vaultInput, setVaultInput] = useState<string>(vaultParam)
  const [runId, setRunId] = useState<number>(0)

  useEffect(() => {
    setVaultInput(vaultParam)
  }, [vaultParam])

  const vaultParamAddress = useMemo(() => {
    const v = String(vaultParam || '').trim()
    return isAddressLike(v) ? v : null
  }, [vaultParam])

  const vaultInputAddress = useMemo(() => {
    const v = String(vaultInput || '').trim()
    return isAddressLike(v) ? v : null
  }, [vaultInput])

  const protocolQuery = useQuery({
    queryKey: ['status', 'protocolReport'],
    queryFn: async () => fetchJson<ProtocolReportResponse>('/api/status/protocolReport'),
  })

  const vaultQuery = useQuery({
    queryKey: ['status', 'vaultReport', vaultParamAddress, runId],
    enabled: !!vaultParamAddress,
    queryFn: async () =>
      fetchJson<VaultReportResponse>(
        `/api/status/vaultReport?vault=${vaultParamAddress}${runId ? `&t=${runId}` : ''}`,
      ),
    retry: 2,
  })

  const globalSections = protocolQuery.data?.sections ?? []
  const vaultSections = vaultQuery.data?.sections ?? []

  const globalSummary = useMemo(() => summarize(globalSections), [globalSections])
  const vaultSummary = useMemo(() => summarize(vaultSections), [vaultSections])

  const onRun = () => {
    const next = new URLSearchParams(searchParams)
    if (vaultInputAddress) next.set('vault', vaultInputAddress)
    else next.delete('vault')
    setSearchParams(next)

    // Always bump runId so we bypass CDN cache when the user explicitly runs checks.
    setRunId(Date.now())
  }

  // SEO safety: diagnostic page + query variants.
  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)

    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = 'https://creatorvault.fun/status'
    document.head.appendChild(canonical)

    return () => {
      robots.remove()
      canonical.remove()
    }
  }, [])

  const displayVault = vaultParamAddress ?? vaultInputAddress

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <span className="label">Status</span>
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="headline text-3xl sm:text-5xl flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7 text-emerald-300" />
                  Verification checks
                </h1>
                <p className="text-sm text-zinc-500 font-light max-w-prose">
                  Live, read-only checks that verify contract deployments and wiring on Base.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-600">
                <div>{globalSummary.pass} pass</div>
                <div>{globalSummary.warn} warn</div>
                <div>{globalSummary.fail} fail</div>
              </div>
            </div>
          </motion.div>

          {/* Verify a vault */}
          <div className="mt-10 card rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <div className="label">Verify a vault</div>
                <div className="text-xs text-zinc-600">Paste a vault address to generate a shareable report.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVaultInput(AKITA.vault)
                  const next = new URLSearchParams(searchParams)
                  next.set('vault', AKITA.vault)
                  setSearchParams(next)
                }}
                className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Use AKITA example
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="Vault address (0x…)"
                className="flex-1 w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none font-mono"
              />
              <button
                type="button"
                onClick={onRun}
                className="btn-accent rounded-lg px-5 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!vaultInputAddress || vaultQuery.isFetching}
                title={!vaultInputAddress ? 'Enter a valid vault address' : 'Run checks'}
              >
                <span className="inline-flex items-center gap-2">
                  {vaultQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {vaultQuery.isFetching ? 'Running…' : 'Run checks'}
                </span>
              </button>
            </div>

            {displayVault ? (
              <div className="text-xs text-zinc-600 flex items-center justify-between gap-4">
                <div className="font-mono break-all">{displayVault}</div>
                <a
                  href={basescanAddressHref(displayVault)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 whitespace-nowrap flex items-center gap-1"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="text-xs text-zinc-700">
                Tip: after deploying, use the vault address shown in the Deploy details panel.
              </div>
            )}

            {vaultQuery.data && (
              <div className="pt-2 flex items-center gap-4 text-xs text-zinc-500">
                <div className="text-emerald-200">{vaultSummary.pass} pass</div>
                <div className="text-amber-200">{vaultSummary.warn} warn</div>
                <div className="text-red-200">{vaultSummary.fail} fail</div>
                <div className="text-zinc-600">
                  Last checked:{' '}
                  <span className="text-zinc-500">
                    {new Date(vaultQuery.data.generatedAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )}

            {vaultQuery.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>{String((vaultQuery.error as any)?.message || 'Could not generate this vault report.')}</div>
              </div>
            ) : null}
          </div>

          {/* Protocol checks */}
          <div className="mt-8 space-y-4">
            {protocolQuery.isFetching ? (
              <div className="text-xs text-zinc-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading protocol checks…
              </div>
            ) : null}
            {protocolQuery.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>{String((protocolQuery.error as any)?.message || 'Could not load protocol checks.')}</div>
              </div>
            ) : null}
            {globalSections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
            {protocolQuery.data ? (
              <div className="text-[10px] text-zinc-700">
                Protocol checks updated:{' '}
                {new Date(protocolQuery.data.generatedAt).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            ) : null}
          </div>

          {/* Vault report */}
          <div className="mt-8 space-y-4">
            {vaultQuery.isFetching ? (
              <div className="text-xs text-zinc-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Running vault checks…
              </div>
            ) : null}
            {vaultSections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </div>

          <div className="mt-10 text-[10px] text-zinc-700">
            These checks are informational and read-only. They do not make transactions or modify contracts.
          </div>
        </div>
      </section>
    </div>
  )
}



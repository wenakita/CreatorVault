import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { base } from 'wagmi/chains'
import { CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink, ShieldCheck, Wrench } from 'lucide-react'
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

type VaultFixContext = {
  vault?: string
  vaultOwner?: string
  owner?: string
  shareOFTAddress?: string
  shareOftOwner?: string | null
  shareVault?: string | null
  shareGaugeController?: string | null
  shareMinterOk?: boolean | null
  wrapperAddress?: string
  wrapperOwner?: string | null
  wrapperWhitelisted?: boolean | null
  gaugeAddress?: string
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

const SHAREOFT_ADMIN_ABI = [
  { type: 'function', name: 'setVault', stateMutability: 'nonpayable', inputs: [{ name: '_vault', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_controller', type: 'address' }], outputs: [] },
  {
    type: 'function',
    name: 'setMinter',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'minter', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const VAULT_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_account', type: 'address' },
      { name: '_status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

export function Status() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { address, isConnected, chain } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixHash, setFixHash] = useState<`0x${string}` | null>(null)

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

  const txReceipt = useWaitForTransactionReceipt({
    hash: fixHash ?? undefined,
    chainId: base.id,
  })

  useEffect(() => {
    if (!fixHash) return
    if (txReceipt.isSuccess) {
      setFixHash(null)
      setFixingId(null)
      setFixError(null)
      // Re-run checks after a fix confirms.
      setRunId(Date.now())
    } else if (txReceipt.isError) {
      setFixHash(null)
      setFixingId(null)
    }
  }, [fixHash, txReceipt.isSuccess, txReceipt.isError])

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

  const ctx = (vaultQuery.data?.context ?? {}) as VaultFixContext
  const vaultAddress = typeof ctx.vault === 'string' && isAddressLike(ctx.vault) ? ctx.vault : vaultParamAddress
  const vaultOwnerRaw = typeof ctx.vaultOwner === 'string' ? ctx.vaultOwner : typeof ctx.owner === 'string' ? ctx.owner : null
  const vaultOwner = vaultOwnerRaw && isAddressLike(vaultOwnerRaw) ? vaultOwnerRaw : null
  const shareOFT = typeof ctx.shareOFTAddress === 'string' && isAddressLike(ctx.shareOFTAddress) ? ctx.shareOFTAddress : null
  const shareOwner = typeof ctx.shareOftOwner === 'string' && isAddressLike(ctx.shareOftOwner) ? ctx.shareOftOwner : null
  const shareVault = typeof ctx.shareVault === 'string' && isAddressLike(ctx.shareVault) ? ctx.shareVault : ctx.shareVault === null ? null : null
  const shareGauge = typeof ctx.shareGaugeController === 'string' && isAddressLike(ctx.shareGaugeController) ? ctx.shareGaugeController : ctx.shareGaugeController === null ? null : null
  const shareMinterOk = typeof ctx.shareMinterOk === 'boolean' ? ctx.shareMinterOk : null
  const wrapper = typeof ctx.wrapperAddress === 'string' && isAddressLike(ctx.wrapperAddress) ? ctx.wrapperAddress : null
  const wrapperWhitelisted = typeof ctx.wrapperWhitelisted === 'boolean' ? ctx.wrapperWhitelisted : null
  const gauge = typeof ctx.gaugeAddress === 'string' && isAddressLike(ctx.gaugeAddress) ? ctx.gaugeAddress : null

  const canFixShare = !!address && !!shareOwner && address.toLowerCase() === shareOwner.toLowerCase()
  const canFixVault = !!address && !!vaultOwner && address.toLowerCase() === vaultOwner.toLowerCase()
  const isBase = (chain?.id ?? base.id) === base.id

  const fixActions = useMemo(() => {
    const actions: Array<{
      id: string
      title: string
      description: string
      requiredOwner?: string | null
      canRun: boolean
      onRun: () => Promise<void>
    }> = []

    if (shareOFT && vaultAddress && shareVault && shareVault.toLowerCase() !== vaultAddress.toLowerCase()) {
      actions.push({
        id: 'fix-share-vault',
        title: 'Wire share token → vault',
        description: 'Sets shareOFT.vault so conversions and integrations can reference the vault.',
        requiredOwner: shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-vault')
          const hash = await writeContractAsync({
            address: shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setVault',
            args: [vaultAddress as `0x${string}`],
            chainId: base.id,
          })
          setFixHash(hash)
        },
      })
    }

    if (shareOFT && vaultAddress && !shareVault) {
      actions.push({
        id: 'fix-share-vault',
        title: 'Wire share token → vault',
        description: 'Sets shareOFT.vault so conversions and integrations can reference the vault.',
        requiredOwner: shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-vault')
          const hash = await writeContractAsync({
            address: shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setVault',
            args: [vaultAddress as `0x${string}`],
            chainId: base.id,
          })
          setFixHash(hash)
        },
      })
    }

    if (shareOFT && gauge) {
      const needsGauge = !shareGauge || shareGauge.toLowerCase() !== gauge.toLowerCase()
      if (needsGauge) {
        actions.push({
          id: 'fix-share-gauge',
          title: 'Wire share token → gauge',
          description: 'Sets shareOFT.gaugeController so buy fees can route to the gauge controller.',
          requiredOwner: shareOwner,
          canRun: !!isConnected && isBase && canFixShare,
          onRun: async () => {
            setFixError(null)
            setFixingId('fix-share-gauge')
            const hash = await writeContractAsync({
              address: shareOFT as `0x${string}`,
              abi: SHAREOFT_ADMIN_ABI,
              functionName: 'setGaugeController',
              args: [gauge as `0x${string}`],
              chainId: base.id,
            })
            setFixHash(hash)
          },
        })
      }
    }

    if (shareOFT && wrapper && shareMinterOk === false) {
      actions.push({
        id: 'fix-share-minter',
        title: 'Approve wrapper as share-token minter',
        description: 'Sets shareOFT.setMinter(wrapper, true) so deposits can mint receipt tokens.',
        requiredOwner: shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-minter')
          const hash = await writeContractAsync({
            address: shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setMinter',
            args: [wrapper as `0x${string}`, true],
            chainId: base.id,
          })
          setFixHash(hash)
        },
      })
    }

    if (vaultAddress && wrapper && wrapperWhitelisted === false) {
      actions.push({
        id: 'fix-vault-whitelist',
        title: 'Whitelist wrapper on vault',
        description: 'Enables deposits/withdrawals through the wrapper when the vault whitelist is enforced.',
        requiredOwner: vaultOwner,
        canRun: !!isConnected && isBase && canFixVault,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-vault-whitelist')
          const hash = await writeContractAsync({
            address: vaultAddress as `0x${string}`,
            abi: VAULT_ADMIN_ABI,
            functionName: 'setWhitelist',
            args: [wrapper as `0x${string}`, true],
            chainId: base.id,
          })
          setFixHash(hash)
        },
      })
    }

    return actions
  }, [
    address,
    canFixShare,
    canFixVault,
    gauge,
    isBase,
    isConnected,
    shareGauge,
    shareMinterOk,
    shareOFT,
    shareOwner,
    shareVault,
    vaultAddress,
    vaultOwner,
    wrapper,
    wrapperWhitelisted,
    writeContractAsync,
  ])

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

            {vaultQuery.data && fixActions.length > 0 ? (
              <div className="pt-4 border-t border-zinc-900/50 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="label">Fixes</div>
                  <div className="text-[10px] text-zinc-600">Creator-only</div>
                </div>

                {!isConnected ? (
                  <div className="text-xs text-zinc-600">
                    Connect your wallet to apply fixes.
                  </div>
                ) : !isBase ? (
                  <div className="text-xs text-zinc-600">
                    Switch to Base to apply fixes.
                  </div>
                ) : null}

                {fixError ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs">
                    {fixError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  {fixActions.map((a) => {
                    const isBusy = fixingId === a.id || (!!fixHash && fixingId === a.id)
                    const disabled = !a.canRun || isBusy || !!fixHash
                    const ownerHint =
                      a.requiredOwner && isAddressLike(a.requiredOwner)
                        ? `Owner: ${a.requiredOwner.slice(0, 6)}…${a.requiredOwner.slice(-4)}`
                        : null
                    const canRun = a.canRun

                    return (
                      <div key={a.id} className="border border-zinc-900/50 rounded-lg bg-black/20 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm text-zinc-200 flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-zinc-500" />
                              <span className="truncate">{a.title}</span>
                            </div>
                            <div className="text-xs text-zinc-600 mt-1">{a.description}</div>
                            {!canRun && ownerHint ? (
                              <div className="text-[10px] text-zinc-700 mt-1">{ownerHint}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={async () => {
                              try {
                                setFixError(null)
                                await a.onRun()
                              } catch (e: any) {
                                setFixError(String(e?.shortMessage || e?.message || 'Fix failed'))
                                setFixingId(null)
                              }
                            }}
                            className="btn-accent px-4 py-2 text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {isBusy || txReceipt.isLoading ? 'Fixing…' : 'Fix'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

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



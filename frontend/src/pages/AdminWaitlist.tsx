import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'

import { ConnectButton } from '@/components/ConnectButton'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistListItem = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  referralCode: string | null
  contactPreference: string | null
  createdAt: string
  updatedAt: string
}

type AdminWaitlistListResponse = {
  admin: string
  items: WaitlistListItem[]
}

type WaitlistDetail = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  baseSubAccount: string | null
  hasCreatorCoin: boolean | null
  farcasterFid: number | null
  contactPreference: string | null
  verifications: unknown | null
  referralCode: string | null
  referredByCode: string | null
  referredBySignupId: number | null
  referralClaimedAt: string | null
  profileCompletedAt: string | null
  createdAt: string
  updatedAt: string
}

type AdminWaitlistDetailResponse = {
  admin: string
  signup: WaitlistDetail | null
}

function shortAddr(value: string | null): string {
  if (!value) return 'N/A'
  if (value.length < 10) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

async function fetchWaitlistList(params: { q?: string | null }): Promise<AdminWaitlistListResponse> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  const res = await apiFetch(`/api/admin/waitlist/list?${qs.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminWaitlistListResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load')
  if (!json.data) throw new Error('Missing data')
  return json.data
}

async function fetchWaitlistDetail(params: { id: number }): Promise<AdminWaitlistDetailResponse> {
  const qs = new URLSearchParams()
  qs.set('id', String(params.id))
  const res = await apiFetch(`/api/admin/waitlist/detail?${qs.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminWaitlistDetailResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load detail (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load detail')
  if (!json.data) throw new Error('Missing detail data')
  return json.data
}

export function AdminWaitlist() {
  const { isConnected } = useAccount()
  const { isSignedIn, busy: authBusy, error: authError, signIn } = useSiweAuth()

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['adminWaitlistList', query.trim().toLowerCase()],
    enabled: isConnected && isSignedIn,
    queryFn: () => fetchWaitlistList({ q: query.trim().length > 0 ? query.trim().toLowerCase() : null }),
    staleTime: 5_000,
    retry: 0,
  })

  const detailQuery = useQuery({
    queryKey: ['adminWaitlistDetail', selectedId],
    enabled: isConnected && isSignedIn && selectedId !== null,
    queryFn: () => fetchWaitlistDetail({ id: selectedId as number }),
    staleTime: 5_000,
    retry: 0,
  })

  useEffect(() => {
    if (selectedId !== null) return
    const first = listQuery.data?.items?.[0]
    if (first) setSelectedId(first.id)
  }, [listQuery.data?.items, selectedId])

  const items = listQuery.data?.items ?? []
  const detail = detailQuery.data?.signup ?? null

  const errorMessage = useMemo(() => {
    const e = listQuery.error || detailQuery.error
    if (!(e instanceof Error)) return null
    return e.message
  }, [detailQuery.error, listQuery.error])

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="rounded-xl border border-white/10 bg-black/30 p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="font-display text-xl text-white">Admin</div>
            <div className="text-xs text-zinc-600">Connect your wallet to manage waitlist entries.</div>
            <div className="flex justify-center">
              <ConnectButton variant="gate" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="rounded-xl border border-white/10 bg-black/30 p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="font-display text-xl text-white">Admin</div>
            <div className="text-xs text-zinc-600">Sign in (no transaction) to verify admin access.</div>
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
            >
              {authBusy ? 'Signing in...' : 'Sign in'}
            </button>
            {authError ? <div className="text-[11px] text-red-400/90">{authError}</div> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="label">Admin</div>
          <h1 className="headline text-2xl sm:text-3xl">Waitlist</h1>
          <div className="text-xs text-zinc-600">Review waitlist entries and embedded wallet metadata.</div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
          onClick={() => {
            void listQuery.refetch()
            if (selectedId !== null) void detailQuery.refetch()
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email, wallet, referral code..."
            className="w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        <div className="text-[11px] text-zinc-600">{items.length} results</div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {errorMessage.includes('403') ? 'Admin only' : errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs text-zinc-600 flex items-center justify-between">
            <span>Signups</span>
            <span className="text-[11px]">{listQuery.isFetching ? 'Loading...' : 'Updated'}</span>
          </div>
          <div className="max-h-[560px] overflow-auto divide-y divide-white/10">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-600">No waitlist entries found.</div>
            ) : (
              items.map((item) => {
                const isActive = item.id === selectedId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isActive ? 'bg-brand-primary/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-zinc-200 truncate">{item.email}</div>
                      <div className="text-[11px] text-zinc-600">{formatDate(item.createdAt)}</div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                      <span>{item.persona ?? 'N/A'}</span>
                      <span>{shortAddr(item.primaryWallet || item.embeddedWallet || item.solanaWallet)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
          <div className="text-xs text-zinc-600">Details</div>
          {!detail ? (
            <div className="text-sm text-zinc-600">{selectedId ? 'Loading...' : 'Select a signup to view details.'}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Email</div>
                  <div className="text-zinc-200 break-all">{detail.email}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Persona</div>
                  <div className="text-zinc-200">{detail.persona ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Primary wallet</div>
                  <div className="text-zinc-200 break-all">{detail.primaryWallet ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Embedded wallet</div>
                  <div className="text-zinc-200 break-all">{detail.embeddedWallet ?? 'N/A'}</div>
                  {detail.embeddedWalletChain || detail.embeddedWalletClientType ? (
                    <div className="text-[11px] text-zinc-600">
                      {detail.embeddedWalletChain ?? 'N/A'} · {detail.embeddedWalletClientType ?? 'N/A'}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Solana wallet</div>
                  <div className="text-zinc-200 break-all">{detail.solanaWallet ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Base sub-account</div>
                  <div className="text-zinc-200 break-all">{detail.baseSubAccount ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Contact preference</div>
                  <div className="text-zinc-200">{detail.contactPreference ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Privy user</div>
                  <div className="text-zinc-200 break-all">{detail.privyUserId ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Referral code</div>
                  <div className="text-zinc-200">{detail.referralCode ?? 'N/A'}</div>
                  {detail.referredByCode ? <div className="text-[11px] text-zinc-600">Referred by {detail.referredByCode}</div> : null}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Has creator coin</div>
                  <div className="text-zinc-200">{detail.hasCreatorCoin === null ? 'N/A' : detail.hasCreatorCoin ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Farcaster FID</div>
                  <div className="text-zinc-200">{detail.farcasterFid ?? 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Profile completed</div>
                  <div className="text-zinc-200">{formatDate(detail.profileCompletedAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Referral claimed</div>
                  <div className="text-zinc-200">{formatDate(detail.referralClaimedAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Created</div>
                  <div className="text-zinc-200">{formatDate(detail.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Updated</div>
                  <div className="text-zinc-200">{formatDate(detail.updatedAt)}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-2">Verifications</div>
                {detail.verifications ? (
                  <pre className="rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-zinc-300 overflow-auto max-h-48">
                    {JSON.stringify(detail.verifications, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-zinc-600">N/A</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

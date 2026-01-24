import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'

import { ConnectButton } from '@/components/ConnectButton'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type PendingRequest = {
  id: number
  wallet: string
  coin: string | null
  createdAt: string
  allowlisted: boolean
}

type AdminListResponse = {
  admin: string
  pending: PendingRequest[]
}

type AllowlistedEntry = {
  address: string
  approvedAt: string | null
  approvedBy: string | null
  note: string | null
}

type AdminAllowlistResponse = {
  admin: string
  allowlist: AllowlistedEntry[]
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

async function fetchAdminList(): Promise<AdminListResponse> {
  const res = await apiFetch('/api/admin/creator-access/list', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminListResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load')
  if (!json.data) throw new Error('Missing data')
  return json.data
}

async function fetchAdminAllowlist(params: { q?: string | null }): Promise<AdminAllowlistResponse> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  const res = await apiFetch(`/api/admin/creator-access/allowlist?${qs.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminAllowlistResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load allowlist (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load allowlist')
  if (!json.data) throw new Error('Missing allowlist data')
  return json.data
}

async function approveRequest(params: { requestId: number; note?: string }): Promise<void> {
  const res = await apiFetch('/api/admin/creator-access/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!res.ok || !json) throw new Error(`Approve failed (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Approve failed')
}

async function denyRequest(params: { requestId: number; note?: string }): Promise<void> {
  const res = await apiFetch('/api/admin/creator-access/deny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!res.ok || !json) throw new Error(`Deny failed (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Deny failed')
}

async function revokeAddress(params: { address: string; note?: string }): Promise<void> {
  const res = await apiFetch('/api/admin/creator-access/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!res.ok || !json) throw new Error(`Revoke failed (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Revoke failed')
}

export function AdminCreatorAccess() {
  const { isConnected } = useAccount()
  const { isSignedIn, busy: authBusy, error: authError, signIn } = useSiweAuth()
  const qc = useQueryClient()

  const [notes, setNotes] = useState<Record<number, string>>({})
  const [allowlistNotes, setAllowlistNotes] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [allowlistQuery, setAllowlistQuery] = useState<string>('')

  const listQuery = useQuery({
    queryKey: ['adminCreatorAccessList'],
    enabled: isConnected && isSignedIn,
    queryFn: fetchAdminList,
    staleTime: 5_000,
    retry: 0,
  })

  const allowlistListQuery = useQuery({
    queryKey: ['adminCreatorAllowlist', allowlistQuery.trim().toLowerCase()],
    enabled: isConnected && isSignedIn,
    queryFn: () => fetchAdminAllowlist({ q: allowlistQuery.trim().length > 0 ? allowlistQuery.trim().toLowerCase() : null }),
    staleTime: 10_000,
    retry: 0,
  })

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => approveRequest({ requestId, note: notes[requestId] ?? undefined }),
    onSuccess: async () => {
      setFlash('Approved')
      setTimeout(() => setFlash(null), 2000)
      await qc.invalidateQueries({ queryKey: ['adminCreatorAccessList'] })
      await qc.invalidateQueries({ queryKey: ['creatorAllowlist'] })
      await qc.invalidateQueries({ queryKey: ['adminCreatorAllowlist'] })
    },
  })

  const denyMutation = useMutation({
    mutationFn: (requestId: number) => denyRequest({ requestId, note: notes[requestId] ?? undefined }),
    onSuccess: async () => {
      setFlash('Denied')
      setTimeout(() => setFlash(null), 2000)
      await qc.invalidateQueries({ queryKey: ['adminCreatorAccessList'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (address: string) => revokeAddress({ address, note: allowlistNotes[address] ?? undefined }),
    onSuccess: async () => {
      setFlash('Revoked')
      setTimeout(() => setFlash(null), 2000)
      await qc.invalidateQueries({ queryKey: ['adminCreatorAllowlist'] })
      await qc.invalidateQueries({ queryKey: ['creatorAllowlist'] })
    },
  })

  const isBusy =
    approveMutation.isPending ||
    denyMutation.isPending ||
    revokeMutation.isPending ||
    listQuery.isFetching ||
    allowlistListQuery.isFetching

  const pending = listQuery.data?.pending ?? []
  const pendingCount = pending.length
  const allowlisted = allowlistListQuery.data?.allowlist ?? []

  const errorMessage = useMemo(() => {
    const e = listQuery.error || allowlistListQuery.error
    if (!(e instanceof Error)) return null
    return e.message
  }, [allowlistListQuery.error, listQuery.error])

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
          <div className="rounded-xl border border-white/10 bg-black/30 p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="font-display text-xl text-white">Admin</div>
            <div className="text-xs text-zinc-600">Connect your wallet to manage creator access requests.</div>
            <div className="flex justify-center">
              <ConnectButton variant="gate" />
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
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
              {authBusy ? 'Signing in…' : 'Sign in'}
            </button>
            {authError ? <div className="text-[11px] text-red-400/90">{authError}</div> : null}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="label">Admin</div>
          <h1 className="headline text-2xl sm:text-3xl">Creator Access</h1>
          <div className="text-xs text-zinc-600">Approve / deny creator launch requests (SIWE + allowlist).</div>
        </div>
        <button
          type="button"
          onClick={() => void qc.invalidateQueries({ queryKey: ['adminCreatorAccessList'] })}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {flash ? <div className="text-xs text-emerald-300">{flash}</div> : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
          {errorMessage.includes('403') ? 'Admin only' : errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-white/10">
          <div className="text-sm text-zinc-200">Pending requests</div>
          <div className="text-[10px] text-zinc-600">{pendingCount} pending</div>
        </div>

        {listQuery.isLoading ? (
          <div className="px-5 py-8 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : pendingCount === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-600">No pending requests.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {pending.map((r) => (
              <div key={r.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.2fr_auto] gap-3 md:gap-4 items-start">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Wallet</div>
                  <div className="mono text-sm text-zinc-200 truncate">{r.wallet}</div>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Coin</div>
                  <div className="mono text-sm text-zinc-200 truncate">{r.coin ? r.coin : '—'}</div>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Note (optional)</div>
                  <input
                    className="w-full mt-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                    placeholder="Reason / context…"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {new Date(r.createdAt).toLocaleString()} · {r.allowlisted ? 'already allowlisted' : 'not allowlisted'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(r.id)}
                    disabled={approveMutation.isPending || denyMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/15 transition-colors disabled:opacity-60"
                    title={`Approve ${shortAddr(r.wallet)}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => denyMutation.mutate(r.id)}
                    disabled={approveMutation.isPending || denyMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15 transition-colors disabled:opacity-60"
                    title={`Deny ${shortAddr(r.wallet)}`}
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-white/10">
          <div className="text-sm text-zinc-200">Approved creators</div>
          <div className="text-[10px] text-zinc-600">{allowlisted.length} shown (max 200)</div>
        </div>

        <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-600">Search by address</div>
          <input
            className="w-full sm:w-[420px] bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
            placeholder="0x…"
            value={allowlistQuery}
            onChange={(e) => setAllowlistQuery(e.target.value)}
          />
        </div>

        {allowlistListQuery.isLoading ? (
          <div className="px-5 py-8 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : allowlisted.length === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-600">No approved creators found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {allowlisted.map((e) => (
              <div key={e.address} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1.2fr_auto] gap-3 md:gap-4 items-start">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Wallet</div>
                  <div className="mono text-sm text-zinc-200 truncate">{e.address}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {e.approvedAt ? new Date(e.approvedAt).toLocaleString() : '—'} · {e.approvedBy ? shortAddr(e.approvedBy) : '—'}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Note</div>
                  <input
                    className="w-full mt-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                    placeholder="Reason / context…"
                    value={allowlistNotes[e.address] ?? e.note ?? ''}
                    onChange={(ev) => setAllowlistNotes((prev) => ({ ...prev, [e.address]: ev.target.value }))}
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-zinc-600">Status</div>
                  <div className="text-sm text-emerald-200 mt-1">Approved</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(e.address)}
                    disabled={approveMutation.isPending || denyMutation.isPending || revokeMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15 transition-colors disabled:opacity-60"
                    title={`Revoke ${shortAddr(e.address)}`}
                  >
                    <XCircle className="w-4 h-4" />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



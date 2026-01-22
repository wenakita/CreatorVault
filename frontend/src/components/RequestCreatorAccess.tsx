import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Lock, MailQuestion, XCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { ConnectButton } from '@/components/ConnectButton'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type CreatorAccessStatus =
  | {
      address: string
      approved: boolean
      request:
        | null
        | {
            id: number
            coin: string | null
            status: 'pending' | 'approved' | 'denied'
            createdAt: string
            reviewedAt: string | null
            decisionNote: string | null
          }
    }
  | null

async function fetchCreatorAccessStatus(): Promise<CreatorAccessStatus> {
  const res = await apiFetch('/api/creator-access/status', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<CreatorAccessStatus> | null
  if (!res.ok || !json) throw new Error('Failed to load access status')
  if (!json.success) throw new Error(json.error || 'Failed to load access status')
  return json.data ?? null
}

async function requestCreatorAccess(params: { coin?: string | null }): Promise<{ status: 'approved' | 'pending' }> {
  const res = await apiFetch('/api/creator-access/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ coin: params.coin ?? undefined }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<{ status: 'approved' | 'pending' }> | null
  if (!res.ok || !json) throw new Error('Request failed')
  if (!json.success) throw new Error(json.error || 'Request failed')
  return json.data ?? { status: 'pending' }
}

export function RequestCreatorAccess({ coin }: { coin?: string | null }) {
  const { isConnected } = useAccount()
  const { isSignedIn, busy: authBusy, error: authError, signIn } = useSiweAuth()
  const qc = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['creatorAccessStatus'],
    enabled: isConnected && isSignedIn,
    queryFn: fetchCreatorAccessStatus,
    staleTime: 15_000,
    retry: 1,
  })

  const effectiveCoin = useMemo(() => {
    const c = typeof coin === 'string' && coin.trim().length > 0 ? coin.trim() : null
    return c && /^0x[a-fA-F0-9]{40}$/.test(c) ? c : null
  }, [coin])

  const requestMutation = useMutation({
    mutationFn: () => requestCreatorAccess({ coin: effectiveCoin }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['creatorAccessStatus'] })
      await qc.invalidateQueries({ queryKey: ['creatorAllowlist'] })
    },
  })

  useEffect(() => {
    if (!statusQuery.data?.approved) return
    void qc.invalidateQueries({ queryKey: ['creatorAllowlist'] })
  }, [qc, statusQuery.data?.approved])

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Lock className="w-4 h-4 text-zinc-400" />
          Invite-only launch
        </div>
        <div className="text-xs text-zinc-600">
          Connect your wallet to request creator access.
        </div>
        <ConnectButton />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <MailQuestion className="w-4 h-4 text-zinc-400" />
          Request access
        </div>
        <div className="text-xs text-zinc-600">
          Sign in (no transaction) to request creator access.
        </div>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={authBusy}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
        >
          {authBusy ? 'Signing in…' : 'Sign in'}
        </button>
        {authError ? <div className="text-[11px] text-red-400/90">{authError}</div> : null}
      </div>
    )
  }

  const approved = statusQuery.data?.approved === true
  const req = statusQuery.data?.request ?? null
  const pending = req?.status === 'pending'
  const denied = req?.status === 'denied'

  if (approved) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm text-emerald-200">
          <CheckCircle2 className="w-4 h-4" />
          Approved
        </div>
        <div className="text-xs text-emerald-200/70">
          This wallet is approved to launch Creator Vaults.
        </div>
      </div>
    )
  }

  if (pending) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Clock className="w-4 h-4 text-zinc-400" />
          Pending review
        </div>
        <div className="text-xs text-zinc-600">
          Your request is in the queue. We’ll approve you shortly.
        </div>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm text-red-200">
          <XCircle className="w-4 h-4" />
          Not approved
        </div>
        <div className="text-xs text-red-200/70">
          {req?.decisionNote ? req.decisionNote : 'Your request was not approved. You can request access again later.'}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm text-zinc-200">
        <MailQuestion className="w-4 h-4 text-zinc-400" />
        Request access
      </div>
      <div className="text-xs text-zinc-600">
        Creator Vault launches are invite-only during early access.
      </div>
      <button
        type="button"
        onClick={() => requestMutation.mutate()}
        disabled={requestMutation.isPending || statusQuery.isFetching}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg btn-accent px-5 py-3 text-sm"
      >
        {requestMutation.isPending ? 'Requesting…' : 'Request access'}
      </button>
      {requestMutation.error instanceof Error ? (
        <div className="text-[11px] text-red-400/90">{requestMutation.error.message}</div>
      ) : null}
    </div>
  )
}



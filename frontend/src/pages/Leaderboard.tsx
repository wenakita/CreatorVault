import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/apiBase'

type PointsType = 'invite' | 'total'

type LeaderboardRow = {
  rank: number
  signupId: number
  display: string
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
}

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: PointsType
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export function Leaderboard() {
  const [pointsType, setPointsType] = useState<PointsType>('invite')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  const title = pointsType === 'invite' ? 'Invite points' : 'Total points'

  useEffect(() => {
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        const res = await apiFetch(`/api/waitlist/leaderboard?pointsType=${encodeURIComponent(pointsType)}&page=1&limit=50`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const json = (await res.json().catch(() => null)) as ApiEnvelope<LeaderboardResponse> | null
        if (!res.ok || !json) throw new Error('Leaderboard request failed')
        if (!json.success || !json.data) throw new Error(json.error || 'Leaderboard request failed')
        setData(json.data)
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Leaderboard request failed')
        setData(null)
      } finally {
        setBusy(false)
      }
    })()
  }, [pointsType])

  const subtitle = useMemo(() => {
    void data
    return null
  }, [data])

  return (
    <section className="relative overflow-hidden bg-vault-bg text-white min-h-[calc(100vh-0px)]">
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-2">CreatorVaults</div>
            <div className="headline text-3xl sm:text-4xl leading-tight">Leaderboard</div>
            <div className="text-sm text-zinc-600 font-light mt-2">
              Points-based. Earn points by joining, inviting, and completing actions.
            </div>
            {subtitle ? <div className="text-[11px] text-zinc-700 mt-2">{subtitle}</div> : null}
          </div>
          <a className="btn-accent h-fit" href="/#waitlist">
            Invite friends
          </a>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              pointsType === 'invite' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/10 bg-black/30 text-zinc-600'
            }`}
            onClick={() => setPointsType('invite')}
            disabled={busy}
          >
            Invite points
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              pointsType === 'total' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/10 bg-black/30 text-zinc-600'
            }`}
            onClick={() => setPointsType('total')}
            disabled={busy}
          >
            Total points
          </button>
          <div className="text-[11px] text-zinc-700 ml-2">{busy ? 'Loading…' : title}</div>
        </div>

        {error ? (
          <div className="mt-6 text-xs text-red-400" role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-[10px] uppercase tracking-[0.24em] text-zinc-700">
            <div className="col-span-2">Rank</div>
            <div className="col-span-6">User</div>
            <div className="col-span-4 text-right">Points</div>
          </div>
          {data?.leaderboard?.length ? (
            <div>
              {data.leaderboard.map((r) => (
                <div key={`${r.rank}-${r.signupId}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
                  <div className="col-span-2 text-sm text-zinc-300">#{r.rank}</div>
                  <div className="col-span-6 text-sm text-zinc-200">
                    <div className="font-mono">{r.display}</div>
                    {r.referralCode ? <div className="text-[11px] text-zinc-700">code: {r.referralCode}</div> : null}
                  </div>
                  <div className="col-span-4 text-right text-sm text-zinc-200 tabular-nums">
                    {pointsType === 'invite' ? r.pointsInvite : r.pointsTotal}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-zinc-600">No ranked creators yet.</div>
          )}
        </div>
      </div>
    </section>
  )
}


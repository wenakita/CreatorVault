import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/apiBase'

type Period = 'weekly' | 'all_time'

type LeaderboardRow = {
  rank: number
  referralCode: string
  conversions: number
  primaryWallet: string | null
}

type LeaderboardResponse = {
  period: Period
  weekStartUtc?: string
  weekEndUtc?: string
  top: LeaderboardRow[]
  me?: { weeklyRank?: number | null; allTimeRank?: number | null } | null
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function shortAddr(a: string | null): string {
  if (!a) return '—'
  const s = String(a)
  if (!s.startsWith('0x') || s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>('weekly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  const title = period === 'weekly' ? 'This week' : 'All‑time'

  useEffect(() => {
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        const res = await apiFetch(`/api/referrals/leaderboard?period=${encodeURIComponent(period)}&limit=50`, {
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
  }, [period])

  const subtitle = useMemo(() => {
    if (!data) return null
    if (data.period !== 'weekly') return null
    if (!data.weekStartUtc || !data.weekEndUtc) return 'Resets weekly (UTC).'
    return `Week: ${new Date(data.weekStartUtc).toUTCString()} → ${new Date(data.weekEndUtc).toUTCString()}`
  }, [data])

  return (
    <section className="relative overflow-hidden bg-vault-bg text-white min-h-[calc(100vh-0px)]">
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-2">CreatorVaults</div>
            <div className="headline text-3xl sm:text-4xl leading-tight">Leaderboard</div>
            <div className="text-sm text-zinc-600 font-light mt-2">
              Converted invites only. Creator Coin required to rank.
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
              period === 'weekly' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/10 bg-black/30 text-zinc-600'
            }`}
            onClick={() => setPeriod('weekly')}
            disabled={busy}
          >
            This week
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              period === 'all_time' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/10 bg-black/30 text-zinc-600'
            }`}
            onClick={() => setPeriod('all_time')}
            disabled={busy}
          >
            All‑time
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
            <div className="col-span-6">Creator</div>
            <div className="col-span-4 text-right">Converted</div>
          </div>
          {data?.top?.length ? (
            <div>
              {data.top.map((r) => (
                <div key={`${r.rank}-${r.referralCode}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
                  <div className="col-span-2 text-sm text-zinc-300">#{r.rank}</div>
                  <div className="col-span-6 text-sm text-zinc-200">
                    <div className="font-mono">{shortAddr(r.primaryWallet)}</div>
                    <div className="text-[11px] text-zinc-700">code: {r.referralCode}</div>
                  </div>
                  <div className="col-span-4 text-right text-sm text-zinc-200">{r.conversions}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-zinc-600">No ranked creators yet.</div>
          )}
        </div>

        {data?.me ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">Your rank</div>
            <div className="text-sm text-zinc-300">
              {typeof data.me.weeklyRank === 'number' ? `#${data.me.weeklyRank} weekly` : '— weekly'} ·{' '}
              {typeof data.me.allTimeRank === 'number' ? `#${data.me.allTimeRank} all‑time` : '— all‑time'}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}


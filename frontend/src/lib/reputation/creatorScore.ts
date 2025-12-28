export type CreatorScoreSignals = {
  /** Onchain portfolio total (USD), typically via DeBank. */
  netWorthUsd?: number | null
}

export type CreatorScoreResult = {
  /** 0–100 (higher == stronger signal) */
  score: number
  /** Which signals were actually used to compute the score */
  sources: Array<'debank-networth'>
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Log-scaled score so whales don’t dominate:
 * - ~$100   → ~0
 * - ~$10k   → ~40
 * - ~$1M    → ~80
 * - ~$10M+  → ~100
 */
export function scoreFromNetWorthUsd(usd: number): number | null {
  if (!Number.isFinite(usd) || usd <= 0) return null
  const x = Math.log10(usd + 1) // [0..]
  const score = ((x - 2) / 5) * 100 // 10^2..10^7
  return clamp(score, 0, 100)
}

export function computeCreatorScore(signals: CreatorScoreSignals): CreatorScoreResult | null {
  const sources: CreatorScoreResult['sources'] = []

  const nwScore =
    typeof signals.netWorthUsd === 'number' && Number.isFinite(signals.netWorthUsd)
      ? scoreFromNetWorthUsd(signals.netWorthUsd)
      : null

  if (typeof nwScore === 'number') sources.push('debank-networth')

  if (sources.length === 0) return null

  // For now score is purely net worth-derived; we’ll add more weighted signals over time.
  return { score: nwScore ?? 0, sources }
}



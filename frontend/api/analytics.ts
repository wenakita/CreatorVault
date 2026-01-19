import { handleOptions, setCors } from './auth/_shared.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

type AnalyticsResponse = {
  vaults: Record<
    string,
    {
      address: string
      metrics: null
      latestSnapshot: null
      dailyStats: []
      historicalSnapshots: []
    }
  >
  syncStatus: Record<string, never>
  meta: {
    message: string
    generatedAt: string
  }
}

function getConfiguredVaults(): Record<string, string> {
  const out: Record<string, string> = {}
  const legacyKey = ['VITE', 'CHARM', 'VAULT', 'ADDRESS'].join('_')
  const v = process.env.CHARM_VAULT_ADDRESS ?? process.env[legacyKey]
  if (typeof v === 'string' && v.trim().length > 0) out.VAULT_1 = v.trim().toLowerCase()
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // This endpoint was originally backed by Prisma models (vaultSnapshot/dailyStats/syncStatus).
  // We intentionally ship it as a safe no-op in this repo so Vercel builds don’t depend on Prisma.
  const vaults = getConfiguredVaults()
  const vaultData: AnalyticsResponse['vaults'] = {}
  for (const [name, address] of Object.entries(vaults)) {
    vaultData[name] = { address, metrics: null, latestSnapshot: null, dailyStats: [], historicalSnapshots: [] }
  }

  // Cache for a short time (this is static/no-op data).
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  const message =
    Object.keys(vaults).length === 0
      ? 'No Charm vault configured.'
      : 'Vault analytics database is not configured in this deployment.'

  return res.status(200).json({
    success: true,
    data: {
      vaults: vaultData,
      syncStatus: {},
      meta: { message, generatedAt: new Date().toISOString() },
    } satisfies AnalyticsResponse,
  })
}

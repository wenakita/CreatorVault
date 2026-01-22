import type { VercelRequest, VercelResponse } from '@vercel/node'

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

// IMPORTANT:
// This file exists to make Vercel's bundler include our API handlers.
// Dynamic `import(\`../api_handlers/${subpath}.js\`)` will often *not* bundle the target modules,
// causing runtime 404s for routes like `/api/auth/nonce`.

type ApiHandlerModule = { default?: ApiHandler }

// Use static import() calls so Vercel's bundler can see dependencies,
// but avoid eager importing every handler at module-load time (which can crash the entire function).
export const apiRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'analytics': () => import('./analytics'),
  'agent/invokeSkill': () => import('./agent/invokeSkill'),

  'auth/admin': () => import('./auth/admin'),
  'auth/logout': () => import('./auth/logout'),
  'auth/me': () => import('./auth/me'),
  'auth/nonce': () => import('./auth/nonce'),
  'auth/verify': () => import('./auth/verify'),

  'creator-allowlist': () => import('./creator-allowlist'),
  'creator-access/debug': () => import('./creator-access/debug'),
  'creator-access/request': () => import('./creator-access/request'),
  'creator-access/status': () => import('./creator-access/status'),

  'debank/totalBalanceBatch': () => import('./debank/totalBalanceBatch'),
  'dexscreener/tokenStatsBatch': () => import('./dexscreener/tokenStatsBatch'),

  'deploy/session/cancel': () => import('./deploy/session/cancel'),
  'deploy/session/continue': () => import('./deploy/session/continue'),
  'deploy/session/create': () => import('./deploy/session/create'),
  'deploy/session/status': () => import('./deploy/session/status'),

  'farcaster/me': () => import('./farcaster/me'),
  'farcaster/nonce': () => import('./farcaster/nonce'),
  'farcaster/verify': () => import('./farcaster/verify'),

  'health': () => import('./health'),

  'onchain/coinMarketRewardsByCoin': () => import('./onchain/coinMarketRewardsByCoin'),
  'onchain/coinMarketRewardsCurrency': () => import('./onchain/coinMarketRewardsCurrency'),
  'onchain/coinTradeRewardsBatch': () => import('./onchain/coinTradeRewardsBatch'),
  'onchain/protocolRewardsClaimable': () => import('./onchain/protocolRewardsClaimable'),
  'onchain/protocolRewardsWithdrawn': () => import('./onchain/protocolRewardsWithdrawn'),

  'paymaster': () => import('./paymaster'),
  'revert-finance': () => import('./revert-finance'),

  'social/farcaster': () => import('./social/farcaster'),
  'social/talent': () => import('./social/talent'),
  'social/twitter': () => import('./social/twitter'),

  'status/protocolReport': () => import('./status/protocolReport'),
  'status/vaultReport': () => import('./status/vaultReport'),

  'sync-vault-data': () => import('./sync-vault-data'),
  'waitlist': () => import('./waitlist'),
  'webhook': () => import('./webhook'),

  'zora/coin': () => import('./zora/coin'),
  'zora/explore': () => import('./zora/explore'),
  'zora/profile': () => import('./zora/profile'),
  'zora/profileCoins': () => import('./zora/profileCoins'),
  'zora/topCreators': () => import('./zora/topCreators'),

  'admin/creator-access/allowlist': () => import('./admin/creator-access/allowlist'),
  'admin/creator-access/approve': () => import('./admin/creator-access/approve'),
  'admin/creator-access/deny': () => import('./admin/creator-access/deny'),
  'admin/creator-access/list': () => import('./admin/creator-access/list'),
  'admin/creator-access/note': () => import('./admin/creator-access/note'),
  'admin/creator-access/restore': () => import('./admin/creator-access/restore'),
  'admin/creator-access/revoke': () => import('./admin/creator-access/revoke'),
}

export async function getApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = apiRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}


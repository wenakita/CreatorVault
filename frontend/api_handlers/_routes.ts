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
  'analytics': () => import('./analytics.js'),
  'agent/invokeSkill': () => import('./agent/invokeSkill.js'),

  'auth/admin': () => import('./auth/admin.js'),
  'auth/logout': () => import('./auth/logout.js'),
  'auth/me': () => import('./auth/me.js'),
  'auth/nonce': () => import('./auth/nonce.js'),
  'auth/verify': () => import('./auth/verify.js'),

  'creator-allowlist': () => import('./creator-allowlist.js'),
  'creator-access/debug': () => import('./creator-access/debug.js'),
  'creator-access/request': () => import('./creator-access/request.js'),
  'creator-access/status': () => import('./creator-access/status.js'),

  'debank/totalBalanceBatch': () => import('./debank/totalBalanceBatch.js'),
  'dexscreener/tokenStatsBatch': () => import('./dexscreener/tokenStatsBatch.js'),

  'deploy/session/cancel': () => import('./deploy/session/cancel.js'),
  'deploy/session/continue': () => import('./deploy/session/continue.js'),
  'deploy/session/create': () => import('./deploy/session/create.js'),
  'deploy/session/status': () => import('./deploy/session/status.js'),

  'farcaster/me': () => import('./farcaster/me.js'),
  'farcaster/nonce': () => import('./farcaster/nonce.js'),
  'farcaster/verify': () => import('./farcaster/verify.js'),

  'health': () => import('./health.js'),

  'onchain/coinMarketRewardsByCoin': () => import('./onchain/coinMarketRewardsByCoin.js'),
  'onchain/coinMarketRewardsCurrency': () => import('./onchain/coinMarketRewardsCurrency.js'),
  'onchain/coinTradeRewardsBatch': () => import('./onchain/coinTradeRewardsBatch.js'),
  'onchain/protocolRewardsClaimable': () => import('./onchain/protocolRewardsClaimable.js'),
  'onchain/protocolRewardsWithdrawn': () => import('./onchain/protocolRewardsWithdrawn.js'),

  'paymaster': () => import('./paymaster.js'),
  'revert-finance': () => import('./revert-finance.js'),

  'social/farcaster': () => import('./social/farcaster.js'),
  'social/talent': () => import('./social/talent.js'),
  'social/twitter': () => import('./social/twitter.js'),

  'status/protocolReport': () => import('./status/protocolReport.js'),
  'status/vaultReport': () => import('./status/vaultReport.js'),

  'sync-vault-data': () => import('./sync-vault-data.js'),
  'referrals/click': () => import('./referrals/click.js'),
  'referrals/me': () => import('./referrals/me.js'),
  'referrals/leaderboard': () => import('./referrals/leaderboard.js'),
  'waitlist': () => import('./waitlist.js'),
  'webhook': () => import('./webhook.js'),

  'zora/coin': () => import('./zora/coin.js'),
  'zora/explore': () => import('./zora/explore.js'),
  'zora/profile': () => import('./zora/profile.js'),
  'zora/profileCoins': () => import('./zora/profileCoins.js'),
  'zora/topCreators': () => import('./zora/topCreators.js'),

  'admin/creator-access/allowlist': () => import('./admin/creator-access/allowlist.js'),
  'admin/creator-access/approve': () => import('./admin/creator-access/approve.js'),
  'admin/creator-access/deny': () => import('./admin/creator-access/deny.js'),
  'admin/creator-access/list': () => import('./admin/creator-access/list.js'),
  'admin/creator-access/note': () => import('./admin/creator-access/note.js'),
  'admin/creator-access/restore': () => import('./admin/creator-access/restore.js'),
  'admin/creator-access/revoke': () => import('./admin/creator-access/revoke.js'),
}

export async function getApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = apiRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}


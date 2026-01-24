import type { VercelRequest, VercelResponse } from '@vercel/node'

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

// IMPORTANT:
// This file exists to make Vercel's bundler include our API handlers.
// Dynamic `import(\`./${subpath}.js\`)` will often *not* bundle the target modules,
// causing runtime 404s for routes like `/api/auth/nonce`.

type ApiHandlerModule = { default?: ApiHandler }

// Use static import() calls so Vercel's bundler can see dependencies,
// but avoid eager importing every handler at module-load time (which can crash the entire function).
export const apiRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'analytics': () => import('./_analytics.js'),
  'agent/invokeSkill': () => import('./agent/_invokeSkill.js'),

  'auth/admin': () => import('./auth/_admin.js'),
  'auth/logout': () => import('./auth/_logout.js'),
  'auth/me': () => import('./auth/_me.js'),
  'auth/nonce': () => import('./auth/_nonce.js'),
  'auth/verify': () => import('./auth/_verify.js'),

  'creator-allowlist': () => import('./_creator-allowlist.js'),
  'creator-wallets/claim': () => import('./_creator-wallets-claim.js'),
  'creator-access/debug': () => import('./creator-access/_debug.js'),
  'creator-access/request': () => import('./creator-access/_request.js'),
  'creator-access/status': () => import('./creator-access/_status.js'),

  'debank/totalBalanceBatch': () => import('./debank/_totalBalanceBatch.js'),
  'dexscreener/tokenStatsBatch': () => import('./dexscreener/_tokenStatsBatch.js'),

  'deploy/session/cancel': () => import('./deploy/session/_cancel.js'),
  'deploy/session/continue': () => import('./deploy/session/_continue.js'),
  'deploy/session/create': () => import('./deploy/session/_create.js'),
  'deploy/session/status': () => import('./deploy/session/_status.js'),

  'farcaster/me': () => import('./farcaster/_me.js'),
  'farcaster/nonce': () => import('./farcaster/_nonce.js'),
  'farcaster/verify': () => import('./farcaster/_verify.js'),

  'health': () => import('./_health.js'),

  'onchain/coinMarketRewardsByCoin': () => import('./onchain/_coinMarketRewardsByCoin.js'),
  'onchain/coinMarketRewardsCurrency': () => import('./onchain/_coinMarketRewardsCurrency.js'),
  'onchain/coinTradeRewardsBatch': () => import('./onchain/_coinTradeRewardsBatch.js'),
  'onchain/protocolRewardsClaimable': () => import('./onchain/_protocolRewardsClaimable.js'),
  'onchain/protocolRewardsWithdrawn': () => import('./onchain/_protocolRewardsWithdrawn.js'),

  'paymaster': () => import('./_paymaster.js'),
  'revert-finance': () => import('./_revert-finance.js'),

  'social/farcaster': () => import('./social/_farcaster.js'),
  'social/talent': () => import('./social/_talent.js'),
  'social/twitter': () => import('./social/_twitter.js'),

  'status/protocolReport': () => import('./status/_protocolReport.js'),
  'status/vaultReport': () => import('./status/_vaultReport.js'),

  'sync-vault-data': () => import('./_sync-vault-data.js'),
  'referrals/click': () => import('./referrals/_click.js'),
  'referrals/me': () => import('./referrals/_me.js'),
  'referrals/leaderboard': () => import('./referrals/_leaderboard.js'),
  'waitlist': () => import('./_waitlist.js'),
  'waitlist/ledger': () => import('./waitlist/_ledger.js'),
  'waitlist/leaderboard': () => import('./waitlist/_leaderboard.js'),
  'waitlist/position': () => import('./waitlist/_position.js'),
  'waitlist/profile-complete': () => import('./waitlist/_profile-complete.js'),
  'waitlist/task-claim': () => import('./waitlist/_task-claim.js'),
  'webhook': () => import('./_webhook.js'),

  'zora/coin': () => import('./zora/_coin.js'),
  'zora/explore': () => import('./zora/_explore.js'),
  'zora/profile': () => import('./zora/_profile.js'),
  'zora/profileCoins': () => import('./zora/_profileCoins.js'),
  'zora/topCreators': () => import('./zora/_topCreators.js'),

  'admin/creator-access/allowlist': () => import('./admin/creator-access/_allowlist.js'),
  'admin/creator-access/approve': () => import('./admin/creator-access/_approve.js'),
  'admin/creator-access/deny': () => import('./admin/creator-access/_deny.js'),
  'admin/creator-access/list': () => import('./admin/creator-access/_list.js'),
  'admin/creator-access/note': () => import('./admin/creator-access/_note.js'),
  'admin/creator-access/restore': () => import('./admin/creator-access/_restore.js'),
  'admin/creator-access/revoke': () => import('./admin/creator-access/_revoke.js'),
}

export async function getApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = apiRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}

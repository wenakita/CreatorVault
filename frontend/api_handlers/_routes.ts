import type { VercelRequest, VercelResponse } from '@vercel/node'

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

// IMPORTANT:
// This file exists to make Vercel's bundler include our API handlers.
// Dynamic `import(\`../api_handlers/${subpath}.js\`)` will often *not* bundle the target modules,
// causing runtime 404s for routes like `/api/auth/nonce`.

import analytics from './analytics'
import agentInvokeSkill from './agent/invokeSkill'
import authAdmin from './auth/admin'
import authLogout from './auth/logout'
import authMe from './auth/me'
import authNonce from './auth/nonce'
import authVerify from './auth/verify'
import creatorAllowlist from './creator-allowlist'
import creatorAccessDebug from './creator-access/debug'
import creatorAccessRequest from './creator-access/request'
import creatorAccessStatus from './creator-access/status'
import debankTotalBalanceBatch from './debank/totalBalanceBatch'
import dexscreenerTokenStatsBatch from './dexscreener/tokenStatsBatch'
import deploySessionCancel from './deploy/session/cancel'
import deploySessionContinue from './deploy/session/continue'
import deploySessionCreate from './deploy/session/create'
import deploySessionStatus from './deploy/session/status'
import farcasterMe from './farcaster/me'
import farcasterNonce from './farcaster/nonce'
import farcasterVerify from './farcaster/verify'
import health from './health'
import onchainCoinMarketRewardsByCoin from './onchain/coinMarketRewardsByCoin'
import onchainCoinMarketRewardsCurrency from './onchain/coinMarketRewardsCurrency'
import onchainCoinTradeRewardsBatch from './onchain/coinTradeRewardsBatch'
import onchainProtocolRewardsClaimable from './onchain/protocolRewardsClaimable'
import onchainProtocolRewardsWithdrawn from './onchain/protocolRewardsWithdrawn'
import paymaster from './paymaster'
import revertFinance from './revert-finance'
import socialFarcaster from './social/farcaster'
import socialTalent from './social/talent'
import socialTwitter from './social/twitter'
import statusProtocolReport from './status/protocolReport'
import statusVaultReport from './status/vaultReport'
import syncVaultData from './sync-vault-data'
import waitlist from './waitlist'
import webhook from './webhook'
import zoraCoin from './zora/coin'
import zoraExplore from './zora/explore'
import zoraProfile from './zora/profile'
import zoraProfileCoins from './zora/profileCoins'
import zoraTopCreators from './zora/topCreators'

import adminCreatorAccessAllowlist from './admin/creator-access/allowlist'
import adminCreatorAccessApprove from './admin/creator-access/approve'
import adminCreatorAccessDeny from './admin/creator-access/deny'
import adminCreatorAccessList from './admin/creator-access/list'
import adminCreatorAccessNote from './admin/creator-access/note'
import adminCreatorAccessRestore from './admin/creator-access/restore'
import adminCreatorAccessRevoke from './admin/creator-access/revoke'

export const apiRoutes: Record<string, ApiHandler> = {
  'analytics': analytics,
  'agent/invokeSkill': agentInvokeSkill,
  'auth/admin': authAdmin,
  'auth/logout': authLogout,
  'auth/me': authMe,
  'auth/nonce': authNonce,
  'auth/verify': authVerify,
  'creator-allowlist': creatorAllowlist,
  'creator-access/debug': creatorAccessDebug,
  'creator-access/request': creatorAccessRequest,
  'creator-access/status': creatorAccessStatus,
  'debank/totalBalanceBatch': debankTotalBalanceBatch,
  'dexscreener/tokenStatsBatch': dexscreenerTokenStatsBatch,
  'deploy/session/cancel': deploySessionCancel,
  'deploy/session/continue': deploySessionContinue,
  'deploy/session/create': deploySessionCreate,
  'deploy/session/status': deploySessionStatus,
  'farcaster/me': farcasterMe,
  'farcaster/nonce': farcasterNonce,
  'farcaster/verify': farcasterVerify,
  'health': health,
  'onchain/coinMarketRewardsByCoin': onchainCoinMarketRewardsByCoin,
  'onchain/coinMarketRewardsCurrency': onchainCoinMarketRewardsCurrency,
  'onchain/coinTradeRewardsBatch': onchainCoinTradeRewardsBatch,
  'onchain/protocolRewardsClaimable': onchainProtocolRewardsClaimable,
  'onchain/protocolRewardsWithdrawn': onchainProtocolRewardsWithdrawn,
  'paymaster': paymaster,
  'revert-finance': revertFinance,
  'social/farcaster': socialFarcaster,
  'social/talent': socialTalent,
  'social/twitter': socialTwitter,
  'status/protocolReport': statusProtocolReport,
  'status/vaultReport': statusVaultReport,
  'sync-vault-data': syncVaultData,
  'waitlist': waitlist,
  'webhook': webhook,
  'zora/coin': zoraCoin,
  'zora/explore': zoraExplore,
  'zora/profile': zoraProfile,
  'zora/profileCoins': zoraProfileCoins,
  'zora/topCreators': zoraTopCreators,

  'admin/creator-access/allowlist': adminCreatorAccessAllowlist,
  'admin/creator-access/approve': adminCreatorAccessApprove,
  'admin/creator-access/deny': adminCreatorAccessDeny,
  'admin/creator-access/list': adminCreatorAccessList,
  'admin/creator-access/note': adminCreatorAccessNote,
  'admin/creator-access/restore': adminCreatorAccessRestore,
  'admin/creator-access/revoke': adminCreatorAccessRevoke,
}


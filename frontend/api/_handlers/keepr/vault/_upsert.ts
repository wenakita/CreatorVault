import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getSessionAddress } from '../../../../server/_lib/session.js'
import { computeConfigHash, type KeeprConfigV1, upsertKeeprVault } from '../../../../server/_lib/keeprRegistry.js'

type UpsertBody = {
  config?: KeeprConfigV1
}

type UpsertResponse = {
  vaultAddress: `0x${string}`
  groupId: string
  configHash: string
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const actor = getSessionAddress(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<UpsertBody>(req)) ?? {}
  const config = body?.config
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ success: false, error: 'Missing config' } satisfies ApiEnvelope<never>)
  }

  const owner = typeof config?.roles?.owner === 'string' ? config.roles.owner.trim() : ''
  const canonicalOwner = typeof config?.vault?.canonicalOwnerAddress === 'string' ? config.vault.canonicalOwnerAddress.trim() : ''
  const vaultAddress = typeof config?.vault?.vaultAddress === 'string' ? config.vault.vaultAddress.trim() : ''
  const groupId = typeof config?.xmtp?.groupId === 'string' ? config.xmtp.groupId.trim() : ''

  if (!isAddressLike(owner) || !isAddressLike(canonicalOwner) || !isAddressLike(vaultAddress) || !groupId) {
    return res.status(400).json({ success: false, error: 'Invalid config fields' } satisfies ApiEnvelope<never>)
  }

  if (owner.toLowerCase() !== canonicalOwner.toLowerCase()) {
    return res.status(400).json({ success: false, error: 'roles.owner must match vault.canonicalOwnerAddress' } satisfies ApiEnvelope<never>)
  }

  if (actor.toLowerCase() !== owner.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'OWNER authorization required' } satisfies ApiEnvelope<never>)
  }

  const chainId = Number(config?.chainId)
  if (chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'Unsupported chainId (expected 8453)' } satisfies ApiEnvelope<never>)
  }

  const configHash = computeConfigHash(config)
  const row = await upsertKeeprVault({ config, actorWallet: actor })

  return res.status(200).json({
    success: true,
    data: {
      vaultAddress: row.vaultAddress,
      groupId: row.groupId,
      configHash,
    } satisfies UpsertResponse,
  } satisfies ApiEnvelope<UpsertResponse>)
}


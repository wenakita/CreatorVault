import type { Address } from 'viem'

import { checkSharesEligibility } from '../_lib/keeprGating.js'
import { getKeeprVaultByGroupId, setKeeprJoinLocked } from '../_lib/keeprRegistry.js'

export type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type KeeprCommandResult =
  | { ok: true; response: string; action?: any }
  | { ok: false; response: string }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function roleForWallet(params: { wallet: Address; owner: Address; admins: Address[] }): KeeprRole {
  const w = params.wallet.toLowerCase()
  if (w === params.owner.toLowerCase()) return 'OWNER'
  if (params.admins.some((a) => a.toLowerCase() === w)) return 'ADMIN'
  return 'MEMBER'
}

function formatVaultStatus(v: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>): string {
  if (!v) {
    return [
      'Keepr status',
      '',
      '- configured: no',
      '- next: ask the creator to connect this group in CreatorVault',
    ].join('\n')
  }
  return [
    'Keepr status',
    '',
    '- configured: yes',
    '- vaultAddress: ' + v.vaultAddress,
    '- chainId: ' + String(v.chainId),
    '- groupId: ' + v.groupId,
    '- canonicalOwner: ' + v.canonicalOwnerAddress,
    '- gating:',
    '  - enabled: ' + String(v.gatingEnabled),
    '  - mode: ' + String(v.gatingMode),
    '  - joinLocked: ' + String(v.joinLocked),
    '  - minShares: ' + String(v.minShares ?? 'n/a'),
    '  - failClosed: ' + String(v.failClosed),
    '- configHash: ' + v.configHash,
  ].join('\n')
}

export async function handleKeeprCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
}): Promise<KeeprCommandResult> {
  const v = await getKeeprVaultByGroupId(params.groupId)
  if (!v) {
    // Allow basic commands to explain next steps even if not configured.
    const raw0 = (params.text ?? '').trim().toLowerCase()
    const looksLikeKeepr = raw0.startsWith('/keepr') || raw0.startsWith('keepr')
    const parts0 = raw0.split(/\s+/g).filter(Boolean)
    const cmd0 = looksLikeKeepr ? (parts0[1] ?? 'help') : ''
    if (cmd0 === 'help' || cmd0 === 'status' || cmd0 === 'rules') {
      return { ok: true, response: formatVaultStatus(null) }
    }
    return { ok: false, response: 'Keepr is not configured for this group.' }
  }

  const owner = v.canonicalOwnerAddress
  const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
  const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
  const role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })

  const raw = (params.text ?? '').trim()
  const prefix = raw.toLowerCase().startsWith('/keepr') ? '/keepr' : raw.toLowerCase().startsWith('keepr') ? 'keepr' : null
  if (!prefix) return { ok: false, response: '' }
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[0]?.toLowerCase() === prefix ? (parts[1] ? String(parts[1]).toLowerCase() : 'help') : 'help'
  const arg = parts[0]?.toLowerCase() === prefix ? (parts[2] ? String(parts[2]) : null) : null

  if (cmd === 'help') {
    return {
      ok: true,
      response: [
        'Keepr commands',
        '',
        'Tip: you can type with or without a leading slash.',
        '',
        '- keepr help',
        '- keepr status',
        '- keepr rules',
        '- keepr check',
        '- keepr check 0x... (ADMIN/OWNER)',
        '- keepr lock (OWNER)',
        '- keepr unlock (OWNER)',
        '- keepr sync (ADMIN/OWNER)',
      ].join('\n'),
    }
  }

  if (cmd === 'status') {
    return { ok: true, response: formatVaultStatus(v) }
  }

  if (cmd === 'rules') {
    return {
      ok: true,
      response: [
        'Keepr rules',
        '',
        '- joins:',
        '  - locked: ' + String(v.joinLocked),
        '- gating:',
        '  - enabled: ' + String(v.gatingEnabled),
        '  - mode: ' + String(v.gatingMode),
        '  - minShares: ' + String(v.minShares ?? 'n/a'),
        '  - failClosed: ' + String(v.failClosed),
      ].join('\n'),
    }
  }

  if (cmd === 'lock' || cmd === 'unlock') {
    if (role !== 'OWNER') {
      return { ok: false, response: 'Denied: OWNER only.' }
    }
    const joinLocked = cmd === 'lock'
    await setKeeprJoinLocked({ vaultAddress: v.vaultAddress, joinLocked, actorWallet: params.senderWallet })
    return {
      ok: true,
      response: joinLocked ? 'Joins locked.' : 'Joins unlocked.',
      action: {
        action: joinLocked ? 'keepr.vault.lock' : 'keepr.vault.unlock',
        vaultAddress: v.vaultAddress,
        groupId: v.groupId,
        reason: 'owner_command',
        evidence: { actor: params.senderWallet },
      },
    }
  }

  if (cmd === 'check') {
    const targetWallet = arg && isAddressLike(arg) ? (arg.toLowerCase() as Address) : params.senderWallet
    if (arg && targetWallet !== params.senderWallet && role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }

    if (!v.gatingEnabled || v.gatingMode === 'none') {
      return { ok: true, response: 'Eligible: yes\n- reason: gating_disabled' }
    }

    if (v.gatingMode !== 'shares') {
      return { ok: false, response: 'Unsupported gating mode.' }
    }

    const shareToken = v.shareTokenAddress
    const minShares = v.minShares
      ? (() => {
          try {
            return BigInt(v.minShares)
          } catch {
            return null
          }
        })()
      : null

    if (!shareToken || !minShares) {
      return { ok: false, response: 'Misconfigured: missing share token or minShares.' }
    }

    const r = await checkSharesEligibility({ wallet: targetWallet, shareToken, minShares })
    const eligible = r.eligible ? 'yes' : 'no'
    return {
      ok: true,
      response: [
        `Eligible: ${eligible}`,
        `- wallet: ${targetWallet}`,
        `- reason: ${r.reason}`,
        `- shareBalance: ${r.evidence.shareBalance}`,
        `- threshold: ${r.evidence.threshold}`,
        `- blockNumber: ${r.evidence.blockNumber ?? 'n/a'}`,
      ].join('\n'),
    }
  }

  if (cmd === 'sync') {
    if (role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }
    // The long-lived Keepr runtime performs sync (group.members -> check -> remove).
    return { ok: true, response: 'Sync requested. The Keepr runtime will process this shortly.' }
  }

  return { ok: false, response: 'Unknown command. Try `/keepr help`.' }
}


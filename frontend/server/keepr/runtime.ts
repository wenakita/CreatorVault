/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleKeeprCommand } from './commands.js'
import { ensureKeeprSchema } from '../_lib/keeprSchema.js'
import { getDb } from '../_lib/postgres.js'
import { enqueueKeeprAction, getKeeprVaultByGroupId, getKeeprVaultByVaultAddress } from '../_lib/keeprRegistry.js'
import { checkSharesEligibility, getKeeprBaseRpcUrls } from '../_lib/keeprGating.js'

type BaseQuickActionStyle = 'primary' | 'secondary' | 'danger'
type BaseQuickAction = {
  id: string
  label: string
  imageUrl?: string
  style?: BaseQuickActionStyle
  expiresAt?: string
}
type BaseQuickActionsContent = {
  id: string
  description: string
  actions: BaseQuickAction[]
  expiresAt?: string
}
type BaseIntentContent = {
  id: string
  actionId: string
  metadata?: Record<string, string | number | boolean | null>
}

// Base App custom content types (Quick Actions + Intent).
// We keep both a plain object form (for APIs that accept raw parts)
// and (optionally) a `ContentTypeId` class instance (preferred when available).
const BASE_ACTIONS_CT_PARTS = { authorityId: 'coinbase.com', typeId: 'actions', versionMajor: 1, versionMinor: 0 } as const
const BASE_INTENT_CT_PARTS = { authorityId: 'coinbase.com', typeId: 'intent', versionMajor: 1, versionMinor: 0 } as const
let BASE_ACTIONS_CT_ID: any | null = null
let BASE_INTENT_CT_ID: any | null = null

// Minimal process typing for serverless/edge-friendly TS configs.
// (We still run this file on Node, but avoid depending on full Node typings here.)
declare const process: {
  env: Record<string, string | undefined>
  argv?: string[]
  exit: (code?: number) => never
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const lastCommandAt = new Map<string, number>()
const lastSyncAt = new Map<string, number>()
const lastQuickActionsIdByConversationId = new Map<string, string>()

function getContentTypeParts(ct: any): { authorityId: string; typeId: string; versionMajor: number; versionMinor: number } | null {
  if (!ct) return null
  const authorityId = typeof ct.authorityId === 'string' ? ct.authorityId : typeof ct?.type?.authorityId === 'string' ? ct.type.authorityId : ''
  const typeId = typeof ct.typeId === 'string' ? ct.typeId : typeof ct?.type?.typeId === 'string' ? ct.type.typeId : ''
  const versionMajor =
    typeof ct.versionMajor === 'number' ? ct.versionMajor : typeof ct?.type?.versionMajor === 'number' ? ct.type.versionMajor : NaN
  const versionMinor =
    typeof ct.versionMinor === 'number' ? ct.versionMinor : typeof ct?.type?.versionMinor === 'number' ? ct.type.versionMinor : NaN
  if (!authorityId || !typeId || !Number.isFinite(versionMajor) || !Number.isFinite(versionMinor)) return null
  return { authorityId, typeId, versionMajor, versionMinor }
}

function isBaseQuickActionsContentType(ct: any): boolean {
  const p = getContentTypeParts(ct)
  return Boolean(p && p.authorityId === BASE_ACTIONS_CT_PARTS.authorityId && p.typeId === BASE_ACTIONS_CT_PARTS.typeId && p.versionMajor === 1 && p.versionMinor === 0)
}

function isBaseIntentContentType(ct: any): boolean {
  const p = getContentTypeParts(ct)
  return Boolean(p && p.authorityId === BASE_INTENT_CT_PARTS.authorityId && p.typeId === BASE_INTENT_CT_PARTS.typeId && p.versionMajor === 1 && p.versionMinor === 0)
}

async function sendTextSafe(params: { agent?: any; ctx: any; conversationId?: string | null; text: string }): Promise<void> {
  try {
    const { agent, ctx, conversationId, text } = params
    if (typeof ctx?.sendText === 'function') {
      await ctx.sendText(text)
      return
    }
    if (typeof ctx?.conversation?.send === 'function') {
      await ctx.conversation.send(text)
      return
    }
    // Base App message contexts sometimes omit `ctx.conversation`, but include `message.conversationId`.
    const cid =
      (conversationId ?? '').trim() ||
      String(ctx?.conversation?.id ?? '').trim() ||
      String(ctx?.message?.conversationId ?? '').trim() ||
      String((ctx as any)?.conversationId ?? '').trim() ||
      ''
    if (cid && agent) {
      const convo = await getGroupFromAgent(agent, cid)
      if (convo) {
        try {
          if (typeof convo.allow === 'function') await convo.allow()
        } catch {
          // ignore
        }
        try {
          if (typeof convo.sync === 'function') await convo.sync()
        } catch {
          // ignore
        }
        if (typeof convo.send === 'function') {
          await convo.send(text)
          return
        }
      }
    }
    console.warn('No send method available for message context', { hasConversation: Boolean(ctx?.conversation), hasAgent: Boolean(agent), cid })
  } catch (e) {
    console.error('Failed to send message', e)
  }
}

async function sendBaseQuickActionsSafe(params: {
  agent: any
  ctx: any
  conversationId: string
  content: BaseQuickActionsContent
}): Promise<void> {
  const { agent, ctx, conversationId, content } = params
  const cid = (conversationId ?? '').trim()
  if (!cid) return
  try {
    // Reuse the same "find conversation" path as sendTextSafe.
    const convo = await getGroupFromAgent(agent, cid)
    if (!convo) {
      await sendTextSafe({ agent, ctx, conversationId: cid, text: content.description })
      return
    }

    // Fallback string per Base App spec.
    const fallback = [
      content.description,
      '',
      ...content.actions.map((a, i) => `[${i + 1}] ${a.label}`),
      '',
      'Reply with the number to select',
    ].join('\n')

    // Prefer a ContentTypeId instance if available; fall back to parts.
    const contentTypeAny = (BASE_ACTIONS_CT_ID ?? BASE_ACTIONS_CT_PARTS) as any

    try {
      // Preferred path for custom content types in newer SDKs:
      // sendOptimistic(content, contentType) + publishMessages()
      if (typeof (convo as any).sendOptimistic === 'function') {
        ;(convo as any).sendOptimistic(content, contentTypeAny)
        if (typeof (convo as any).publishMessages === 'function') {
          await (convo as any).publishMessages()
        }
        console.log(
          'Sent Base Quick Actions',
          JSON.stringify({
            conversationId: cid,
            id: content.id,
            ct: BASE_ACTIONS_CT_ID ? 'ContentTypeId' : 'parts',
          }),
        )
        return
      }
    } catch {
      // fall through
    }

    try {
      // Alternate: send(content, { contentType, fallback })
      if (typeof convo.send === 'function') {
        await convo.send(content, { contentType: contentTypeAny, fallback })
        console.log(
          'Sent Base Quick Actions (send opts)',
          JSON.stringify({ conversationId: cid, id: content.id, ct: BASE_ACTIONS_CT_ID ? 'ContentTypeId' : 'parts' }),
        )
        return
      }
    } catch {
      // fall through
    }

    try {
      // Alternate: send(content, contentType)
      if (typeof convo.send === 'function') {
        await convo.send(content, contentTypeAny)
        console.log(
          'Sent Base Quick Actions (send direct)',
          JSON.stringify({ conversationId: cid, id: content.id, ct: BASE_ACTIONS_CT_ID ? 'ContentTypeId' : 'parts' }),
        )
        return
      }
    } catch {
      // fall through
    }

    // Last resort: plain text fallback
    await sendTextSafe({ agent, ctx, conversationId: cid, text: fallback })
  } catch (e) {
    console.error('Failed to send quick actions', e)
    await sendTextSafe({ agent, ctx, conversationId: cid, text: content.description })
  }
}

function extractSenderWallet(ctx: any): `0x${string}` | null {
  // Agent SDK context shape can vary across versions; be defensive.
  const candidate =
    (typeof ctx?.getSenderAddress === 'function' ? ctx.getSenderAddress() : null) ??
    ctx?.message?.senderAddress ??
    ctx?.message?.sender?.address ??
    ctx?.message?.sender?.accountIdentity?.identifier ??
    ctx?.message?.accountIdentity?.identifier ??
    ctx?.senderAddress ??
    ctx?.sender?.address ??
    ctx?.sender?.accountIdentity?.identifier

  const s = typeof candidate === 'string' ? candidate : candidate ? String(candidate) : ''
  const trimmed = s.trim()
  if (!trimmed.startsWith('0x') || trimmed.length !== 42) return null
  return trimmed.toLowerCase() as `0x${string}`
}

async function resolveSenderWalletFromConversation(agent: any, conversationId: string, senderInboxId: string): Promise<`0x${string}` | null> {
  if (!senderInboxId) return null
  const group = await getGroupFromAgent(agent, conversationId)
  if (!group) return null
  try {
    if (typeof group.sync === 'function') await group.sync()
  } catch {
    // ignore
  }
  try {
    const members = (await group.members?.()) as any[]
    for (const m of members ?? []) {
      const inboxId = String(m?.inboxId ?? '')
      if (!inboxId) continue
      if (inboxId.toLowerCase() !== senderInboxId.toLowerCase()) continue
      const id = m?.accountIdentity?.identifier ? String(m.accountIdentity.identifier) : ''
      if (id.startsWith('0x') && id.length === 42) return id.toLowerCase() as `0x${string}`
    }
  } catch {
    // ignore
  }
  return null
}

async function resolveInboxId(client: any, wallet: `0x${string}`): Promise<string | null> {
  // The Node SDK exposes `findInboxIdByIdentities`. Agent SDK wraps a client with similar helpers.
  // We try a few shapes to keep this runtime resilient across SDK versions.
  try {
    if (typeof client?.findInboxIdByIdentities === 'function') {
      const ids = await client.findInboxIdByIdentities([{ identifier: wallet, identifierKind: 'Ethereum' }])
      const first = Array.isArray(ids) ? ids[0] : null
      return typeof first === 'string' && first ? first : null
    }
  } catch {
    // ignore
  }

  try {
    if (typeof client?.findInboxIdByIdentifier === 'function') {
      const id = await client.findInboxIdByIdentifier(wallet)
      return typeof id === 'string' && id ? id : null
    }
  } catch {
    // ignore
  }

  return null
}

async function getGroupFromAgent(agent: any, groupId: string): Promise<any | null> {
  try {
    if (typeof agent?.client?.conversations?.getConversationById === 'function') {
      return await agent.client.conversations.getConversationById(groupId)
    }
  } catch {
    // ignore
  }
  try {
    if (typeof agent?.client?.conversations?.getGroupById === 'function') {
      return await agent.client.conversations.getGroupById(groupId)
    }
  } catch {
    // ignore
  }
  return null
}

async function ensureGroupPolicyAndAdmins(agent: any, groupId: string): Promise<void> {
  const vault = await getKeeprVaultByGroupId(groupId)
  if (!vault) return
  const group = await getGroupFromAgent(agent, groupId)
  if (!group) return

  // Best-effort: lock down who can add members.
  try {
    if (typeof group.updateAddMemberPermission === 'function') {
      try {
        await group.updateAddMemberPermission('AdminOnly')
      } catch {
        try {
          await group.updateAddMemberPermission('admin_only')
        } catch {
          await group.updateAddMemberPermission({ permission: 'admin_only' })
        }
      }
    }
  } catch {
    // ignore
  }

  // Best-effort: ensure removes are admin-only too (defense-in-depth).
  try {
    if (typeof group.updateRemoveMemberPermission === 'function') {
      try {
        await group.updateRemoveMemberPermission('AdminOnly')
      } catch {
        try {
          await group.updateRemoveMemberPermission('admin_only')
        } catch {
          await group.updateRemoveMemberPermission({ permission: 'admin_only' })
        }
      }
    }
  } catch {
    // ignore
  }

  // Best-effort: keep group metadata changes restricted (optional, but reduces chaos).
  try {
    if (typeof group.updateGroupMetadataPermission === 'function') {
      try {
        await group.updateGroupMetadataPermission('AdminOnly')
      } catch {
        try {
          await group.updateGroupMetadataPermission('admin_only')
        } catch {
          await group.updateGroupMetadataPermission({ permission: 'admin_only' })
        }
      }
    }
  } catch {
    // ignore
  }

  // Best-effort: ensure the canonical owner is an admin in the group.
  try {
    if (typeof group.listAdmins === 'function' && typeof group.addAdmin === 'function') {
      const admins = await group.listAdmins()
      const ownerInboxId = await resolveInboxId(agent.client, vault.canonicalOwnerAddress)
      if (ownerInboxId) {
        const isAlready = Array.isArray(admins) && admins.some((a: any) => String(a).toLowerCase() === ownerInboxId.toLowerCase())
        if (!isAlready) {
          await group.addAdmin(ownerInboxId)
        }
      }
    }
  } catch {
    // ignore
  }
}

async function executeAction(agent: any, action: any): Promise<void> {
  const kind = String(action?.action ?? '')
  const groupId = String(action?.groupId ?? '')
  const wallet = String(action?.wallet ?? '').toLowerCase() as `0x${string}`
  if (!kind || !groupId) throw new Error('invalid_action')

  const group = await getGroupFromAgent(agent, groupId)
  if (!group) throw new Error('group_not_found')

  await ensureGroupPolicyAndAdmins(agent, groupId)

  if (kind === 'xmtp.group.add_member') {
    const inboxId = await resolveInboxId(agent.client, wallet)
    if (!inboxId) throw new Error('inbox_id_not_found')

    // Idempotency: if they're already a member, treat as success.
    try {
      if (typeof group.members === 'function') {
        const members = (await group.members()) as any[]
        const already = (members ?? []).some((m: any) => String(m?.inboxId ?? '').toLowerCase() === inboxId.toLowerCase())
        if (already) return
      }
    } catch {
      // ignore
    }

    await group.addMembers([inboxId])
    return
  }

  if (kind === 'xmtp.group.remove_member') {
    const inboxId = await resolveInboxId(agent.client, wallet)
    if (!inboxId) throw new Error('inbox_id_not_found')
    await group.removeMembers([inboxId])
    return
  }

  throw new Error('unsupported_action')
}

async function processPendingActions(agent: any): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  const res = await db.sql`
    SELECT id, action
    FROM keepr_actions
    WHERE status IN ('pending', 'retry')
      AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
    ORDER BY created_at ASC
    LIMIT 25;
  `

  for (const row of res.rows ?? []) {
    const id = Number((row as any).id)
    const action = (row as any).action
    if (!Number.isFinite(id) || id <= 0) continue

    // Claim the action (prevents duplicate execution if multiple loops overlap).
    try {
      const claimed = await db.sql`
        UPDATE keepr_actions
          SET status = 'executing', updated_at = NOW()
        WHERE id = ${id}
          AND status IN ('pending', 'retry')
        RETURNING id;
      `
      if (!claimed.rows?.[0]?.id) continue
    } catch {
      // If we can't claim, skip.
      continue
    }

    try {
      await executeAction(agent, action)
      await db.sql`UPDATE keepr_actions SET status = 'executed', executed_at = NOW(), updated_at = NOW(), last_error = NULL WHERE id = ${id};`
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'action_failed'

      // Special case: user has not yet created an XMTP inbox (common).
      if (msg === 'inbox_id_not_found') {
        await db.sql`
          UPDATE keepr_actions
            SET status = 'needs_user_setup',
                updated_at = NOW(),
                last_error = ${msg},
                attempt_count = attempt_count + 1
          WHERE id = ${id};
        `
        continue
      }

      // Retry a few times for transient failures.
      const transient =
        msg.includes('h2 protocol error') ||
        msg.includes('timeout') ||
        msg.includes('rate') ||
        msg === 'group_not_found' ||
        msg === 'action_failed'
      if (transient) {
        // Exponential backoff: 10s, 30s, 90s, 270s, 810s
        const attemptRes = await db.sql`SELECT attempt_count FROM keepr_actions WHERE id = ${id} LIMIT 1;`
        const attempt = Number((attemptRes.rows?.[0] as any)?.attempt_count ?? 0)
        const nextDelaySeconds = Math.min(810, Math.max(10, 10 * Math.pow(3, attempt)))
        await db.sql`
          UPDATE keepr_actions
            SET status = 'retry',
                updated_at = NOW(),
                last_error = ${msg},
                attempt_count = attempt_count + 1,
                next_attempt_at = NOW() + (${nextDelaySeconds} || '0') * INTERVAL '1 second'
          WHERE id = ${id};
        `
        continue
      }

      await db.sql`UPDATE keepr_actions SET status = 'failed', updated_at = NOW(), last_error = ${msg}, attempt_count = attempt_count + 1 WHERE id = ${id};`
    }
  }
}

async function runSyncForGroup(agent: any, groupId: string): Promise<void> {
  const vault = await getKeeprVaultByGroupId(groupId)
  if (!vault) return
  if (!vault.gatingEnabled || vault.gatingMode !== 'shares') return
  if (!vault.shareTokenAddress || !vault.minShares) return

  let minShares: bigint
  try {
    minShares = BigInt(vault.minShares)
  } catch {
    return
  }

  const group = await getGroupFromAgent(agent, groupId)
  if (!group) return

  const maxPerBatch =
    typeof vault.config?.rateLimits?.syncMaxMembersPerBatch === 'number' && Number.isFinite(vault.config.rateLimits.syncMaxMembersPerBatch)
      ? Math.max(1, Math.floor(vault.config.rateLimits.syncMaxMembersPerBatch))
      : 25

  await ensureGroupPolicyAndAdmins(agent, groupId)

  try {
    if (typeof group.sync === 'function') await group.sync()
  } catch {
    // ignore
  }

  const members = (await group.members()) as any[]
  let processed = 0
  for (const m of members ?? []) {
    if (processed >= maxPerBatch) break
    const inboxId = String(m?.inboxId ?? '')
    const accountIdentity = m?.accountIdentity
    const wallet = accountIdentity?.identifier ? String(accountIdentity.identifier).toLowerCase() : ''
    if (!inboxId || !wallet.startsWith('0x') || wallet.length !== 42) continue
    processed++

    const r1 = await checkSharesEligibility({
      wallet: wallet as any,
      shareToken: vault.shareTokenAddress as any,
      minShares,
    })
    if (r1.eligible) continue

    // Fail-safe removals: require a second consecutive check before removing.
    const urls = getKeeprBaseRpcUrls()
    const remaining = r1.evidence.rpcUrl ? urls.filter((u) => u !== r1.evidence.rpcUrl) : urls
    const r2 = await checkSharesEligibility({
      wallet: wallet as any,
      shareToken: vault.shareTokenAddress as any,
      minShares,
      rpcUrls: remaining.slice(0, 3),
    })
    if (r2.eligible) continue

    try {
      await group.removeMembers([inboxId])
    } catch {
      // ignore
    }

    // Small delay to avoid bursty RPC/network usage.
    await sleep(250)
  }

  try {
    const db = await getDb()
    if (db) {
      await ensureKeeprSchema()
      await db.sql`UPDATE keepr_vaults SET last_sync_at = NOW(), updated_at = NOW() WHERE group_id = ${groupId};`
    }
  } catch {
    // ignore
  }
}

async function processJoinRequests(agent: any): Promise<void> {
  const db = await getDb()
  if (!db) return
  await ensureKeeprSchema()

  // Pull a small batch of wallets we're watching.
  const res = await db.sql`
    SELECT id, vault_address, group_id, wallet_address
    FROM keepr_join_requests
    WHERE status = 'watching'
      AND (next_check_at IS NULL OR next_check_at <= NOW())
    ORDER BY updated_at ASC
    LIMIT 25;
  `

  for (const row of res.rows ?? []) {
    const reqId = Number((row as any).id)
    const vaultAddress = String((row as any).vault_address ?? '').toLowerCase() as `0x${string}`
    const wallet = String((row as any).wallet_address ?? '').toLowerCase() as `0x${string}`
    if (!reqId || !vaultAddress.startsWith('0x') || !wallet.startsWith('0x')) continue

    const vault = await getKeeprVaultByVaultAddress(vaultAddress)
    if (!vault) {
      await db.sql`
        UPDATE keepr_join_requests
          SET status = 'failed',
              last_reason = 'vault_not_registered',
              updated_at = NOW()
        WHERE id = ${reqId};
      `
      continue
    }

    // Only shares mode is supported for auto-add right now.
    if (!vault.gatingEnabled || vault.gatingMode === 'none') {
      const action = {
        action: 'xmtp.group.add_member',
        groupId: vault.groupId,
        wallet,
        reason: 'gating_disabled',
        evidence: { blockNumber: null },
      }
      const dedupeKey = `join:add_member:${vaultAddress}:${vault.groupId}:${wallet}`
      const { id: actionId } = await enqueueKeeprAction({
        vaultAddress,
        groupId: vault.groupId,
        action,
        actionType: 'xmtp.group.add_member',
        dedupeKey,
      })
      await db.sql`
        UPDATE keepr_join_requests
          SET status = 'queued',
              action_id = ${actionId},
              last_reason = 'queued',
              last_checked_at = NOW(),
              next_check_at = NULL,
              updated_at = NOW()
        WHERE id = ${reqId};
      `
      continue
    }

    if (vault.gatingMode !== 'shares' || !vault.shareTokenAddress || !vault.minShares) {
      await db.sql`
        UPDATE keepr_join_requests
          SET status = 'failed',
              last_reason = 'unsupported_gating_mode',
              updated_at = NOW()
        WHERE id = ${reqId};
      `
      continue
    }

    let minShares: bigint | null = null
    try {
      minShares = BigInt(vault.minShares)
    } catch {
      minShares = null
    }
    if (!minShares) {
      await db.sql`
        UPDATE keepr_join_requests
          SET status = 'failed',
              last_reason = 'vault_misconfigured',
              updated_at = NOW()
        WHERE id = ${reqId};
      `
      continue
    }

    // Same quorum strategy as join endpoint (fail-closed behavior respected).
    const r1 = await checkSharesEligibility({ wallet: wallet as any, shareToken: vault.shareTokenAddress as any, minShares })
    const urls = getKeeprBaseRpcUrls()
    const remaining = r1.evidence.rpcUrl ? urls.filter((u) => u !== r1.evidence.rpcUrl) : urls
    const r2 = await checkSharesEligibility({
      wallet: wallet as any,
      shareToken: vault.shareTokenAddress as any,
      minShares,
      rpcUrls: remaining.slice(0, 3),
    })
    const eligible = Boolean(r1.eligible && r2.eligible)

    if (!eligible) {
      const verificationFailed = (r1.reason === 'onchain_read_failed' || r2.reason === 'onchain_read_failed') && vault.failClosed
      const delay = verificationFailed ? 120 : 300
      await db.sql`
        UPDATE keepr_join_requests
          SET last_reason = ${verificationFailed ? 'verification_failed' : 'ineligible'},
              last_checked_at = NOW(),
              next_check_at = NOW() + (${delay} || '0') * INTERVAL '1 second',
              updated_at = NOW()
        WHERE id = ${reqId};
      `
      continue
    }

    const action = {
      action: 'xmtp.group.add_member',
      groupId: vault.groupId,
      wallet,
      reason: 'auto_eligible',
      evidence: { primary: r1.evidence, secondary: r2.evidence },
    }
    const dedupeKey = `join:add_member:${vaultAddress}:${vault.groupId}:${wallet}`
    const { id: actionId } = await enqueueKeeprAction({
      vaultAddress,
      groupId: vault.groupId,
      action,
      actionType: 'xmtp.group.add_member',
      dedupeKey,
    })

    await db.sql`
      UPDATE keepr_join_requests
        SET status = 'queued',
            action_id = ${actionId},
            last_reason = 'queued',
            last_checked_at = NOW(),
            next_check_at = NULL,
            updated_at = NOW()
      WHERE id = ${reqId};
    `
  }
}

export async function startKeeprRuntime(): Promise<void> {
  console.log('Keepr booting...')
  console.log('env:', {
    XMTP_ENV: process.env.XMTP_ENV ?? null,
    hasWalletKey: Boolean((process.env.XMTP_WALLET_KEY ?? '').trim()),
    hasDbKey: Boolean((process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()),
    XMTP_DB_PATH: (process.env.XMTP_DB_PATH ?? '').trim() || null,
    hasDatabaseUrl: Boolean((process.env.DATABASE_URL ?? '').trim()),
  })

  const { Agent } = await import('@xmtp/agent-sdk')
  const { filter } = await import('@xmtp/agent-sdk')

  console.log('XMTP SDK imported. Creating agent from env...')

  async function allowAndSyncConversation(conversation: any, label: string): Promise<void> {
    if (!conversation) return
    try {
      if (typeof conversation.allow === 'function') {
        await conversation.allow()
      }
    } catch (e) {
      console.warn('Failed to allow conversation', label, e)
    }
    try {
      if (typeof conversation.sync === 'function') {
        await conversation.sync()
      }
    } catch (e) {
      console.warn('Failed to sync conversation', label, e)
    }
  }

  async function warmupAllowedConversations(agent: any): Promise<void> {
    // Consent is the #1 reason agents "don't respond": many clients only stream
    // events for conversations in the "Allowed" state.
    //
    // The `group` / `dm` events only fire for new conversations. If Keepr was
    // invited earlier (before this runtime booted), we still need to allow/sync
    // existing conversations so message events start flowing.
    const conversationsApi = agent?.client?.conversations
    if (!conversationsApi) return

    const candidates: any[] = []
    const tryList = async (fnName: string, args: any[] = []): Promise<void> => {
      try {
        const fn = conversationsApi?.[fnName]
        if (typeof fn !== 'function') return
        const res = await fn.apply(conversationsApi, args)
        if (Array.isArray(res)) {
          candidates.push(...res)
          return
        }
        if (res && Array.isArray((res as any).conversations)) candidates.push(...(res as any).conversations)
        if (res && Array.isArray((res as any).items)) candidates.push(...(res as any).items)
      } catch {
        // ignore; SDK surface varies by version
      }
    }

    // Best-effort across SDK versions.
    await tryList('list')
    await tryList('list', [{ limit: 50 }])
    await tryList('listConversations')
    await tryList('listConversations', [{ limit: 50 }])
    await tryList('getConversations')
    await tryList('getConversations', [{ limit: 50 }])
    await tryList('listGroups')
    await tryList('listDms')

    const seen = new Set<string>()
    let allowed = 0
    for (const c of candidates) {
      const id = String(c?.id ?? c?.conversationId ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      await allowAndSyncConversation(c, id)
      allowed++
      if (allowed >= 50) break
    }

    console.log('Warmup complete. Conversations processed:', allowed)
  }

  // If something hangs here, we want logs that prove where.
  try {
    ;(globalThis as any)?.setTimeout?.(() => {
      console.warn('Still creating XMTP agent... (15s)')
    }, 15_000)
  } catch {
    // ignore
  }

  const agent = await Agent.createFromEnv({
    env: (process.env.XMTP_ENV as any) ?? 'production',
    // IMPORTANT: keep this path persistent across restarts/deploys.
    // If missing, the Agent SDK may default to '/', which is not ideal locally.
    dbPath: (process.env.XMTP_DB_PATH ?? '').trim() || undefined,
  })

  // Register Base App-specific content types so we can send/receive Quick Actions.
  try {
    // Use the package's public export (avoid importing non-exported internal paths).
    const primitives: any = await import('@xmtp/content-type-primitives')
    const ContentTypeId: any = primitives?.ContentTypeId
    if (typeof ContentTypeId === 'function' && typeof agent?.client?.registerCodec === 'function') {
      const actionsType = new ContentTypeId(BASE_ACTIONS_CT_PARTS)
      const intentType = new ContentTypeId(BASE_INTENT_CT_PARTS)
      BASE_ACTIONS_CT_ID = actionsType
      BASE_INTENT_CT_ID = intentType
      const enc = new TextEncoder()
      const dec = new TextDecoder()

      const actionsCodec = {
        contentType: actionsType,
        encode: (content: BaseQuickActionsContent) => {
          const json = JSON.stringify(content)
          return { type: actionsType, parameters: {}, content: enc.encode(json), fallback: actionsCodec.fallback(content) }
        },
        decode: (encoded: any) => JSON.parse(dec.decode(encoded.content)),
        fallback: (content: BaseQuickActionsContent) => {
          const lines = [content.description, '', ...content.actions.map((a, i) => `[${i + 1}] ${a.label}`), '', 'Reply with the number to select']
          return lines.join('\n')
        },
        shouldPush: () => true,
      }

      const intentCodec = {
        contentType: intentType,
        encode: (content: BaseIntentContent) => {
          const json = JSON.stringify(content)
          return { type: intentType, parameters: {}, content: enc.encode(json), fallback: intentCodec.fallback(content) }
        },
        decode: (encoded: any) => JSON.parse(dec.decode(encoded.content)),
        fallback: (content: BaseIntentContent) => `User selected action: ${content.actionId}`,
        shouldPush: () => true,
      }

      agent.client.registerCodec(actionsCodec)
      agent.client.registerCodec(intentCodec)
      console.log('Registered Base App content types: coinbase.com/actions, coinbase.com/intent')
    } else {
      console.warn('Base App codec registration skipped (missing registerCodec or ContentTypeId)')
    }
  } catch (e) {
    console.warn('Failed to register Base App content types (quick actions)', e)
  }

  try {
    console.log('Keepr agent created:', { address: agent.address })
  } catch {
    // ignore
  }

  agent.on('start', () => {
    try {
      console.log('Keepr runtime started')
      console.log('XMTP env:', process.env.XMTP_ENV)
      console.log('Agent address:', agent.address)
    } catch {
      // ignore
    }
  })

  agent.on('unhandledError', (error: any) => {
    console.error('Keepr unhandledError', error)
  })

  agent.on('group', async (ctx: any) => {
    // Received when the agent is added to a group.
    try {
      const cid = String(ctx?.conversation?.id ?? '')
      console.log('Added to group:', cid)

      // IMPORTANT: Consent.
      // Many SDK flows only stream messages for conversations that are "Allowed".
      // Auto-allow group invites so we actually receive message events.
      try {
        if (typeof ctx?.conversation?.allow === 'function') {
          await ctx.conversation.allow()
        }
      } catch (e) {
        console.warn('Failed to allow group conversation', cid, e)
      }

      // Sync group state so the agent sees subsequent messages quickly.
      try {
        if (typeof ctx?.conversation?.sync === 'function') {
          await ctx.conversation.sync()
        }
      } catch (e) {
        console.warn('Failed to sync group conversation', cid, e)
      }

      // Dev-only signal so you can confirm the agent can post into the group.
      await sendTextSafe({ agent, ctx, conversationId: String(ctx?.conversation?.id ?? ''), text: "Keepr online. Try `keepr help`." })
    } catch {
      // ignore
    }
  })

  agent.on('dm', async (ctx: any) => {
    // Received when a DM is created.
    try {
      const cid = String(ctx?.conversation?.id ?? '')
      console.log('New dm created:', cid)
      try {
        if (typeof ctx?.conversation?.allow === 'function') {
          await ctx.conversation.allow()
        }
      } catch (e) {
        console.warn('Failed to allow dm conversation', cid, e)
      }
      try {
        if (typeof ctx?.conversation?.sync === 'function') {
          await ctx.conversation.sync()
        }
      } catch (e) {
        console.warn('Failed to sync dm conversation', cid, e)
      }
    } catch {
      // ignore
    }
  })

  async function maybeHandleKeeprCommand(ctx: any): Promise<void> {
    const msgId = String(ctx?.message?.id ?? '').trim()
    if (msgId) {
      const now = Date.now()
      ;(maybeHandleKeeprCommand as any)._seen = (maybeHandleKeeprCommand as any)._seen ?? new Map<string, number>()
      const seen: Map<string, number> = (maybeHandleKeeprCommand as any)._seen
      const last = seen.get(msgId) ?? 0
      if (now - last < 30_000) return
      seen.set(msgId, now)
      // tiny cleanup
      if (seen.size > 500) {
        for (const [k, t] of seen) {
          if (now - t > 60_000) seen.delete(k)
        }
      }
    }

    const raw = String(ctx?.message?.content ?? '')
    const text = raw.trim()
    // Accept either "/keepr ..." or "keepr ..." (some clients strip leading slash).
    const looksLikeKeepr = text.startsWith('/keepr') || text.toLowerCase().startsWith('keepr')
    // Debug signal: if the message mentions keepr but isn't matched, log it.
    const mentionsKeepr = text.toLowerCase().includes('keepr')
    if (!looksLikeKeepr) {
      if (mentionsKeepr) {
        try {
          console.log('Saw message mentioning keepr but not a command:', JSON.stringify({ content: raw }))
        } catch {
          // ignore
        }
      }
      return
    }

    // Agent SDK normalizes this as `ctx.conversation.id` for both DMs and groups.
    // Base Chat groups will populate this field; relying on `conversationId/groupId` is brittle.
    const groupId = String(
      ctx?.conversation?.id ??
        (ctx as any)?.conversationId ??
        (ctx as any)?.groupId ??
        ctx?.message?.conversationId ??
        ctx?.message?.conversationID ??
        '',
    ).trim()
    if (!groupId) return

    // Parse the command early so we can handle "help" even without sender identity.
    const parts = text.split(/\s+/g).filter(Boolean)
    const cmd = parts[0]?.toLowerCase() === '/keepr' || parts[0]?.toLowerCase() === 'keepr' ? (parts[1]?.toLowerCase() ?? 'help') : 'help'
    const senderlessOk = cmd === 'help' || cmd === 'status' || cmd === 'rules'

    let senderWallet = extractSenderWallet(ctx)
    let senderInboxId = ''
    if (!senderWallet) {
      const cand =
        (ctx?.message as any)?.senderInboxId ??
        (ctx?.message as any)?.sender?.inboxId ??
        (ctx?.message as any)?.senderInboxID ??
        (ctx?.message as any)?.sender?.inboxID ??
        (ctx?.sender as any)?.inboxId ??
        (ctx?.senderInboxId as any) ??
        null
      senderInboxId = typeof cand === 'string' ? cand : cand ? String(cand) : ''
      if (senderInboxId) {
        senderWallet = await resolveSenderWalletFromConversation(agent, groupId, senderInboxId)
      }
    }

    // If we still can't resolve the sender, allow non-sensitive commands to respond.
    if (!senderWallet && !senderlessOk) {
      await sendTextSafe({
        agent,
        ctx,
        conversationId: groupId,
        text: 'Keepr could not verify your wallet identity in this chat client. Try again from `xmtp.chat` or use the app join flow.',
      })
      return
    }

    // Debug: show which sender fields were present (helps adapt to Base App message shape).
    try {
      console.log(
        'Keepr sender debug',
        JSON.stringify({
          groupId,
          senderWallet: senderWallet ?? null,
          senderInboxId: senderInboxId || null,
          messageKeys: ctx?.message ? Object.keys(ctx.message) : [],
        }),
      )
    } catch {
      // ignore
    }

    // Minimal debug to confirm the handler is firing for group messages.
    try {
      console.log('Keepr command received', JSON.stringify({ groupId, senderWallet: senderWallet ?? null, content: raw }))
    } catch {
      // ignore
    }

    // Simple deterministic rate limiting (per user per group).
    const vault = await getKeeprVaultByGroupId(groupId)
    const cooldownMs =
      typeof vault?.config?.rateLimits?.commandCooldownMs === 'number' && Number.isFinite(vault.config.rateLimits.commandCooldownMs)
        ? Math.max(250, Math.floor(vault.config.rateLimits.commandCooldownMs))
        : 1500
    const key = `${groupId}:${senderWallet}`
    const last = lastCommandAt.get(key) ?? 0
    if (Date.now() - last < cooldownMs) return
    lastCommandAt.set(key, Date.now())

    // For senderless-ok commands, use a placeholder wallet for role checks (they won't require OWNER/ADMIN).
    const walletForCommand = senderWallet ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`)
    const r = await handleKeeprCommand({ groupId, senderWallet: walletForCommand, text })
    if (!r.response) return
    if (cmd === 'help') {
      const actionsId = `keepr_${groupId}_${Date.now()}`
      lastQuickActionsIdByConversationId.set(groupId, actionsId)
      await sendBaseQuickActionsSafe({
        agent,
        ctx,
        conversationId: groupId,
        content: {
          id: actionsId,
          description: 'Keepr — choose an option',
          actions: [
            { id: 'help', label: 'Help', style: 'secondary' },
            { id: 'status', label: 'Status', style: 'primary' },
            { id: 'rules', label: 'Rules', style: 'secondary' },
          ],
        },
      })
    } else {
      await sendTextSafe({ agent, ctx, conversationId: groupId, text: r.response })
    }

    // If this is a sync request, run it in-process with a cooldown.
    if (text.toLowerCase().startsWith('/keepr sync')) {
      const syncCooldownSeconds =
        typeof vault?.config?.rateLimits?.syncCooldownSeconds === 'number' && Number.isFinite(vault.config.rateLimits.syncCooldownSeconds)
          ? Math.max(30, Math.floor(vault.config.rateLimits.syncCooldownSeconds))
          : 600
      const lastS = lastSyncAt.get(groupId) ?? 0
      if (Date.now() - lastS >= syncCooldownSeconds * 1000) {
        lastSyncAt.set(groupId, Date.now())
        try {
          await runSyncForGroup(agent, groupId)
        } catch {
          // ignore
        }
      }
    }
  }

  // Base App / XMTP clients can emit text in different event streams.
  // Use `message` and filter down to text so we don't miss commands.
  agent.on('message', async (ctx: any) => {
    // Handle Base App intent messages (button presses).
    try {
      const ct = (ctx?.message as any)?.contentType
      if (isBaseIntentContentType(ct)) {
        const groupId = String(ctx?.message?.conversationId ?? ctx?.conversation?.id ?? '').trim()
        const content = ctx?.message?.content as any
        const intent: BaseIntentContent | null =
          content && typeof content === 'object' && typeof content.actionId === 'string' && typeof content.id === 'string'
            ? (content as BaseIntentContent)
            : null
        const actionId =
          intent?.actionId ??
          (() => {
            const fb = String((ctx?.message as any)?.fallback ?? '')
            const m = fb.match(/User selected action:\s*([A-Za-z0-9_\\-]+)/)
            return m ? m[1] : null
          })()
        if (groupId && actionId) {
          const cmdText = `/keepr ${actionId}`
          await maybeHandleKeeprCommand({
            ...ctx,
            message: { ...(ctx.message ?? {}), content: cmdText },
            conversation: ctx?.conversation ?? { id: groupId },
          })
        }
        return
      }
    } catch {
      // ignore
    }

    // TEMP debug: log non-text messages that mention keepr.
    try {
      const raw = ctx?.message?.content
      const text = typeof raw === 'string' ? raw : raw ? String(raw) : ''
      if (text.toLowerCase().includes('keepr')) {
        console.log('Saw message event', JSON.stringify({ content: text, contentType: (ctx?.message as any)?.contentType }))
      }
    } catch {
      // ignore
    }
    try {
      if (!filter?.isText?.(ctx?.message)) return
    } catch {
      // If filter isn't available for some reason, fall back to best-effort.
    }
    await maybeHandleKeeprCommand(ctx)
  })

  agent.on('unknownMessage', (ctx: any) => {
    try {
      console.log('unknownMessage', JSON.stringify({ contentType: (ctx?.message as any)?.contentType }))
    } catch {
      // ignore
    }
  })

  // Keep the text handler too (cheap) for SDKs that emit it reliably.
  agent.on('text', async (ctx: any) => {
    // Deduped inside maybeHandleKeeprCommand; keep this for SDKs that don't emit `message`.
    await maybeHandleKeeprCommand(ctx)
  })

  // Main loop:
  // - agent.start() handles streaming messages
  // - background job processes queued actions and periodic syncs
  ;(async () => {
    while (true) {
      try {
        await processPendingActions(agent)
      } catch {
        // ignore transient failures
      }

      try {
        await processJoinRequests(agent)
      } catch {
        // ignore transient failures
      }

      const syncGroupsRaw = (process.env.KEEPR_SYNC_GROUP_IDS ?? '').trim()
      const syncGroups = syncGroupsRaw ? syncGroupsRaw.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean) : []
      for (const gid of syncGroups) {
        try {
          await runSyncForGroup(agent, gid)
        } catch {
          // ignore
        }
      }

      await sleep(5_000)
    }
  })().catch(() => {
    // ignore
  })

  console.log('Starting XMTP agent stream...')
  await agent.start()
  console.log('XMTP agent stream started.')

  // Warm-up: ensure we allow/sync existing conversations (and groups from DB).
  try {
    // Allow/sync known groupIds from configured vaults (if any).
    const db = await getDb()
    if (db) {
      await ensureKeeprSchema()
      const res = await db.sql`SELECT DISTINCT group_id FROM keepr_vaults WHERE group_id IS NOT NULL AND group_id <> '';`
      const ids = (res.rows ?? [])
        .map((r: any) => String(r?.group_id ?? '').trim())
        .filter(Boolean)
        .slice(0, 50)
      for (const gid of ids) {
        const g = await getGroupFromAgent(agent, gid)
        await allowAndSyncConversation(g, `db:${gid}`)
      }
      if (ids.length) console.log('Warmup: allowed DB groups:', ids.length)
    }
  } catch (e) {
    console.warn('Warmup DB groups failed', e)
  }

  try {
    await warmupAllowedConversations(agent)
  } catch (e) {
    console.warn('Warmup conversations failed', e)
  }
}

if (process.argv?.[1]?.includes('keepr/runtime')) {
  startKeeprRuntime().catch((e: any) => {
    console.error(e)
    process.exit(1)
  })
}


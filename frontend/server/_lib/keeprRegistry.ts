import { createHash } from 'node:crypto'
import { ensureKeeprSchema } from './keeprSchema.js'
import { getDb } from './postgres.js'

export type KeeprConfigV1 = {
  version: number
  chainId: number
  vault: {
    vaultAddress: `0x${string}`
    creatorCoinAddress: `0x${string}`
    canonicalOwnerAddress: `0x${string}`
    shareTokenAddress?: `0x${string}`
  }
  xmtp: {
    groupId: string
    agentInboxId?: string
  }
  gating: {
    enabled: boolean
    joinLocked: boolean
    mode: 'shares' | 'none' | 'deposit' | 'allowlist' | string
    thresholds?: { minShares?: string }
    failClosed: boolean
  }
  roles: {
    owner: `0x${string}`
    admins?: `0x${string}`[]
    operators?: `0x${string}`[]
  }
  behavior?: {
    dmDenials?: boolean
    dmRemovals?: boolean
    emitJoinSignals?: boolean
    emitMilestones?: boolean
  }
  rateLimits?: {
    commandCooldownMs?: number
    syncMaxMembersPerBatch?: number
    syncCooldownSeconds?: number
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortKeys)
  if (!isObject(value)) return value
  const keys = Object.keys(value).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = stableSortKeys(value[k])
  return out
}

export function computeConfigHash(config: KeeprConfigV1): string {
  const canonical = JSON.stringify(stableSortKeys(config))
  return sha256Hex(canonical)
}

export type KeeprVaultRow = {
  vaultAddress: `0x${string}`
  chainId: number
  groupId: string
  creatorCoinAddress: `0x${string}`
  canonicalOwnerAddress: `0x${string}`
  shareTokenAddress: `0x${string}` | null
  gatingEnabled: boolean
  joinLocked: boolean
  gatingMode: string
  minShares: string | null
  failClosed: boolean
  configVersion: number
  configHash: string
  config: KeeprConfigV1
}

function mapVaultRow(row: any): KeeprVaultRow {
  return {
    vaultAddress: String(row.vault_address).toLowerCase() as `0x${string}`,
    chainId: Number(row.chain_id),
    groupId: String(row.group_id),
    creatorCoinAddress: String(row.creator_coin_address).toLowerCase() as `0x${string}`,
    canonicalOwnerAddress: String(row.canonical_owner_address).toLowerCase() as `0x${string}`,
    shareTokenAddress: row.share_token_address ? (String(row.share_token_address).toLowerCase() as `0x${string}`) : null,
    gatingEnabled: Boolean(row.gating_enabled),
    joinLocked: Boolean(row.join_locked),
    gatingMode: String(row.gating_mode),
    minShares: row.min_shares ? String(row.min_shares) : null,
    failClosed: Boolean(row.fail_closed),
    configVersion: Number(row.config_version),
    configHash: String(row.config_hash),
    config: (row.config_json ?? {}) as KeeprConfigV1,
  }
}

export async function upsertKeeprVault(params: { config: KeeprConfigV1; actorWallet?: string | null }): Promise<KeeprVaultRow> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  const cfg = params.config
  const vaultAddress = String(cfg?.vault?.vaultAddress ?? '').toLowerCase()
  if (!vaultAddress.startsWith('0x') || vaultAddress.length !== 42) throw new Error('invalid_vault_address')
  const chainId = Number(cfg?.chainId)
  if (!Number.isFinite(chainId)) throw new Error('invalid_chain_id')
  const groupId = String(cfg?.xmtp?.groupId ?? '').trim()
  if (!groupId) throw new Error('missing_group_id')

  const hash = computeConfigHash(cfg)

  const gatingEnabled = Boolean(cfg?.gating?.enabled)
  const joinLocked = Boolean(cfg?.gating?.joinLocked)
  const gatingMode = String(cfg?.gating?.mode ?? 'shares')
  const minShares = cfg?.gating?.thresholds?.minShares ? String(cfg.gating.thresholds.minShares) : null
  const failClosed = cfg?.gating?.failClosed !== false

  await db.sql`
    INSERT INTO keepr_vaults (
      vault_address,
      chain_id,
      group_id,
      creator_coin_address,
      canonical_owner_address,
      share_token_address,
      gating_enabled,
      join_locked,
      gating_mode,
      min_shares,
      fail_closed,
      config_version,
      config_hash,
      config_json,
      updated_at
    ) VALUES (
      ${vaultAddress},
      ${chainId},
      ${groupId},
      ${String(cfg.vault.creatorCoinAddress).toLowerCase()},
      ${String(cfg.vault.canonicalOwnerAddress).toLowerCase()},
      ${cfg.vault.shareTokenAddress ? String(cfg.vault.shareTokenAddress).toLowerCase() : null},
      ${gatingEnabled},
      ${joinLocked},
      ${gatingMode},
      ${minShares},
      ${failClosed},
      ${Number(cfg.version ?? 1)},
      ${hash},
      ${cfg},
      NOW()
    )
    ON CONFLICT (vault_address) DO UPDATE SET
      chain_id = EXCLUDED.chain_id,
      group_id = EXCLUDED.group_id,
      creator_coin_address = EXCLUDED.creator_coin_address,
      canonical_owner_address = EXCLUDED.canonical_owner_address,
      share_token_address = EXCLUDED.share_token_address,
      gating_enabled = EXCLUDED.gating_enabled,
      join_locked = EXCLUDED.join_locked,
      gating_mode = EXCLUDED.gating_mode,
      min_shares = EXCLUDED.min_shares,
      fail_closed = EXCLUDED.fail_closed,
      config_version = EXCLUDED.config_version,
      config_hash = EXCLUDED.config_hash,
      config_json = EXCLUDED.config_json,
      updated_at = NOW();
  `

  await db.sql`
    INSERT INTO keepr_audit_log (vault_address, actor_wallet, event_type, details)
    VALUES (
      ${vaultAddress},
      ${params.actorWallet ? String(params.actorWallet).toLowerCase() : null},
      ${'config_upsert'},
      ${{
        configHash: hash,
        groupId,
        chainId,
        gatingEnabled,
        joinLocked,
        gatingMode,
      }}
    );
  `

  const row = await getKeeprVaultByVaultAddress(vaultAddress as `0x${string}`)
  if (!row) throw new Error('keepr_vault_upsert_failed')
  return row
}

export async function getKeeprVaultByVaultAddress(vaultAddress: `0x${string}`): Promise<KeeprVaultRow | null> {
  const db = await getDb()
  if (!db) return null
  await ensureKeeprSchema()
  const res = await db.sql`SELECT * FROM keepr_vaults WHERE vault_address = ${String(vaultAddress).toLowerCase()} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapVaultRow(row) : null
}

export async function getKeeprVaultByGroupId(groupId: string): Promise<KeeprVaultRow | null> {
  const db = await getDb()
  if (!db) return null
  await ensureKeeprSchema()
  const res = await db.sql`SELECT * FROM keepr_vaults WHERE group_id = ${String(groupId)} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapVaultRow(row) : null
}

export async function enqueueKeeprAction(params: {
  vaultAddress: `0x${string}`
  groupId: string
  action: any
  actionType?: string | null
  dedupeKey?: string | null
}): Promise<{ id: number }> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  const actionType = params.actionType ? String(params.actionType) : String(params.action?.action ?? '')
  const dedupeKey = params.dedupeKey ? String(params.dedupeKey) : null

  // Idempotency: if a dedupe key is provided, ensure we only keep one in-flight action
  // for that key at a time. (Executed/failed actions won't block future retries.)
  if (dedupeKey) {
    const res = await db.sql`
      WITH
        _lock AS (SELECT pg_advisory_xact_lock(hashtext(${dedupeKey})) AS locked),
        existing AS (
          SELECT id
          FROM keepr_actions
          WHERE dedupe_key = ${dedupeKey}
            AND status IN ('pending', 'retry', 'executing')
          ORDER BY created_at DESC
          LIMIT 1
        ),
        ins AS (
          INSERT INTO keepr_actions (vault_address, group_id, action_type, action, dedupe_key, status)
          SELECT
            ${String(params.vaultAddress).toLowerCase()},
            ${params.groupId},
            ${actionType || null},
            ${params.action},
            ${dedupeKey},
            ${'pending'}
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          RETURNING id
        )
      SELECT id FROM ins
      UNION ALL
      SELECT id FROM existing
      LIMIT 1;
    `
    const id = Number(res.rows?.[0]?.id ?? 0)
    return { id }
  }

  const res = await db.sql`
    INSERT INTO keepr_actions (vault_address, group_id, action_type, action, status)
    VALUES (${String(params.vaultAddress).toLowerCase()}, ${params.groupId}, ${actionType || null}, ${params.action}, ${'pending'})
    RETURNING id;
  `
  const id = Number(res.rows?.[0]?.id ?? 0)
  return { id }
}

export async function setKeeprJoinLocked(params: {
  vaultAddress: `0x${string}`
  joinLocked: boolean
  actorWallet?: string | null
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  await db.sql`
    UPDATE keepr_vaults
      SET join_locked = ${Boolean(params.joinLocked)},
          updated_at = NOW()
    WHERE vault_address = ${String(params.vaultAddress).toLowerCase()};
  `

  await db.sql`
    INSERT INTO keepr_audit_log (vault_address, actor_wallet, event_type, details)
    VALUES (
      ${String(params.vaultAddress).toLowerCase()},
      ${params.actorWallet ? String(params.actorWallet).toLowerCase() : null},
      ${params.joinLocked ? 'join_locked' : 'join_unlocked'},
      ${{}}
    );
  `
}


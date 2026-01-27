import { getDb, isDbConfigured } from './postgres.js'

let keeprSchemaEnsured = false

export async function ensureKeeprSchema(): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  if (keeprSchemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_vaults (
        vault_address TEXT PRIMARY KEY,
        chain_id INTEGER NOT NULL,
        group_id TEXT NOT NULL,
        creator_coin_address TEXT NOT NULL,
        canonical_owner_address TEXT NOT NULL,
        share_token_address TEXT,
        gating_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        join_locked BOOLEAN NOT NULL DEFAULT FALSE,
        gating_mode TEXT NOT NULL DEFAULT 'shares',
        min_shares TEXT,
        fail_closed BOOLEAN NOT NULL DEFAULT TRUE,
        config_version INTEGER NOT NULL DEFAULT 1,
        config_hash TEXT NOT NULL,
        config_json JSONB NOT NULL,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    await db.sql`CREATE INDEX IF NOT EXISTS keepr_vaults_group_id_idx ON keepr_vaults (group_id);`
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_vaults_owner_idx ON keepr_vaults (canonical_owner_address);`

    // Back-compat: if table exists from a previous deployment, add new columns safely.
    try {
      await db.sql`ALTER TABLE keepr_vaults ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;`
    } catch {
      // ignore
    }

    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_nonces (
        nonce TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        vault_address TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_nonces_wallet_idx ON keepr_nonces (wallet_address);`
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_nonces_expires_idx ON keepr_nonces (expires_at);`

    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_actions (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        group_id TEXT NOT NULL,
        action_type TEXT,
        action JSONB NOT NULL,
        dedupe_key TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        executed_at TIMESTAMPTZ
      );
    `

    // Back-compat: add columns to existing deployments safely.
    //
    // IMPORTANT:
    // Some deployments may already have `keepr_actions` without newer columns. Creating an index that references
    // a missing column will error *before* we have a chance to ALTER TABLE. So we add columns first, then indexes.
    try {
      await db.sql`ALTER TABLE keepr_actions ADD COLUMN IF NOT EXISTS action_type TEXT;`
    } catch {
      // ignore
    }
    try {
      await db.sql`ALTER TABLE keepr_actions ADD COLUMN IF NOT EXISTS dedupe_key TEXT;`
    } catch {
      // ignore
    }
    try {
      await db.sql`ALTER TABLE keepr_actions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;`
    } catch {
      // ignore
    }
    try {
      await db.sql`ALTER TABLE keepr_actions ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;`
    } catch {
      // ignore
    }

    // Indexes (best-effort; don't fail startup if they can't be created yet).
    try {
      await db.sql`CREATE INDEX IF NOT EXISTS keepr_actions_status_idx ON keepr_actions (status, created_at DESC);`
    } catch {
      // ignore
    }
    try {
      await db.sql`CREATE INDEX IF NOT EXISTS keepr_actions_group_idx ON keepr_actions (group_id, created_at DESC);`
    } catch {
      // ignore
    }
    try {
      await db.sql`CREATE INDEX IF NOT EXISTS keepr_actions_dedupe_idx ON keepr_actions (dedupe_key, created_at DESC);`
    } catch {
      // ignore
    }

    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_audit_log (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        actor_wallet TEXT,
        event_type TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_audit_vault_idx ON keepr_audit_log (vault_address, created_at DESC);`

    // Users who attempted to join but were ineligible can be "watched".
    // Keepr will periodically re-check eligibility and auto-add when eligible.
    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_join_requests (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        group_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'watching', -- watching | queued | added | failed | cancelled
        last_reason TEXT,
        last_checked_at TIMESTAMPTZ,
        next_check_at TIMESTAMPTZ,
        action_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_join_requests_status_idx ON keepr_join_requests (status, next_check_at, updated_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS keepr_join_requests_vault_wallet_idx ON keepr_join_requests (vault_address, wallet_address);`

    // Back-compat: add columns safely.
    try {
      await db.sql`ALTER TABLE keepr_join_requests ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;`
    } catch {
      // ignore
    }
    try {
      await db.sql`ALTER TABLE keepr_join_requests ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;`
    } catch {
      // ignore
    }
    try {
      await db.sql`ALTER TABLE keepr_join_requests ADD COLUMN IF NOT EXISTS action_id BIGINT;`
    } catch {
      // ignore
    }

    // One-time migration from legacy takopi_* tables (if they exist).
    await db.sql`
      DO $$
      BEGIN
        IF to_regclass('public.takopi_vaults') IS NOT NULL THEN
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
            last_sync_at,
            created_at,
            updated_at
          )
          SELECT
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
            last_sync_at,
            created_at,
            updated_at
          FROM takopi_vaults
          ON CONFLICT (vault_address) DO NOTHING;
        END IF;
      END $$;
    `

    await db.sql`
      DO $$
      BEGIN
        IF to_regclass('public.takopi_nonces') IS NOT NULL THEN
          INSERT INTO keepr_nonces (nonce, purpose, wallet_address, vault_address, issued_at, expires_at, used_at)
          SELECT nonce, purpose, wallet_address, vault_address, issued_at, expires_at, used_at
          FROM takopi_nonces
          ON CONFLICT (nonce) DO NOTHING;
        END IF;
      END $$;
    `

    await db.sql`
      DO $$
      BEGIN
        IF to_regclass('public.takopi_actions') IS NOT NULL THEN
          INSERT INTO keepr_actions (id, vault_address, group_id, action, status, last_error, created_at, updated_at, executed_at)
          SELECT id, vault_address, group_id, action, status, last_error, created_at, updated_at, executed_at
          FROM takopi_actions
          ON CONFLICT (id) DO NOTHING;
        END IF;
      END $$;
    `

    await db.sql`
      DO $$
      BEGIN
        IF to_regclass('public.takopi_audit_log') IS NOT NULL THEN
          INSERT INTO keepr_audit_log (id, vault_address, actor_wallet, event_type, details, created_at)
          SELECT id, vault_address, actor_wallet, event_type, details, created_at
          FROM takopi_audit_log
          ON CONFLICT (id) DO NOTHING;
        END IF;
      END $$;
    `

    // Ensure sequences are moved past the migrated ids (if any).
    try {
      await db.sql`SELECT setval(pg_get_serial_sequence('keepr_actions', 'id'), COALESCE((SELECT MAX(id) FROM keepr_actions), 1), true);`
    } catch {
      // ignore
    }
    try {
      await db.sql`SELECT setval(pg_get_serial_sequence('keepr_audit_log', 'id'), COALESCE((SELECT MAX(id) FROM keepr_audit_log), 1), true);`
    } catch {
      // ignore
    }

    keeprSchemaEnsured = true
  } catch (err) {
    keeprSchemaEnsured = false
    throw err
  }
}


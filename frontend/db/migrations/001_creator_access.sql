-- CreatorVault: invite-only creator access (SIWE) schema
-- This migration is intentionally idempotent (safe to run multiple times).

-- =========================
-- creator_allowlist
-- =========================
-- Stores approved wallet addresses that are allowed to launch/deploy.
-- A row means "approved"; removing approval can be done by setting revoked_at.

CREATE TABLE IF NOT EXISTS creator_allowlist (
  address TEXT PRIMARY KEY,
  approved_by TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS creator_allowlist_revoked_at_idx
  ON creator_allowlist (revoked_at);

-- =========================
-- creator_access_requests
-- =========================
-- Stores "request access" submissions from creators, signed in via SIWE.

CREATE TABLE IF NOT EXISTS creator_access_requests (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  coin_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  decision_note TEXT
);

-- Basic status constraint (avoid creating a postgres enum to keep migration simple).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_access_requests_status_check'
  ) THEN
    ALTER TABLE creator_access_requests
      ADD CONSTRAINT creator_access_requests_status_check
      CHECK (status IN ('pending', 'approved', 'denied'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS creator_access_requests_status_created_idx
  ON creator_access_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS creator_access_requests_wallet_idx
  ON creator_access_requests (wallet_address);

-- Prevent multiple concurrent pending requests per wallet.
CREATE UNIQUE INDEX IF NOT EXISTS creator_access_requests_wallet_pending_unique
  ON creator_access_requests (wallet_address)
  WHERE status = 'pending';



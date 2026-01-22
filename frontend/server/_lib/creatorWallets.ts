type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let creatorWalletsEnsured = false

export async function ensureCreatorWalletsSchema(db: Db): Promise<void> {
  if (creatorWalletsEnsured) return
  creatorWalletsEnsured = true

  await db.sql`
    CREATE TABLE IF NOT EXISTS creator_wallets (
      id BIGSERIAL PRIMARY KEY,
      coin_address TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      wallet_role TEXT NOT NULL,
      verified_via TEXT NOT NULL DEFAULT 'siwe',
      privy_user_id TEXT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await db.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS creator_wallets_coin_wallet_unique
      ON creator_wallets (coin_address, wallet_address);
  `
  await db.sql`CREATE INDEX IF NOT EXISTS creator_wallets_wallet_idx ON creator_wallets (wallet_address);`
  await db.sql`CREATE INDEX IF NOT EXISTS creator_wallets_coin_idx ON creator_wallets (coin_address);`
}

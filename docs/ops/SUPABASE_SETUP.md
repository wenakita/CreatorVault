# Supabase Setup (Creator Access Gate)

This project can use Supabase as the primary backend datastore for:

- Creator allowlist checks (`/api/creator-allowlist`)
- Creator access request flow (`/api/creator-access/*`)
- Admin review endpoints (`/api/admin/creator-access/*`)

## Environment Variables (Vercel)

Set these in **Vercel → Project Settings → Environment Variables** (Production + Preview as needed):

- `SUPABASE_URL` (server-only)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; **never** expose to the browser)

Optional (client-side Supabase usage, if/when needed):

- `VITE_SUPABASE_URL` (public)
- `VITE_SUPABASE_ANON_KEY` (public)

## Database Schema (run once)

Run this in the **Supabase SQL editor**:

```sql
create table if not exists creator_allowlist (
  address text primary key,
  approved_by text,
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text
);

create index if not exists creator_allowlist_revoked_at_idx
  on creator_allowlist (revoked_at);

create table if not exists creator_access_requests (
  id bigserial primary key,
  wallet_address text not null,
  coin_address text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  decision_note text
);

do $$
begin
  alter table creator_access_requests
    add constraint creator_access_requests_status_check
    check (status in ('pending','approved','denied'));
exception when others then
  -- ignore if already exists
end $$;

create index if not exists creator_access_requests_status_created_idx
  on creator_access_requests (status, created_at desc);

create index if not exists creator_access_requests_wallet_idx
  on creator_access_requests (wallet_address);

create unique index if not exists creator_access_requests_wallet_pending_unique
  on creator_access_requests (wallet_address)
  where status = 'pending';
```

## Security Notes

- The API routes use the **service role key**. That means Row Level Security (RLS) is optional for functionality, but recommended as defense-in-depth.
- Do not commit `.env` files with secrets. `.env` is gitignored at the repo root.

## Verify

- Hit `GET /api/health` and confirm:
  - `data.supabase.serviceRoleConfigured === true`
  - `data.supabase.ok === true`


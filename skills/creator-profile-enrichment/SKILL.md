---
name: creator-profile-enrichment
description: Enrich creator profiles and onchain reputation by aggregating Talent Protocol, Guild.xyz, Basenames, Zora, and DeBank portfolio signals. Use when the user mentions creator discovery/ranking, onchain reputation, Talent API, Guild roles, Basename/ENS data, Zora profiles, or DeBank/portfolio activity.
---

## Quick Start (most common)

- Decide the input type:
  - Creator EOA address
  - Creator coin address (will be resolved to creator address)
- Fetch aggregated reputation using the existing aggregator (read-only, no writes):
  - `frontend/src/lib/reputation-aggregator.ts` → `getOnchainReputation(address)`
- If a source is missing/empty, debug that source’s client + its API key/proxy path (Talent and Neynar are proxied through server routes).
- Treat enrichment as optional: failures should degrade gracefully (no hard crashes, no blocking core flows).

## System Model (how enrichment works here)

- Aggregator (single entrypoint):
  - `frontend/src/lib/reputation-aggregator.ts`
  - Fetches in parallel: Talent passport + Talent socials + Base Guild stats + Basename profile + Zora creator profile + DeBank total balance (optional)
  - Produces a weighted composite score + badges + trust score + social reach estimate
- Source clients:
  - Talent (proxied): `frontend/src/lib/talent-api.ts` → calls `/api/social/talent`
    - Server handler: `frontend/api/_handlers/social/_talent.ts` (requires server env `TALENT_API_KEY`)
  - DeBank (proxied): `frontend/src/lib/debank/client.ts` → calls `/api/debank/totalBalanceBatch`
    - Server handler: `frontend/api/_handlers/debank/_totalBalanceBatch.ts` (requires server env `DEBANK_ACCESS_KEY`)
  - Guild.xyz (direct): `frontend/src/lib/guild-api.ts`
  - Basenames (onchain): `frontend/src/lib/basename-api.ts`
  - Zora (direct): `frontend/src/lib/zora-api.ts`
- Address resolution:
  - `frontend/src/lib/reputation-aggregator.ts` first calls `resolveCreatorAddress(...)` (creator coin → creator address) before fetching sources.

## Required Inputs

- Target identifier: creator EOA address or creator coin address
- Runtime context:
  - local dev vs preview vs production (affects env vars + serverless availability)

Never include secrets (API keys, private keys, full `.env` contents) in responses.

## Repo Map (where to look / what to run)

- Aggregation logic: `frontend/src/lib/reputation-aggregator.ts`
- Talent API client: `frontend/src/lib/talent-api.ts`
- Talent server proxy: `frontend/api/_handlers/social/_talent.ts`
- Guild client: `frontend/src/lib/guild-api.ts`
- Basename client: `frontend/src/lib/basename-api.ts`
- Zora client: `frontend/src/lib/zora-api.ts`
- UI:
  - `frontend/src/components/cca/OnchainReputationCard.tsx`
  - `frontend/src/components/cca/CreatorProfileCard*.tsx`
- System documentation: `frontend/docs/onchain-reputation-system.md`

## Preflight Checks (fast)

- Confirm you’re not trying to call Talent directly from the browser:
  - Client must call `/api/social/talent` (proxy keeps `TALENT_API_KEY` server-only).
- Confirm server env is configured for Talent:
  - `TALENT_API_KEY` must be present in the server environment (Vercel / local env used by Vercel functions).
- Confirm server env is configured for DeBank (if you want portfolio signals):
  - `DEBANK_ACCESS_KEY` must be present in the server environment.
- Confirm expected degradation:
  - Talent 404 is treated as a soft miss (proxy returns `{ success: true, data: null }`).
  - DeBank should be treated as optional (rate limiting / missing key should not break pages).

## Debug Workflows (source-by-source)

### A) Aggregator returns mostly empty / score is 0

1. Confirm input is a creator address (or that resolution worked):
   - Look at `resolveCreatorAddress` usage in `frontend/src/lib/reputation-aggregator.ts`
2. Check each source independently by calling its client function:
   - Talent: `getTalentPassport`, `getTalentSocials`
   - DeBank: `fetchDebankTotalBalanceBatch({ addresses: [...] })`
   - Guild: `getBaseGuildStats`
   - Basename: `getBasenameProfile`
   - Zora: `getZoraCreatorProfile`

### B) Talent is always null / errors

Common causes:
- `TALENT_API_KEY` not set in server environment
- Request is blocked because it’s not going through the proxy

Where to fix:
- `frontend/api/_handlers/social/_talent.ts` (proxy)
- `frontend/src/lib/talent-api.ts` (client uses `/api/social/talent`)

Notes:
- The proxy sets `Cache-Control: public, s-maxage=120, stale-while-revalidate=300` to reduce rate-limit risk.

### C) Guild.xyz roles look wrong or missing

Check:
- `frontend/src/lib/guild-api.ts` uses a heuristic for “Base guild” membership (name includes “base” or guildId match).
- If the Base guild ID changes, update the matching logic there.

### D) Basename missing

Check:
- `frontend/src/lib/basename-api.ts` uses `viem` ENS methods on Base/Base Sepolia.
- Ensure correct chainId and that the address has a primary name set.

## Output Format (when using this skill)

Return a structured result:

- Summary: what enrichment was requested and the outcome
- Inputs: target address/coin, environment (local/preview/prod)
- Data sources:
  - Talent: passport present? verified? score/rank?
  - DeBank: totalUsdValue present? top chains? (if configured)
  - Guild: roles found? key flags (isBuilder/isOnchain/etc)?
  - Basename: name present? key text records?
  - Zora: profile present?
- Aggregated result: totalScore, reputationLevel, trustScore, badges, socialReach
- Issues + fixes: missing env, proxy miswire, rate limits, invalid address resolution

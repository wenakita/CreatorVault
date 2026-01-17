# Vibeship Security Scan — Triage & Fix Tracker (2026-01-17)

This file is a **curated, repo-specific triage** for the raw Vibeship scan output in `docs/scan2.txt`.

- Scan URL: `https://scanner.vibeship.co/scan/119ea32a-4971-47d0-954f-6f865edc70ab`
- Repo scanned: `https://github.com/wenakita/creatorvault`
- Scan timestamp: `2026-01-17 06:00:18` (from report header)

## What to trust / what not to trust

- **Trust the *locations* (file:line)** as a starting point.
- **Do NOT trust the boilerplate “Risk & Fix” text** in many findings — the report frequently pastes irrelevant Node.js guidance into Solidity findings.
- The scan is **very noisy** and includes many **false positives** (especially “Exposed Secret” on public contract addresses / constants).

## Raw counts (from `docs/scan2.txt`)

- Critical: 81
- High: 619
- Medium: 1594
- Low: 848
- Info: 3823

Total findings: 6965

## Fixed (implemented)

### [HIGH] Dangerous `eval()` usage

- **Finding**: “Dangerous eval() call - potential code injection vulnerability”
- **Location (scan)**: `frontend/api/sync-vault-data.ts:14`
- **Fix**: Removed `eval()`-based dynamic import and replaced it with a safe dynamic import that keeps Prisma optional.
- **Status**: FIXED

## Notes on contract findings

Many `CreatorOVault.sol` findings in the scan appear to be **stale line references** from a prior version. Re-run the scan after commits to validate.

## Local verification checklist

- Contracts: `forge build` / `forge test`
- Frontend: `pnpm -C frontend lint` / `pnpm -C frontend typecheck`


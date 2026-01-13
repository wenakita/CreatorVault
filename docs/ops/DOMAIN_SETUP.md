# Domain Setup

## Current Domain

**Production domain:** `erc4626.fun`

- Frontend: https://erc4626.fun
- Documentation: https://docs.erc4626.fun

## Farcaster Mini App Requirements (must pass)

### Canonical domain

- Use **apex** `erc4626.fun` as canonical.
- Avoid `erc4626.fun` → `www.erc4626.fun` redirects (Farcaster tooling expects the manifest on the exact signed domain).

### Manifest serving

Ensure the manifest is reachable at the exact domain you signed:

- `https://erc4626.fun/.well-known/farcaster.json`
  - HTTP **200**
  - `Content-Type: application/json`
  - **No redirects**

Quick check:

```bash
curl -s -D - https://erc4626.fun/.well-known/farcaster.json -o /dev/null | sed -n '1,20p'
```

### Embed meta tag

The root HTML must contain a valid Mini App embed tag (not legacy-only):

- `meta name="fc:miniapp"` JSON must use `"version":"1"` (not `"next"`).

## DNS Configuration

The domain is configured via Vercel with automatic SSL/TLS provisioning.

## Historical Notes

Legacy domain setup documentation (referencing old `creatorvault.fun` domain) has been archived to `_archive/`. These files are retained for reference only and do not reflect current infrastructure.

Archived files:
- `_archive/CLOUDFLARE_SETUP.md`
- `_archive/CUSTOM_DOMAIN_SETUP.md`
- `_archive/DOMAIN_SETUP_FINAL.md`
- `_archive/VERCEL_PROJECT_FIX.md`

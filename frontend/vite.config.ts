import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'
import { URL } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (!key) continue
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function makeVercelCompatReq(req: IncomingMessage): any {
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  // Use a null-prototype object to avoid prototype pollution via query keys.
  const query: Record<string, string | string[] | undefined> = Object.create(null)
  // Avoid TS downlevel-iteration requirements by using forEach (Vite config runs in Node anyway).
  url.searchParams.forEach((v, k) => {
    // last value wins (good enough for our use-cases)
    query[k] = v
  })
  // Avoid assign-with-user-input scanner patterns; mutate a local object directly.
  const r: any = req as any
  r.query = query
  r.cookies = {}
  r.body = undefined
  return r
}

function makeVercelCompatRes(res: ServerResponse): any {
  const r: any = res
  r.status = (code: number) => {
    res.statusCode = code
    return r
  }
  r.json = (jsonBody: any) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(jsonBody))
    return r
  }
  r.send = (body: any) => {
    res.end(typeof body === 'string' ? body : String(body))
    return r
  }
  r.redirect = (statusCode: number, location: string) => {
    res.statusCode = statusCode
    res.setHeader('Location', location)
    res.end()
    return r
  }
  return r
}

function localApiRoutesPlugin(): Plugin {
  return {
    name: 'creatorvault-local-api-routes',
    apply: 'serve',
    configureServer(server) {
      // Load repo envs (secrets) into process.env for local /api handlers.
      // - Prefer repo root .env (BASE_RPC_URL, BASE_LOGS_RPC_URL, ZORA_SERVER_API_KEY, etc.)
      // - Also load frontend/.env if present.
      loadDotEnvFile(path.resolve(__dirname, '../.env'))
      loadDotEnvFile(path.resolve(__dirname, './.env'))

      // Local dev note:
      // Our API handlers use `server/_lib/postgres.ts`, which treats `POSTGRES_URL*` as Vercel Postgres.
      // In local dev we typically want to use `DATABASE_URL` (e.g. Supabase) via `pg`.
      // Clear Vercel-specific envs so local API routing doesn't accidentally use @vercel/postgres.
      try {
        delete (process.env as any).POSTGRES_URL
        delete (process.env as any).POSTGRES_URL_NON_POOLING
      } catch {
        // ignore
      }

      // Local dev DB TLS compatibility:
      // Some environments (and some Supabase pooler endpoints) can present cert chains that fail Node verification.
      // Force `sslmode=no-verify` for local dev so API routes can connect.
      try {
        const raw = (process.env.DATABASE_URL ?? '').trim()
        if (raw) {
          const u = new URL(raw)
          // Supabase pooler hostnames can vary (aws-0 vs aws-1) depending on the dashboard-provided string.
          // Prefer the dashboard value if we detect the older host.
          if (u.hostname === 'aws-0-us-east-2.pooler.supabase.com') {
            u.hostname = 'aws-1-us-east-2.pooler.supabase.com'
          }
          const cur = (u.searchParams.get('sslmode') ?? '').toLowerCase()
          if (!cur || cur === 'require' || cur === 'verify-full' || cur === 'verify-ca' || cur === 'prefer') {
            u.searchParams.set('sslmode', 'no-verify')
            process.env.DATABASE_URL = u.toString()
          }
        }
      } catch {
        // ignore invalid URLs
      }

      // Keep this loosely typed: API handlers often return `VercelResponse`, and we don't want
      // Vite's config TS project to type-check every function signature.
      const routes: Record<string, () => Promise<{ default: (req: any, res: any) => any }>> = {
        '/api/creator-allowlist': () => import('./api/_handlers/_creator-allowlist'),
        '/api/waitlist': () => import('./api/_handlers/_waitlist'),
        '/api/onchain/coinMarketRewardsByCoin': () => import('./api/_handlers/onchain/_coinMarketRewardsByCoin'),
        '/api/onchain/coinMarketRewardsCurrency': () => import('./api/_handlers/onchain/_coinMarketRewardsCurrency'),
        '/api/onchain/coinTradeRewardsBatch': () => import('./api/_handlers/onchain/_coinTradeRewardsBatch'),
        '/api/zora/coin': () => import('./api/_handlers/zora/_coin'),
        '/api/zora/explore': () => import('./api/_handlers/zora/_explore'),
        '/api/zora/profile': () => import('./api/_handlers/zora/_profile'),
        '/api/zora/profileCoins': () => import('./api/_handlers/zora/_profileCoins'),
        '/api/zora/topCreators': () => import('./api/_handlers/zora/_topCreators'),
        '/api/debank/totalBalanceBatch': () => import('./api/_handlers/debank/_totalBalanceBatch'),
        '/api/dexscreener/tokenStatsBatch': () => import('./api/_handlers/dexscreener/_tokenStatsBatch'),
        '/api/status/protocolReport': () => import('./api/_handlers/status/_protocolReport'),
        '/api/status/vaultReport': () => import('./api/_handlers/status/_vaultReport'),
        '/api/auth/nonce': () => import('./api/_handlers/auth/_nonce'),
        '/api/auth/privy': () => import('./api/_handlers/auth/_privy'),
        '/api/auth/verify': () => import('./api/_handlers/auth/_verify'),
        '/api/auth/me': () => import('./api/_handlers/auth/_me'),
        '/api/auth/logout': () => import('./api/_handlers/auth/_logout'),

        // Keepr (local dev)
        '/api/keepr/nonce': () => import('./api/_handlers/keepr/_nonce'),
        '/api/keepr/join': () => import('./api/_handlers/keepr/_join'),
        '/api/keepr/vault/upsert': () => import('./api/_handlers/keepr/vault/_upsert'),

        '/api/farcaster/me': () => import('./api/_handlers/farcaster/_me'),
        '/api/farcaster/nonce': () => import('./api/_handlers/farcaster/_nonce'),
        '/api/farcaster/verify': () => import('./api/_handlers/farcaster/_verify'),
        '/api/onchain/protocolRewardsClaimable': () => import('./api/_handlers/onchain/_protocolRewardsClaimable'),
        '/api/onchain/protocolRewardsWithdrawn': () => import('./api/_handlers/onchain/_protocolRewardsWithdrawn'),
        '/api/agent/invokeSkill': () => import('./api/_handlers/agent/_invokeSkill'),
        // Social proxies
        '/api/social/farcaster': () => import('./api/_handlers/social/_farcaster'),
        '/api/social/twitter': () => import('./api/_handlers/social/_twitter'),
        '/api/social/talent': () => import('./api/_handlers/social/_talent'),
      }

      server.middlewares.use(async (req, res, next) => {
        try {
          const host = req.headers.host ?? 'localhost'
          const url = new URL(req.url ?? '/', `http://${host}`)
          const loader = routes[url.pathname]
          if (!loader) return next()

          const mod = await loader()
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          await handler(makeVercelCompatReq(req as any), makeVercelCompatRes(res as any))
        } catch (e) {
          // Structured error logging for dev server
          const err = e instanceof Error ? e : new Error(String(e))
          console.error(`[local api routes] error: ${err.message}`, err.stack ? `\n${err.stack}` : '')
          if (!res.headersSent) {
            ;(res as any).statusCode = 500
            ;(res as any).setHeader?.('Content-Type', 'application/json')
          }
          ;(res as any).end?.(JSON.stringify({ success: false, error: 'Local API route failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const enableSourcemap = (() => {
    const raw = (process.env.VITE_BUILD_SOURCEMAP ?? '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes'
  })()

  return {
    plugins: [react(), ...(command === 'serve' ? [localApiRoutesPlugin()] : [])],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Wallet SDKs expect `buffer` to exist; map Node built-in to the browser shim.
      buffer: 'buffer/',
    },
    // pnpm can result in multiple copies of a package being bundled, which breaks React context
    // based libraries like Privy (provider + hooks must resolve to the same module instance).
    dedupe: ['@privy-io/react-auth', '@privy-io/wagmi'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    sourcemap: enableSourcemap,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          web3: ['wagmi', 'viem', '@coinbase/onchainkit'],
        },
      },
    },
  },
  }
})

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
  const query: Record<string, string | string[] | undefined> = {}
  // Avoid TS downlevel-iteration requirements by using forEach (Vite config runs in Node anyway).
  url.searchParams.forEach((v, k) => {
    // last value wins (good enough for our use-cases)
    query[k] = v
  })
  return Object.assign(req as any, { query, cookies: {}, body: undefined })
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

      // Keep this loosely typed: API handlers often return `VercelResponse`, and we don't want
      // Vite's config TS project to type-check every function signature.
      const routes: Record<string, () => Promise<{ default: (req: any, res: any) => any }>> = {
        '/api/onchain/coinMarketRewardsByCoin': () => import('./api/onchain/coinMarketRewardsByCoin'),
        '/api/onchain/coinMarketRewardsCurrency': () => import('./api/onchain/coinMarketRewardsCurrency'),
        '/api/onchain/coinTradeRewardsBatch': () => import('./api/onchain/coinTradeRewardsBatch'),
        '/api/zora/coin': () => import('./api/zora/coin'),
        '/api/zora/explore': () => import('./api/zora/explore'),
        '/api/zora/profile': () => import('./api/zora/profile'),
        '/api/zora/profileCoins': () => import('./api/zora/profileCoins'),
        '/api/zora/topCreators': () => import('./api/zora/topCreators'),
        '/api/debank/totalBalanceBatch': () => import('./api/debank/totalBalanceBatch'),
        '/api/dexscreener/tokenStatsBatch': () => import('./api/dexscreener/tokenStatsBatch'),
        '/api/status/protocolReport': () => import('./api/status/protocolReport'),
        '/api/status/vaultReport': () => import('./api/status/vaultReport'),
        '/api/auth/nonce': () => import('./api/auth/nonce'),
        '/api/auth/verify': () => import('./api/auth/verify'),
        '/api/auth/me': () => import('./api/auth/me'),
        '/api/auth/logout': () => import('./api/auth/logout'),
        '/api/onchain/protocolRewardsClaimable': () => import('./api/onchain/protocolRewardsClaimable'),
        '/api/onchain/protocolRewardsWithdrawn': () => import('./api/onchain/protocolRewardsWithdrawn'),
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
          console.error('[local api routes] error', e)
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

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' ? [localApiRoutesPlugin()] : [])],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          web3: ['wagmi', 'viem', '@coinbase/onchainkit'],
        },
      },
    },
  },
}))

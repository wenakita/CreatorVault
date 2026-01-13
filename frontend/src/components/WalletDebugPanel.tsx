import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'
import { CheckCircle2, Copy, XCircle } from 'lucide-react'

import { useFarcasterAuth, useMiniAppContext } from '@/hooks'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useWeb3 } from '@/web3/Web3Context'
import { getPrivyRuntime } from '@/config/privy'

function isDebugEnabled(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('debug') === '1' || params.get('debugWallet') === '1'
}

function shortAddress(addr: string): string {
  if (!addr.startsWith('0x') || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function DebugRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 shrink-0">{k}</div>
      <div className="text-xs text-zinc-200 font-mono text-right break-all">{v}</div>
    </div>
  )
}

export function WalletDebugPanel() {
  const location = useLocation()
  const enabled = useMemo(() => isDebugEnabled(location.search), [location.search])

  const web3 = useWeb3()
  const mini = useMiniAppContext()
  const farcaster = useFarcasterAuth()
  const siwe = useSiweAuth()

  const { address, isConnected, chain, connector, status: accountStatus } = useAccount()
  const { connectors } = useConnect()

  const [copied, setCopied] = useState(false)

  const privy = getPrivyRuntime()
  const privyConfigured = Boolean(privy.appId)
  const privyEnabled = privy.enabled

  const connectorId = connector?.id ? String(connector.id) : '—'
  const connectorName = connector?.name ? String(connector.name) : '—'

  const miniFlag =
    mini.isMiniApp === null ? 'unknown' : mini.isMiniApp === true ? 'yes' : 'no'

  const farcasterSummary =
    farcaster.status === 'verified' && farcaster.fid
      ? `verified (fid=${farcaster.fid})`
      : farcaster.status

  const siweSummary = siwe.isSignedIn
    ? `signed-in (${shortAddress(siwe.authAddress || '')})`
    : 'not signed-in'

  const chainSummary = chain?.id ? `${chain.id}${chain?.name ? ` (${chain.name})` : ''}` : '—'

  const availableConnectors = useMemo(() => {
    const ids = connectors.map((c) => String(c.id || c.name || 'unknown'))
    return ids.length > 0 ? ids.join(', ') : '—'
  }, [connectors])

  const debugPayload = useMemo(() => {
    return {
      route: `${location.pathname}${location.search}${location.hash}`,
      web3: { status: web3.status },
      miniApp: { isMiniApp: mini.isMiniApp, fid: mini.fid, username: mini.username },
      farcasterAuth: {
        status: farcaster.status,
        fid: farcaster.fid,
        canQuickAuth: farcaster.canQuickAuth,
        canSiwf: farcaster.canSiwf,
        error: farcaster.error,
      },
      siwe: { isSignedIn: siwe.isSignedIn, authAddress: siwe.authAddress, error: siwe.error },
      wallet: {
        status: accountStatus,
        isConnected,
        address,
        connector: { id: connectorId, name: connectorName },
        chain: { id: chain?.id ?? null, name: chain?.name ?? null },
        privy: {
          configured: privyConfigured,
          enabled: privyEnabled,
          origin: privy.origin,
          allowedOrigins: privy.allowedOrigins,
        },
        availableConnectors,
      },
    }
  }, [
    accountStatus,
    address,
    availableConnectors,
    chain?.id,
    chain?.name,
    connectorId,
    connectorName,
    farcaster.canQuickAuth,
    farcaster.canSiwf,
    farcaster.error,
    farcaster.fid,
    farcaster.status,
    isConnected,
    location.hash,
    location.pathname,
    location.search,
    mini.fid,
    mini.isMiniApp,
    mini.username,
    privy.allowedOrigins,
    privy.origin,
    privyConfigured,
    privyEnabled,
    siwe.authAddress,
    siwe.error,
    siwe.isSignedIn,
    web3.status,
  ])

  if (!enabled) return null

  return (
    <div className="fixed bottom-20 left-4 z-[999] w-[min(460px,calc(100vw-2rem))] rounded-xl border border-zinc-800 bg-black/80 backdrop-blur p-4 text-zinc-300 shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Wallet debug</div>
          <div className="mt-1 text-xs text-zinc-400">
            {copied ? (
              <span className="inline-flex items-center gap-2 text-emerald-300/90">
                <CheckCircle2 className="w-4 h-4" />
                Copied
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <XCircle className="w-4 h-4 text-zinc-600" />
                Add <span className="font-mono text-zinc-300">?debug=1</span> (or <span className="font-mono text-zinc-300">?debugWallet=1</span>)
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            } catch {
              // ignore
            }
          }}
          aria-label="Copy debug JSON"
          title="Copy debug JSON"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <DebugRow k="route" v={`${location.pathname}${location.search}${location.hash}`} />
        <DebugRow k="web3" v={web3.status} />
        <DebugRow k="miniapp" v={miniFlag} />
        <DebugRow k="farcaster" v={farcasterSummary} />
        <DebugRow k="siwe" v={siweSummary} />
        <DebugRow k="wallet" v={isConnected && address ? shortAddress(address) : accountStatus} />
        <DebugRow k="connector" v={`${connectorName} (${connectorId})`} />
        <DebugRow k="chain" v={chainSummary} />
        <DebugRow k="privy" v={privyEnabled ? 'enabled' : privyConfigured ? 'configured (disabled)' : 'not configured'} />
        <DebugRow k="connectors" v={availableConnectors} />
      </div>
    </div>
  )
}


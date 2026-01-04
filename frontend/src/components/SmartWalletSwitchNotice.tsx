import { useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { ChevronRight, ShieldCheck } from 'lucide-react'

import { useZoraProfile } from '@/lib/zora/hooks'

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function getDetectedSmartWallet(profile: any): Address | null {
  const edges = profile?.linkedWallets?.edges ?? []
  for (const e of edges) {
    const n: any = (e as any)?.node
    const t = typeof n?.walletType === 'string' ? n.walletType : ''
    const a = typeof n?.walletAddress === 'string' ? n.walletAddress : ''
    if (String(t).toUpperCase() !== 'SMART_WALLET') continue
    if (isAddress(a)) return a as Address
  }
  return null
}

export function SmartWalletSwitchNotice({
  context = 'vault',
  className = '',
}: {
  context?: 'vault' | 'auction'
  className?: string
}) {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const [localError, setLocalError] = useState<string | null>(null)
  const [requestedSwitch, setRequestedSwitch] = useState(false)

  const profileQuery = useZoraProfile(address ?? undefined)
  const detectedSmartWallet = useMemo(() => getDetectedSmartWallet(profileQuery.data), [profileQuery.data])

  const coinbaseConnector = useMemo(
    () => connectors.find((c) => c.id === 'coinbaseWalletSDK' || c.name?.toLowerCase().includes('coinbase')),
    [connectors],
  )

  const isInjectedEoa = connector?.id === 'injected'
  const addressLc = (address ?? '').toLowerCase()
  const smartLc = (detectedSmartWallet ?? '').toLowerCase()

  const shouldShow =
    isConnected &&
    isInjectedEoa &&
    !!coinbaseConnector &&
    !!detectedSmartWallet &&
    isAddress(detectedSmartWallet) &&
    smartLc !== addressLc

  const title = context === 'auction' ? 'Auction actions use Smart Wallet' : 'Vault actions use Smart Wallet'
  const subtitle =
    context === 'auction'
      ? 'Switch to Coinbase Smart Wallet to bid and complete auction steps.'
      : 'Switch to Coinbase Smart Wallet to deposit and withdraw.'

  function handleSwitch() {
    if (!coinbaseConnector) return
    setLocalError(null)
    setRequestedSwitch(true)
    // Most wallets don’t support “switch connector while connected”.
    // Do a safe disconnect → connect sequence.
    try {
      disconnect()
      setTimeout(() => {
        connect({ connector: coinbaseConnector })
      }, 0)
    } catch (e: unknown) {
      setRequestedSwitch(false)
      const msg = e instanceof Error ? e.message : 'Failed to switch wallet'
      setLocalError(msg)
    }
  }

  if (!shouldShow) return null

  return (
    <div className={`rounded-xl border border-white/10 bg-black/30 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <div className="text-sm text-zinc-200 font-light">{title}</div>
          </div>
          <div className="text-xs text-zinc-600 mt-1">{subtitle}</div>

          <div className="mt-3 text-[11px] text-zinc-600 font-mono tabular-nums">
            Smart Wallet:{' '}
            <a
              href={`https://basescan.org/address/${detectedSmartWallet}`}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title={detectedSmartWallet}
            >
              {shortAddress(detectedSmartWallet)}
            </a>
          </div>

          {localError ? <div className="mt-2 text-[11px] text-red-400/90">{localError}</div> : null}
        </div>

        <button
          type="button"
          onClick={handleSwitch}
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg btn-accent px-4 py-3 text-xs disabled:opacity-60"
          title="Disconnects your current wallet session and reconnects via Coinbase Smart Wallet"
        >
          {isPending || requestedSwitch ? 'Switching…' : 'Switch to Coinbase Smart Wallet'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}



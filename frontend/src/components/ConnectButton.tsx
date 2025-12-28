import { lazy, Suspense, useCallback, useState } from 'react'
import { Wallet } from 'lucide-react'

import { useWeb3 } from '@/web3/Web3Context'

const ConnectButtonWeb3 = lazy(async () => {
  const m = await import('./ConnectButtonWeb3')
  return { default: m.ConnectButtonWeb3 }
})

export function ConnectButton() {
  const { status, enable } = useWeb3()
  const [autoConnect, setAutoConnect] = useState(false)

  const startWeb3 = useCallback(() => {
    setAutoConnect(true)
    enable()
  }, [enable])

  if (status === 'disabled') {
    return (
      <button onClick={startWeb3} className="btn-accent">
        <Wallet className="w-4 h-4 inline mr-2" />
        <span className="label">Connect Wallet</span>
      </button>
    )
  }

  if (status === 'loading') {
    return (
      <button disabled className="btn-accent disabled:opacity-50">
        <Wallet className="w-4 h-4 inline mr-2" />
        <span className="label">Loading…</span>
      </button>
    )
  }

  return (
    <Suspense
      fallback={
        <button disabled className="btn-accent disabled:opacity-50">
          <Wallet className="w-4 h-4 inline mr-2" />
          <span className="label">Loading…</span>
        </button>
      }
    >
      <ConnectButtonWeb3 autoConnect={autoConnect} />
    </Suspense>
  )
}

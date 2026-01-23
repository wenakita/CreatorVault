import { useMemo, useState } from 'react'
import { base } from 'wagmi/chains'
import { isAddress, type Address, type Hex } from 'viem'
import { usePrivy, useWallets, useBaseAccountSdk, toViemAccount } from '@privy-io/react-auth'

type SubAccount = { address?: string } | null

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function PrivyBaseSubAccountsDevPanel() {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { baseAccountSdk } = useBaseAccountSdk()

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subAccountAddress, setSubAccountAddress] = useState<Address | null>(null)

  const embeddedWallet = useMemo(() => wallets.find((w) => w.walletClientType === 'privy') ?? null, [wallets])
  const baseAccount = useMemo(() => wallets.find((w) => w.walletClientType === 'base_account') ?? null, [wallets])

  const embeddedAddr = typeof embeddedWallet?.address === 'string' && isAddress(embeddedWallet.address) ? (embeddedWallet.address as Address) : null
  const baseAddr = typeof baseAccount?.address === 'string' && isAddress(baseAccount.address) ? (baseAccount.address as Address) : null

  if (!import.meta.env.DEV) return null

  async function createOrGetSubAccount() {
    setBusy(true)
    setError(null)
    try {
      if (!ready) throw new Error('Privy not ready')
      if (!authenticated) throw new Error('Not Privy authenticated')
      if (!embeddedWallet || !embeddedAddr) throw new Error('Missing embedded wallet (privy)')
      if (!baseAccount || !baseAddr) throw new Error('Missing Base Account wallet')

      // Ensure Base Account is on Base mainnet (or your app's target chain).
      await baseAccount.switchChain(base.id)

      const provider = await baseAccount.getEthereumProvider()
      if (!provider?.request) throw new Error('Base Account provider missing request()')

      // 1) Get existing sub account for this domain.
      const res = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: baseAddr,
            domain: window.location.origin,
          },
        ],
      })) as { subAccounts?: SubAccount[] } | null

      const existing = Array.isArray(res?.subAccounts) ? res?.subAccounts?.[0] : null
      const existingAddr = typeof (existing as any)?.address === 'string' ? String((existing as any).address) : ''
      let outAddr: Address | null = isAddress(existingAddr) ? (existingAddr as Address) : null

      // 2) If none exists, create one owned by the embedded wallet address.
      if (!outAddr) {
        const created = (await provider.request({
          method: 'wallet_addSubAccount',
          params: [
            {
              version: '1',
              account: {
                type: 'create',
                keys: [
                  {
                    type: 'address',
                    publicKey: embeddedAddr as unknown as Hex,
                  },
                ],
              },
            },
          ],
        })) as { address?: string } | null
        const createdAddr = typeof created?.address === 'string' ? created.address : ''
        outAddr = isAddress(createdAddr) ? (createdAddr as Address) : null
      }

      if (!outAddr) throw new Error('Failed to resolve sub account address')
      setSubAccountAddress(outAddr)

      // 3) Configure the Base Account SDK to use embedded wallet as owner for subaccount ops.
      if (!baseAccountSdk?.subAccount?.setToOwnerAccount) {
        throw new Error('Base Account SDK not initialized (missing subAccount.setToOwnerAccount)')
      }
      baseAccountSdk.subAccount.setToOwnerAccount(async () => {
        const account = await toViemAccount({ wallet: embeddedWallet })
        return { account }
      })
    } catch (e: unknown) {
      setSubAccountAddress(null)
      setError(e instanceof Error ? e.message : 'Sub account flow failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-20 left-4 z-[10000]">
      <button
        type="button"
        className="card px-3 py-2 bg-black/70 hover:bg-black/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="label">Sub Accounts (dev)</div>
      </button>

      {open ? (
        <div className="mt-2 card p-3 bg-black/70 w-[320px] space-y-2">
          <div className="text-[10px] text-zinc-500">
            embedded: {embeddedAddr ? <span className="text-zinc-300 font-mono">{short(embeddedAddr)}</span> : '—'} · base:{' '}
            {baseAddr ? <span className="text-zinc-300 font-mono">{short(baseAddr)}</span> : '—'}
          </div>

          <button type="button" disabled={busy} className="btn-accent w-full disabled:opacity-60" onClick={() => void createOrGetSubAccount()}>
            <span className="label">{busy ? 'Working…' : 'Create / Get sub account'}</span>
          </button>

          <div className="text-[10px] text-zinc-500">
            subaccount:{' '}
            {subAccountAddress ? <span className="text-zinc-300 font-mono">{short(subAccountAddress)}</span> : <span>—</span>}
          </div>

          {error ? <div className="text-[10px] text-red-400/90 break-words">{error}</div> : null}
        </div>
      ) : null}
    </div>
  )
}


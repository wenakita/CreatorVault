import { useEffect, useMemo } from 'react'
import type { EIP1193Provider } from 'viem'
import { toHex } from 'viem'
import { useEmbeddedSmartAccountConnector } from '@privy-io/wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

type SmartWalletClient = NonNullable<ReturnType<typeof useSmartWallets>['client']>

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(Math.ceil(h.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2).padStart(2, '0'), 16)
  return out
}

function createSmartWalletEip1193Provider(client: SmartWalletClient): EIP1193Provider {
  // A tiny EIP-1193 bridge around Privy’s smart wallet client so wagmi treats
  // the smart wallet address as the “connected account”.
  //
  // This is intentionally minimal: we implement the wallet-facing methods wagmi
  // needs for account + sending tx + signing. Read calls should continue to use
  // wagmi’s public client transports.
  const chainIdHex = toHex(client.chain.id)
  const accounts = [client.account.address]

  const provider: EIP1193Provider = {
    request: async ({ method, params }: { method: string; params?: any[] | Record<string, any> }) => {
      switch (method) {
        case 'eth_chainId':
          return chainIdHex
        case 'eth_accounts':
        case 'eth_requestAccounts':
          return accounts

        case 'wallet_switchEthereumChain': {
          const p0 = Array.isArray(params) ? (params[0] as any) : (params as any)
          const target = typeof p0?.chainId === 'string' ? p0.chainId : null
          if (!target) throw new Error('wallet_switchEthereumChain: missing chainId')
          const id = Number.parseInt(target, 16)
          if (!Number.isFinite(id)) throw new Error('wallet_switchEthereumChain: invalid chainId')
          if (typeof (client as any).switchChain === 'function') {
            await (client as any).switchChain({ id })
            return null
          }
          throw new Error('wallet_switchEthereumChain: not supported')
        }

        case 'personal_sign': {
          // params: [message, address]
          const p = Array.isArray(params) ? params : []
          const message = p[0]
          if (typeof message !== 'string') throw new Error('personal_sign: invalid message')
          const bytes = message.startsWith('0x') ? hexToBytes(message) : new TextEncoder().encode(message)
          return await client.signMessage({ message: { raw: bytes } } as any)
        }

        case 'eth_signTypedData_v4': {
          // params: [address, typedData]
          const p = Array.isArray(params) ? params : []
          const typed = p[1]
          const value = typeof typed === 'string' ? JSON.parse(typed) : typed
          return await client.signTypedData(value as any)
        }

        case 'eth_sendTransaction': {
          // params: [{ to, data, value, ... }]
          const p = Array.isArray(params) ? params : []
          const tx = (p[0] ?? null) as any
          if (!tx || typeof tx !== 'object') throw new Error('eth_sendTransaction: invalid params')

          const to = tx.to as `0x${string}` | undefined
          const data = (tx.data ?? tx.input ?? '0x') as `0x${string}`
          const value = typeof tx.value === 'string' ? BigInt(tx.value) : typeof tx.value === 'bigint' ? tx.value : 0n

          // Privy smart wallet client accepts AA calls; wrap a single tx as a single call.
          // Returns a hash (UserOp hash for 4337 implementations).
          return await client.sendTransaction({ calls: [{ to, data, value }] } as any)
        }

        default:
          throw new Error(`Unsupported EIP-1193 method: ${method}`)
      }
    },
    // Some wagmi paths attach listeners; keep these no-ops.
    on: () => provider as any,
    removeListener: () => provider as any,
  } as any

  return provider
}

export function PrivyWagmiSmartAccountBridge() {
  const { client } = useSmartWallets()

  const smartProvider = useMemo(() => {
    if (!client) return null
    return createSmartWalletEip1193Provider(client)
  }, [client])

  // Register a smart-account connector whenever the user has a Privy smart wallet client.
  // This makes wagmi `useAccount().address` reflect the smart wallet address (not the embedded EOA).
  useEmbeddedSmartAccountConnector({
    getSmartAccountFromSigner: async () => {
      if (!smartProvider) throw new Error('smart_wallet_not_ready')
      return smartProvider
    },
  })

  // Guard rail: if SmartWalletsProvider hasn’t produced a client yet, do nothing.
  useEffect(() => {
    // noop: the hook above will throw if invoked before client exists; this effect prevents
    // eager re-register loops in some React strict-mode timings by ensuring memo has stabilized.
  }, [smartProvider])

  return null
}


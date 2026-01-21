import { createConnector } from 'wagmi'
import type { EIP1193Provider } from 'viem'
import { toPrivyWalletProvider } from '@privy-io/cross-app-connect'

export const ZORA_PRIVY_PROVIDER_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb' as const

export function zoraGlobalWalletConnector() {
  return createConnector(((config: any) => {
    let providerPromise: Promise<EIP1193Provider> | null = null

    async function getProvider(): Promise<EIP1193Provider> {
      if (!providerPromise) {
        providerPromise = Promise.resolve(
          toPrivyWalletProvider({
            providerAppId: ZORA_PRIVY_PROVIDER_APP_ID,
            // `toPrivyWalletProvider` expects a list/tuple of chains; keep wagmi's canonical config shape.
            chains: config.chains as any,
            // Read-only provider: no signatures/txs, but still allow address access.
            smartWalletMode: false,
          }) as unknown as EIP1193Provider,
        )
      }
      return providerPromise
    }

    return {
      id: 'privy-zora',
      name: 'Zora (read-only)',
      type: 'injected',

      async getProvider() {
        return await getProvider()
      },

      async connect() {
        const p = await getProvider()
        // This triggers the cross-app consent flow.
        await p.request?.({ method: 'eth_requestAccounts' })
        const accounts = (await p.request?.({ method: 'eth_accounts' })) as `0x${string}`[] | undefined
        const chainIdHex = (await p.request?.({ method: 'eth_chainId' })) as string | undefined
        const chainId = chainIdHex ? Number(chainIdHex) : (config.chains[0]?.id ?? 1)
        return { accounts: (accounts ?? []) as `0x${string}`[], chainId }
      },

      async disconnect() {
        // No-op: provider session is handled by Privy popups/consent.
      },

      async getAccounts() {
        const p = await getProvider()
        const accounts = (await p.request?.({ method: 'eth_accounts' })) as `0x${string}`[] | undefined
        return (accounts ?? []) as `0x${string}`[]
      },

      async getChainId() {
        const p = await getProvider()
        const chainIdHex = (await p.request?.({ method: 'eth_chainId' })) as string | undefined
        return chainIdHex ? Number(chainIdHex) : (config.chains[0]?.id ?? 1)
      },

      async isAuthorized() {
        try {
          const accounts = await this.getAccounts()
          return accounts.length > 0
        } catch {
          return false
        }
      },

      // wagmi connector event hooks (best-effort; read-only connector)
      onAccountsChanged(accounts: any) {
        ;(config.emitter as any).emit('change', { accounts })
      },
      onChainChanged(chainId: any) {
        const n = typeof chainId === 'string' ? Number(chainId) : chainId
        ;(config.emitter as any).emit('change', { chainId: n })
      },
      onDisconnect() {
        ;(config.emitter as any).emit('disconnect')
      },
    } as any
  }) as any)
}


import { createConnector, ChainNotConfiguredError } from '@wagmi/core'
import { getAddress, numberToHex, SwitchChainError, UserRejectedRequestError } from 'viem'

/**
 * Coinbase Smart Wallet connector (forces Smart Wallet account selection).
 *
 * Why this exists:
 * - For gas-free, paymaster-backed `wallet_sendCalls`, wagmi must be connected to a connector
 *   that can submit calls **as the Smart Wallet account**.
 * - The default `coinbaseWallet` connector can show EOA accounts when `preference.options = 'all'`.
 * - Some users connect via `injected()` which cannot operate on Smart Wallet addresses.
 */
export function coinbaseSmartWallet(parameters: {
  appName: string
  appLogoUrl?: string | null
}): ReturnType<typeof createConnector> {
  let walletProvider: any
  let accountsChanged: any
  let chainChanged: any
  let disconnect: any

  return createConnector((config) => ({
    id: 'coinbaseSmartWallet',
    name: 'Coinbase Smart Wallet',
    rdns: 'com.coinbase.wallet',
    type: 'coinbaseWallet',

    async connect({ chainId, withCapabilities, ...rest }: any = {}) {
      try {
        const provider = await this.getProvider()
        const accounts = (await provider.request({
          method: 'eth_requestAccounts',
          params: 'instantOnboarding' in rest && rest.instantOnboarding ? [{ onboarding: 'instant' }] : [],
        }))
          .map((x: string) => getAddress(x))

        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this)
          provider.on('accountsChanged', accountsChanged)
        }
        if (!chainChanged) {
          chainChanged = this.onChainChanged.bind(this)
          provider.on('chainChanged', chainChanged)
        }
        if (!disconnect) {
          disconnect = this.onDisconnect.bind(this)
          provider.on('disconnect', disconnect)
        }

        let currentChainId = await this.getChainId()
        if (chainId && currentChainId !== chainId) {
          const chain = await this.switchChain({ chainId }).catch((error: any) => {
            if (error.code === UserRejectedRequestError.code) throw error
            return { id: currentChainId }
          })
          currentChainId = chain?.id ?? currentChainId
        }

        return {
          accounts: (withCapabilities ? accounts.map((address: string) => ({ address, capabilities: {} })) : accounts),
          chainId: currentChainId,
        }
      } catch (error: any) {
        if (/(user closed modal|accounts received is empty|user denied account|request rejected)/i.test(error?.message)) {
          throw new UserRejectedRequestError(error)
        }
        throw error
      }
    },

    async disconnect() {
      const provider = await this.getProvider()
      if (accountsChanged) {
        provider.removeListener('accountsChanged', accountsChanged)
        accountsChanged = undefined
      }
      if (chainChanged) {
        provider.removeListener('chainChanged', chainChanged)
        chainChanged = undefined
      }
      if (disconnect) {
        provider.removeListener('disconnect', disconnect)
        disconnect = undefined
      }
      provider.disconnect()
      provider.close?.()
    },

    async getAccounts() {
      const provider = await this.getProvider()
      return (await provider.request({ method: 'eth_accounts' })).map((x: string) => getAddress(x))
    },

    async getChainId() {
      const provider = await this.getProvider()
      const chainId = await provider.request({ method: 'eth_chainId' })
      return Number(chainId)
    },

    async getProvider() {
      if (!walletProvider) {
        const { createCoinbaseWalletSDK } = await import('@coinbase/wallet-sdk')
        const sdk = createCoinbaseWalletSDK({
          appName: parameters.appName,
          appLogoUrl: parameters.appLogoUrl ?? null,
          appChainIds: config.chains.map((x) => x.id),
          preference: {
            options: 'smartWalletOnly',
          },
        })
        walletProvider = sdk.getProvider()
      }
      return walletProvider
    },

    async isAuthorized() {
      try {
        const accounts = await this.getAccounts()
        return !!accounts.length
      } catch {
        return false
      }
    },

    async switchChain({ addEthereumChainParameter, chainId }: any) {
      const chain = config.chains.find((chain) => chain.id === chainId)
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

      const provider = await this.getProvider()
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chain.id) }],
        })
        return chain
      } catch (error: any) {
        if (error.code === 4902) {
          try {
            const blockExplorerUrls =
              addEthereumChainParameter?.blockExplorerUrls ?? (chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [])
            const rpcUrls =
              addEthereumChainParameter?.rpcUrls?.length ? addEthereumChainParameter.rpcUrls : [chain.rpcUrls.default?.http[0] ?? '']

            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  blockExplorerUrls,
                  chainId: numberToHex(chainId),
                  chainName: addEthereumChainParameter?.chainName ?? chain.name,
                  iconUrls: addEthereumChainParameter?.iconUrls,
                  nativeCurrency: addEthereumChainParameter?.nativeCurrency ?? chain.nativeCurrency,
                  rpcUrls,
                },
              ],
            })
            return chain
          } catch (error: any) {
            throw new UserRejectedRequestError(error)
          }
        }
        throw new SwitchChainError(error)
      }
    },

    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) this.onDisconnect()
      else config.emitter.emit('change', { accounts: accounts.map((x) => getAddress(x)) })
    },

    onChainChanged(chain: string) {
      const chainId = Number(chain)
      config.emitter.emit('change', { chainId })
    },

    async onDisconnect(_error?: any) {
      config.emitter.emit('disconnect')
      const provider = await this.getProvider()
      if (accountsChanged) {
        provider.removeListener('accountsChanged', accountsChanged)
        accountsChanged = undefined
      }
      if (chainChanged) {
        provider.removeListener('chainChanged', chainChanged)
        chainChanged = undefined
      }
      if (disconnect) {
        provider.removeListener('disconnect', disconnect)
        disconnect = undefined
      }
    },
  }))
}

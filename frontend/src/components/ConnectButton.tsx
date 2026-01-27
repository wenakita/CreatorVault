import { ConnectButtonWeb3 } from './ConnectButtonWeb3'

/**
 * Simple wrapper around ConnectButtonWeb3.
 * Web3 is always available since providers are loaded at app startup.
 */
export function ConnectButton() {
  return <ConnectButtonWeb3 />
}

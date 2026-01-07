import { CdpClient } from '@coinbase/cdp-sdk'

declare const process: { env: Record<string, string | undefined> }

export type CdpAuthConfig = {
  apiKeyId: string
  apiKeySecret: string
  walletSecret: string
}

function getCdpAuth(): CdpAuthConfig | null {
  const apiKeyId = (process.env.CDP_API_KEY_ID ?? '').trim()
  const apiKeySecret = (process.env.CDP_API_KEY_SECRET ?? '').trim()
  const walletSecret = (process.env.CDP_WALLET_SECRET ?? '').trim()
  if (!apiKeyId || !apiKeySecret || !walletSecret) return null
  return { apiKeyId, apiKeySecret, walletSecret }
}

export function getCdpClient(): CdpClient {
  const auth = getCdpAuth()
  if (!auth) {
    throw new Error('CDP server credentials are not configured')
  }
  return new CdpClient({
    apiKeyId: auth.apiKeyId,
    apiKeySecret: auth.apiKeySecret,
    walletSecret: auth.walletSecret,
  })
}

function shortIdForAddress(address: string): string {
  const addr = address.toLowerCase().replace(/^0x/, '')
  return `${addr.slice(0, 8)}-${addr.slice(-4)}`
}

export function makeOwnerAccountName(address: string): string {
  return `cv-o-${shortIdForAddress(address)}`
}

export function makeSmartAccountName(address: string): string {
  return `cv-sa-${shortIdForAddress(address)}`
}

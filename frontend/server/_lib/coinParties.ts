declare const process: { env: Record<string, string | undefined> }

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getBaseRpcUrl(): string {
  const env = process.env.BASE_RPC_URL
  if (env && env.length > 0) return env
  return 'https://mainnet.base.org'
}

const COIN_VIEW_ABI = [
  { type: 'function', name: 'creator', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'payoutRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

export async function resolveCoinParties(
  coin: `0x${string}`,
): Promise<{ creator: `0x${string}` | null; payoutRecipient: `0x${string}` | null }> {
  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
    })

    const [creator, payoutRecipient] = await Promise.all([
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'creator' }).catch(() => null),
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'payoutRecipient' }).catch(() => null),
    ])

    const c = typeof creator === 'string' && isAddressLike(creator) ? (creator.toLowerCase() as `0x${string}`) : null
    const p =
      typeof payoutRecipient === 'string' && isAddressLike(payoutRecipient) ? (payoutRecipient.toLowerCase() as `0x${string}`) : null
    return { creator: c, payoutRecipient: p }
  } catch {
    return { creator: null, payoutRecipient: null }
  }
}

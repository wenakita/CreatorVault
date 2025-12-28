import type { Address, PublicClient } from 'viem'
import { isAddress } from 'viem'

import { CONTRACTS } from '@/config/contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const CREATOR_REGISTRY_VIEW_ABI = [
  {
    type: 'function',
    name: 'getVaultForToken',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getWrapperForToken',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const

const PAYOUT_ROUTER_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'computeAddress',
    stateMutability: 'view',
    inputs: [
      { name: '_wrapper', type: 'address' },
      { name: '_owner', type: 'address' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isDeployed',
    stateMutability: 'view',
    inputs: [
      { name: '_wrapper', type: 'address' },
      { name: '_owner', type: 'address' },
    ],
    outputs: [
      { name: 'deployed', type: 'bool' },
      { name: 'router', type: 'address' },
    ],
  },
] as const

export type CreatorVaultRoutingInfo = {
  token: Address
  vault: Address | null
  wrapper: Address | null
  expectedPayoutRouter: Address | null
  payoutRouterDeployed: boolean | null
  payoutRecipient: Address | null
  /** True when payoutRecipient == expectedPayoutRouter and the router is deployed. */
  isCreatorVaultRouted: boolean
}

export async function fetchCreatorVaultRoutingInfo(
  publicClient: PublicClient,
  coins: Array<{
    token: Address
    creatorAddress?: Address | null
    payoutRecipientAddress?: Address | null
  }>,
): Promise<Record<string, CreatorVaultRoutingInfo>> {
  const registry = CONTRACTS.registry as Address
  const payoutRouterFactory = CONTRACTS.payoutRouterFactory as Address

  const inputs = coins
    .filter((c) => isAddress(c.token))
    .map((c) => ({
      token: c.token,
      creatorAddress: c.creatorAddress && isAddress(c.creatorAddress) ? c.creatorAddress : null,
      payoutRecipientAddress:
        c.payoutRecipientAddress && isAddress(c.payoutRecipientAddress) ? c.payoutRecipientAddress : null,
    }))

  if (inputs.length === 0) return {}

  const vaultWrapperResults = await publicClient.multicall({
    contracts: inputs.flatMap((c) => [
      {
        address: registry,
        abi: CREATOR_REGISTRY_VIEW_ABI,
        functionName: 'getVaultForToken',
        args: [c.token],
      },
      {
        address: registry,
        abi: CREATOR_REGISTRY_VIEW_ABI,
        functionName: 'getWrapperForToken',
        args: [c.token],
      },
    ]),
    allowFailure: true,
  })

  // Build per-token vault+wrapper
  const vaultByToken = new Map<string, Address | null>()
  const wrapperByToken = new Map<string, Address | null>()

  for (let i = 0; i < inputs.length; i++) {
    const token = inputs[i].token
    const tokenKey = token.toLowerCase()

    const vaultRes = vaultWrapperResults[i * 2]
    const wrapperRes = vaultWrapperResults[i * 2 + 1]

    const vault =
      vaultRes?.status === 'success' && isAddress(vaultRes.result as any)
        ? (vaultRes.result as Address)
        : null
    const wrapper =
      wrapperRes?.status === 'success' && isAddress(wrapperRes.result as any)
        ? (wrapperRes.result as Address)
        : null

    vaultByToken.set(tokenKey, vault && vault !== ZERO_ADDRESS ? vault : null)
    wrapperByToken.set(tokenKey, wrapper && wrapper !== ZERO_ADDRESS ? wrapper : null)
  }

  // Compute expected router + deployed status for tokens that have wrapper + creator
  const routerPairs = inputs
    .map((c) => {
      const wrapper = wrapperByToken.get(c.token.toLowerCase()) ?? null
      if (!wrapper) return null
      if (!c.creatorAddress) return null
      return { token: c.token, wrapper, owner: c.creatorAddress }
    })
    .filter(Boolean) as Array<{ token: Address; wrapper: Address; owner: Address }>

  const routerResults = routerPairs.length
    ? await publicClient.multicall({
        contracts: routerPairs.flatMap((p) => [
          {
            address: payoutRouterFactory,
            abi: PAYOUT_ROUTER_FACTORY_VIEW_ABI,
            functionName: 'computeAddress',
            args: [p.wrapper, p.owner],
          },
          {
            address: payoutRouterFactory,
            abi: PAYOUT_ROUTER_FACTORY_VIEW_ABI,
            functionName: 'isDeployed',
            args: [p.wrapper, p.owner],
          },
        ]),
        allowFailure: true,
      })
    : []

  const expectedRouterByToken = new Map<string, Address | null>()
  const deployedByToken = new Map<string, boolean | null>()

  for (let i = 0; i < routerPairs.length; i++) {
    const tokenKey = routerPairs[i].token.toLowerCase()

    const expectedRes = routerResults[i * 2]
    const deployedRes = routerResults[i * 2 + 1]

    const expected =
      expectedRes?.status === 'success' && isAddress(expectedRes.result as any)
        ? (expectedRes.result as Address)
        : null

    const deployed =
      deployedRes?.status === 'success'
        ? Boolean((deployedRes.result as any)?.[0] ?? (deployedRes.result as any)?.deployed)
        : null

    expectedRouterByToken.set(tokenKey, expected && expected !== ZERO_ADDRESS ? expected : null)
    deployedByToken.set(tokenKey, deployed)
  }

  const out: Record<string, CreatorVaultRoutingInfo> = {}

  for (const c of inputs) {
    const tokenKey = c.token.toLowerCase()
    const vault = vaultByToken.get(tokenKey) ?? null
    const wrapper = wrapperByToken.get(tokenKey) ?? null
    const expectedPayoutRouter = expectedRouterByToken.get(tokenKey) ?? null
    const payoutRouterDeployed = deployedByToken.get(tokenKey) ?? null
    const payoutRecipient = c.payoutRecipientAddress ?? null

    const isCreatorVaultRouted = Boolean(
      payoutRecipient &&
        expectedPayoutRouter &&
        payoutRecipient.toLowerCase() === expectedPayoutRouter.toLowerCase() &&
        payoutRouterDeployed === true,
    )

    out[tokenKey] = {
      token: c.token,
      vault,
      wrapper,
      expectedPayoutRouter,
      payoutRouterDeployed,
      payoutRecipient,
      isCreatorVaultRouted,
    }
  }

  return out
}



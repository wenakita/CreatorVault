import { useQuery } from '@tanstack/react-query'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export type CreatorAllowlistMode = 'disabled' | 'enforced'

export type CreatorAllowlistStatus = {
  address: string | null
  mode: CreatorAllowlistMode
  allowed: boolean
}

async function fetchCreatorAllowlistStatus(address: string): Promise<CreatorAllowlistStatus> {
  const qs = new URLSearchParams()
  qs.set('address', address)
  const res = await fetch(`/api/creator-allowlist?${qs.toString()}`, { method: 'GET' })
  if (!res.ok) throw new Error(`Allowlist check failed (${res.status})`)
  const json = (await res.json()) as ApiEnvelope<CreatorAllowlistStatus>
  if (!json.success) throw new Error(json.error || 'Allowlist check failed')
  if (!json.data) throw new Error('Allowlist response missing data')
  return json.data
}

export function useCreatorAllowlist(address?: string | null) {
  return useQuery({
    queryKey: ['creatorAllowlist', address ? address.toLowerCase() : ''],
    enabled: Boolean(address),
    queryFn: () => fetchCreatorAllowlistStatus(String(address)),
    staleTime: 60_000,
    retry: 1,
  })
}



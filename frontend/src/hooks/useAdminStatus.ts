import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useSiweAuth } from './useSiweAuth'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type AdminResponse = { address: string; isAdmin: boolean } | null

async function fetchAdminStatus(): Promise<AdminResponse> {
  const res = await apiFetch('/api/auth/admin', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminResponse> | null
  if (!res.ok || !json) throw new Error(`Admin check failed (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Admin check failed')
  return json.data ?? null
}

export function useAdminStatus() {
  const { isConnected } = useAccount()
  const { isSignedIn } = useSiweAuth()

  const query = useQuery({
    queryKey: ['auth', 'admin'],
    enabled: isConnected && isSignedIn,
    queryFn: fetchAdminStatus,
    staleTime: 30_000,
    retry: 0,
  })

  return {
    isAdmin: isSignedIn && query.data?.isAdmin === true,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

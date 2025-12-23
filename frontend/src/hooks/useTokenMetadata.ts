import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'

// ABI for tokenURI function (common to CreatorCoin contracts)
const tokenURIAbi = [
  {
    inputs: [],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface TokenMetadata {
  name?: string
  description?: string
  image?: string
  animation_url?: string
  external_url?: string
  attributes?: Array<{ trait_type: string; value: string | number }>
}

// Convert IPFS URI to HTTP gateway URL
function ipfsToHttp(uri: string): string {
  if (!uri) return ''
  
  // Handle ipfs:// protocol
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    return `https://ipfs.io/ipfs/${hash}`
  }
  
  // Handle direct CID
  if (uri.startsWith('Qm') || uri.startsWith('bafy')) {
    return `https://ipfs.io/ipfs/${uri}`
  }
  
  // Already an HTTP URL
  return uri
}

export function useTokenMetadata(tokenAddress: `0x${string}` | undefined) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch tokenURI from contract
  const { data: tokenURI } = useReadContract({
    address: tokenAddress,
    abi: tokenURIAbi,
    functionName: 'tokenURI',
    query: {
      enabled: !!tokenAddress,
    },
  })

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenURI) return

      setIsLoading(true)
      setError(null)

      try {
        const metadataUrl = ipfsToHttp(tokenURI)
        const response = await fetch(metadataUrl)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const data: TokenMetadata = await response.json()
        setMetadata(data)

        // Convert image URI to HTTP URL
        if (data.image) {
          setImageUrl(ipfsToHttp(data.image))
        }
      } catch (err) {
        console.error('Error fetching token metadata:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch metadata')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetadata()
  }, [tokenURI])

  return {
    metadata,
    imageUrl,
    tokenURI,
    isLoading,
    error,
  }
}

// Helper hook to just get the image URL
export function useTokenImage(tokenAddress: `0x${string}` | undefined) {
  const { imageUrl, isLoading, error } = useTokenMetadata(tokenAddress)
  return { imageUrl, isLoading, error }
}


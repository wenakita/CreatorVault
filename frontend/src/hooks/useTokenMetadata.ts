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
  const { data: tokenURI, refetch } = useReadContract({
    address: tokenAddress,
    abi: tokenURIAbi,
    functionName: 'tokenURI',
    query: {
      enabled: !!tokenAddress,
      staleTime: 1000 * 60 * 5, // Consider stale after 5 minutes
      gcTime: 1000 * 60 * 10, // Garbage collect after 10 minutes
    },
  })

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenURI) return

      setIsLoading(true)
      setError(null)

      try {
        const metadataUrl = ipfsToHttp(tokenURI)
        
        // First, check if the URI is a direct image link
        const isImageExtension = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(metadataUrl)
        const isDataUri = metadataUrl.startsWith('data:image/')
        
        if (isImageExtension || isDataUri) {
          // tokenURI points directly to an image
          setImageUrl(metadataUrl)
          setMetadata({ image: metadataUrl })
          return
        }

        // Try to fetch and check content type
        const response = await fetch(metadataUrl)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || ''
        
        // If it's an image, use the URL directly
        if (contentType.startsWith('image/')) {
          setImageUrl(metadataUrl)
          setMetadata({ image: metadataUrl })
          return
        }

        // Otherwise, parse as JSON metadata
        const data: TokenMetadata = await response.json()
        setMetadata(data)

        // Convert image URI to HTTP URL
        if (data.image) {
          setImageUrl(ipfsToHttp(data.image))
        }
      } catch (err) {
        // If JSON parse fails, the URI might be a direct image link
        // Try using the tokenURI directly as an image
        const directUrl = ipfsToHttp(tokenURI)
        setImageUrl(directUrl)
        setMetadata({ image: directUrl })
        console.log('Using tokenURI directly as image:', directUrl)
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
    refetch, // Allow manual refresh
  }
}

// Helper hook to just get the image URL
export function useTokenImage(tokenAddress: `0x${string}` | undefined) {
  const { imageUrl, isLoading, error } = useTokenMetadata(tokenAddress)
  return { imageUrl, isLoading, error }
}

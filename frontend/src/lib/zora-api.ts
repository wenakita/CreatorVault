// Zora API integration for creator profiles
// Docs: https://docs.zora.co/docs/zora-api/intro

import { logger } from './logger'

const ZORA_API_BASE = 'https://api.zora.co/graphql'

export interface ZoraCreator {
  address: string
  name?: string
  description?: string
  avatar?: string
  website?: string
  twitter?: string
  instagram?: string
  // Add other fields as needed
}

/**
 * Fetch creator profile from Zora
 * Note: This uses Zora's GraphQL API - you may need to adjust based on their current schema
 */
export async function getZoraCreatorProfile(address: string): Promise<ZoraCreator | null> {
  try {
    const query = `
      query GetCreator($address: String!) {
        creator(address: $address) {
          address
          name
          description
          avatar
          website
          socialMedia {
            twitter
            instagram
          }
        }
      }
    `

    const response = await fetch(ZORA_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address },
      }),
    })

    if (!response.ok) {
      logger.error('Zora API error', { status: response.status, statusText: response.statusText })
      return null
    }

    const data = await response.json()
    
    if (data.errors) {
      logger.error('Zora API GraphQL errors', data.errors)
      return null
    }

    return data.data?.creator || null
  } catch (error) {
    logger.error('Failed to fetch Zora creator profile', error)
    return null
  }
}

/**
 * Merge creator data from multiple sources (Zora, Talent, props)
 * Priority: Props > Talent > Zora
 */
export function mergeCreatorData(
  props: any,
  talent: any,
  zora: ZoraCreator | null
) {
  return {
    name: props.name || talent?.passport_profile?.name || zora?.name,
    bio: props.bio || talent?.passport_profile?.bio || zora?.description,
    image: props.image || talent?.passport_profile?.image_url || zora?.avatar,
    socials: {
      twitter: props.socials?.twitter || talent?.socials?.twitter || zora?.twitter,
      instagram: props.socials?.instagram || zora?.instagram,
      discord: props.socials?.discord || talent?.socials?.discord,
      telegram: props.socials?.telegram || talent?.socials?.telegram,
      website: props.socials?.website || zora?.website,
      // Add other platforms
    },
  }
}




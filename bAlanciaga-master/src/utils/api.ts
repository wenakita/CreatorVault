import axios from 'axios';
import FALLBACK_TOKEN from "/token-placeholder.svg";

// Simple in-memory cache
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// interface BaseTokenType {
//   name: string;
//   symbol: string;
//   logoURI: string;
//   address: string;
//   decimals: number;
// }

export const clearCache = () => {
  Object.keys(cache).forEach(key => {
    if (Date.now() - cache[key].timestamp > CACHE_DURATION) {
      delete cache[key];
    }
  });
};

export const fetchWithCache = async (url: string) => {
  const cacheKey = url;
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  try {
    const response = await axios.get(url);
    cache[cacheKey] = {
      data: response.data,
      timestamp: Date.now()
    };
    return response.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const getTokenPrice = async (tokenAddress: string): Promise<number> => {
  try {
    const data = await fetchWithCache(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    return data?.pairs?.[0]?.priceUsd ? parseFloat(data.pairs[0].priceUsd) : 0;
  } catch (error) {
    console.error('Failed to fetch token price:', error);
    return 0;
  }
};

export const getTokenInfo = async (tokenAddress: string) => {
  try {
    const data = await fetchWithCache(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    // console.log('Token Info:', data);
    return data?.pairs?.[0].baseToken.symbol || '';
  }
    catch{
      console.log('Failed to fetch token info:');
      return '';
    }
}
export const getTokenMoreInfo = async (tokenAddress: string) => {
  try {
    const data = await fetchWithCache(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    // console.log('Token Info:', data);
    return {
      baseToken: {
        name: data.pairs[0].baseToken.name,
        symbol: data.pairs[0].baseToken.symbol,
        logoURI: data.pairs[0].info?.imageUrl ?? FALLBACK_TOKEN,
        address: data.pairs[0].baseToken.address,
        decimals: 18,
      }
    };
  }
    catch{
      // console.log('Failed to fetch token info:');
      return '';
    }
}
 


export const searchTokens = async (query: string, chain?: number) => {
  try {
    if (query.startsWith('0x') && query.length === 42) {
      const data = await fetchWithCache(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
      if (data?.pairs?.[0]) {
        const token = data.pairs[0].baseToken;
        return [{
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          priceUsd: data.pairs[0].priceUsd,
          volume24h: data.pairs[0].volume.h24,
          chainId: chain
        }];
      }
    } else {
      const data = await fetchWithCache(`https://api.dexscreener.com/latest/dex/search/?q=${query}`);
      return (data?.pairs || [])
        .filter((pair: any) => !chain || pair.chainId === chain)
        .map((pair: any) => ({
          address: pair.baseToken.address,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          priceUsd: pair.priceUsd,
          volume24h: pair.volume.h24,
          chainId: chain
        }));
    }
    return [];
  } catch (error) {
    console.error('Failed to search tokens:', error);
    return [];
  }
};

export const fetchPoolData = async (poolAddress: string, chainId: string) => {
  const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${poolAddress}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data.pairs;
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
};

// Example usage



// Cleanup cache periodically
setInterval(clearCache, CACHE_DURATION); 
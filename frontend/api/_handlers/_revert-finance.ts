import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../server/_lib/logger.js';
import { handleOptions, setCors } from '../../server/auth/_shared.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { pool, days = '30', network = 'mainnet' } = req.query;

    if (!pool || typeof pool !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Pool address is required',
      });
    }

    // Proxy the request to Revert Finance API
    const apiUrl = `https://api.revert.finance/v1/discover-pools/daily?pool=${pool}&days=${days}&network=${network}`;
    
    logger.info('[Revert Finance Proxy] Fetching', { apiUrl });
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error('[Revert Finance Proxy] Error', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch data from Revert Finance',
    });
  }
}


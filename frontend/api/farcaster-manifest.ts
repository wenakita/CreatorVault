import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined> }

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // If configured, delegate to Farcaster Hosted Manifests.
  const hostedId = (process.env.FARCASTER_HOSTED_MANIFEST_ID || '').trim()
  if (hostedId) {
    res.statusCode = 307
    res.setHeader('Location', `https://api.farcaster.xyz/miniapps/hosted-manifest/${encodeURIComponent(hostedId)}`)
    res.end()
    return
  }

  // Fallback: serve the repo-managed manifest file (useful for local dev / early deployments).
  // This preserves existing behavior when FARCASTER_HOSTED_MANIFEST_ID is unset.
  try {
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'farcaster.json')
    const body = fs.readFileSync(filePath, 'utf8')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.statusCode = 200
    res.end(body)
  } catch {
    return res.status(404).json({
      success: false,
      error: 'Manifest not configured (set FARCASTER_HOSTED_MANIFEST_ID or add public/.well-known/farcaster.json)',
    })
  }
}


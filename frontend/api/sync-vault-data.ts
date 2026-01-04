import type { VercelRequest, VercelResponse } from '@vercel/node';

// Declare process for Node.js environment
declare const process: { env: Record<string, string | undefined> };

// Dynamic import for Prisma to avoid build errors when not configured
let prisma: any = null;

async function getPrisma(): Promise<any> {
  if (!prisma) {
    try {
      const modulePath = '@prisma/client';
      const prismaModule = await eval(`import('${modulePath}')`).catch(() => null);
      if (!prismaModule) {
        console.warn('[sync-vault-data] Could not load Prisma module');
        return null;
      }
      const PrismaClient = prismaModule.PrismaClient || prismaModule.default?.PrismaClient;
      if (!PrismaClient) {
        console.warn('[sync-vault-data] PrismaClient not found in module');
        return null;
      }
      prisma = new PrismaClient();
    } catch (e) {
      console.warn('[sync-vault-data] Prisma not available, skipping database operations');
      return null;
    }
  }
  return prisma;
}

// Get vault addresses from environment
function getConfiguredVaults(): Record<string, string> {
  const vaults: Record<string, string> = {};
  
  if (process.env.VITE_CHARM_VAULT_ADDRESS) {
    vaults['VAULT_1'] = process.env.VITE_CHARM_VAULT_ADDRESS.toLowerCase();
  }
  
  return vaults;
}

// GraphQL query for Charm Finance subgraph
const SNAPSHOT_QUERY = `
  query GetVaultSnapshots($address: ID!, $first: Int!, $skip: Int!) {
    vault(id: $address) {
      id
      baseLower
      baseUpper
      limitLower
      limitUpper
      fullRangeWeight
      total0
      total1
      totalSupply
      snapshot(orderBy: timestamp, orderDirection: desc, first: $first, skip: $skip) {
        timestamp
        feeApr
        annualVsHoldPerfSince
        totalAmount0
        totalAmount1
        totalSupply
      }
    }
  }
`;

type GraphQlError = { message?: string }
type GraphQlResponse<T> = { data?: T; errors?: GraphQlError[] }

type CharmVaultSnapshot = {
  timestamp: string
  feeApr?: string | null
  annualVsHoldPerfSince?: string | null
  totalAmount0?: string | null
  totalAmount1?: string | null
  totalSupply?: string | null
}

type CharmVault = {
  id?: string
  baseLower?: string | null
  baseUpper?: string | null
  limitLower?: string | null
  limitUpper?: string | null
  fullRangeWeight?: string | null
  total0?: string | null
  total1?: string | null
  totalSupply?: string | null
  snapshot?: CharmVaultSnapshot[] | null
}

async function fetchFromCharmGraphQL(vaultAddress: string, first: number = 100, skip: number = 0) {
  const response = await fetch('https://stitching-v2.herokuapp.com/1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: SNAPSHOT_QUERY,
      variables: { 
        address: vaultAddress.toLowerCase(),
        first,
        skip,
      }
    })
  });

  const result = (await response.json().catch(() => null)) as GraphQlResponse<{ vault?: CharmVault | null }> | null;
  
  if (!result) {
    throw new Error('Invalid response from Charm GraphQL');
  }

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    console.error('[sync-vault-data] GraphQL errors:', result.errors);
    throw new Error('GraphQL query failed');
  }
  
  return result.data?.vault ?? null;
}

async function syncVaultSnapshots(vaultAddress: string) {
  console.log(`[sync-vault-data] Syncing vault: ${vaultAddress}`);
  
  const db = await getPrisma();
  if (!db) {
    console.log('[sync-vault-data] Database not available, skipping sync');
    return { synced: 0, vault: vaultAddress, skipped: true };
  }
  
  // Get last sync status
  let syncStatus = await db.syncStatus.findUnique({
    where: { vaultAddress: vaultAddress.toLowerCase() }
  });
  
  const lastTimestamp = syncStatus?.lastTimestamp || new Date(0);
  
  try {
    // Fetch latest snapshots from Charm
    const vaultData = await fetchFromCharmGraphQL(vaultAddress, 500, 0);
    
    if (!vaultData || !vaultData.snapshot) {
      console.log(`[sync-vault-data] No data for vault ${vaultAddress}`);
      return { synced: 0, vault: vaultAddress };
    }
    
    const snapshots = vaultData.snapshot;
    let syncedCount = 0;
    
    // Process snapshots
    for (const snap of snapshots) {
      const timestamp = new Date(parseInt(snap.timestamp) * 1000);
      
      // Skip if already synced
      if (timestamp <= lastTimestamp) continue;
      
      // Upsert snapshot
      await db.vaultSnapshot.upsert({
        where: {
          vaultAddress_timestamp: {
            vaultAddress: vaultAddress.toLowerCase(),
            timestamp,
          }
        },
        create: {
          vaultAddress: vaultAddress.toLowerCase(),
          chainId: 1,
          timestamp,
          feeApr: snap.feeApr ? parseFloat(snap.feeApr) : null,
          annualVsHold: snap.annualVsHoldPerfSince ? parseFloat(snap.annualVsHoldPerfSince) : null,
          totalAmount0: snap.totalAmount0,
          totalAmount1: snap.totalAmount1,
          totalSupply: snap.totalSupply,
          baseLower: vaultData.baseLower ? parseInt(vaultData.baseLower) : null,
          baseUpper: vaultData.baseUpper ? parseInt(vaultData.baseUpper) : null,
          limitLower: vaultData.limitLower ? parseInt(vaultData.limitLower) : null,
          limitUpper: vaultData.limitUpper ? parseInt(vaultData.limitUpper) : null,
          fullRangeWeight: vaultData.fullRangeWeight ? parseFloat(vaultData.fullRangeWeight) / 10000 : null,
        },
        update: {
          feeApr: snap.feeApr ? parseFloat(snap.feeApr) : null,
          annualVsHold: snap.annualVsHoldPerfSince ? parseFloat(snap.annualVsHoldPerfSince) : null,
          totalAmount0: snap.totalAmount0,
          totalAmount1: snap.totalAmount1,
          totalSupply: snap.totalSupply,
        }
      });
      
      syncedCount++;
    }
    
    // Update sync status
    const latestSnapshot = snapshots[0];
    const latestTimestamp = latestSnapshot ? new Date(parseInt(latestSnapshot.timestamp) * 1000) : null;
    
    await db.syncStatus.upsert({
      where: { vaultAddress: vaultAddress.toLowerCase() },
      create: {
        vaultAddress: vaultAddress.toLowerCase(),
        chainId: 1,
        lastSyncAt: new Date(),
        lastTimestamp: latestTimestamp,
        syncErrors: 0,
      },
      update: {
        lastSyncAt: new Date(),
        lastTimestamp: latestTimestamp,
        syncErrors: 0,
        lastError: null,
      }
    });
    
    console.log(`[sync-vault-data] Synced ${syncedCount} snapshots for ${vaultAddress}`);
    return { synced: syncedCount, vault: vaultAddress };
    
  } catch (error: any) {
    console.error(`[sync-vault-data] Error syncing ${vaultAddress}:`, error);
    
    // Update sync status with error
    await db.syncStatus.upsert({
      where: { vaultAddress: vaultAddress.toLowerCase() },
      create: {
        vaultAddress: vaultAddress.toLowerCase(),
        chainId: 1,
        lastSyncAt: new Date(),
        syncErrors: 1,
        lastError: error.message,
      },
      update: {
        lastSyncAt: new Date(),
        syncErrors: { increment: 1 },
        lastError: error.message,
      }
    });
    
    throw error;
  }
}

// Update daily stats after sync
async function updateDailyStats(vaultAddress: string) {
  const db = await getPrisma();
  if (!db) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get today's snapshots
  const snapshots = await db.vaultSnapshot.findMany({
    where: {
      vaultAddress: vaultAddress.toLowerCase(),
      timestamp: { gte: today },
    },
    orderBy: { timestamp: 'desc' },
  });
  
  if (snapshots.length === 0) return;
  
  const feeAprs = snapshots.filter((s: any) => s.feeApr !== null).map((s: any) => s.feeApr as number);
  const latestSnapshot = snapshots[0];
  
  await db.dailyStats.upsert({
    where: {
      vaultAddress_date: {
        vaultAddress: vaultAddress.toLowerCase(),
        date: today,
      }
    },
    create: {
      vaultAddress: vaultAddress.toLowerCase(),
      chainId: 1,
      date: today,
      avgFeeApr: feeAprs.length > 0 ? feeAprs.reduce((a: number, b: number) => a + b, 0) / feeAprs.length : null,
      minFeeApr: feeAprs.length > 0 ? Math.min(...feeAprs) : null,
      maxFeeApr: feeAprs.length > 0 ? Math.max(...feeAprs) : null,
      totalAmount0: latestSnapshot.totalAmount0,
      totalAmount1: latestSnapshot.totalAmount1,
      snapshotCount: snapshots.length,
    },
    update: {
      avgFeeApr: feeAprs.length > 0 ? feeAprs.reduce((a: number, b: number) => a + b, 0) / feeAprs.length : null,
      minFeeApr: feeAprs.length > 0 ? Math.min(...feeAprs) : null,
      maxFeeApr: feeAprs.length > 0 ? Math.max(...feeAprs) : null,
      totalAmount0: latestSnapshot.totalAmount0,
      totalAmount1: latestSnapshot.totalAmount1,
      snapshotCount: snapshots.length,
    }
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret for security (optional but recommended)
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const VAULTS = getConfiguredVaults();
  
  // Check if any vaults are configured
  if (Object.keys(VAULTS).length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No vaults configured. Set VITE_CHARM_VAULT_ADDRESS environment variable.',
      syncedAt: new Date().toISOString(),
      results: [],
    });
  }

  try {
    const results = [];
    
    // Sync all vaults
    for (const [name, address] of Object.entries(VAULTS)) {
      try {
        const result = await syncVaultSnapshots(address);
        await updateDailyStats(address);
        results.push({ name, ...result, success: true });
      } catch (error: any) {
        results.push({ name, vault: address, success: false, error: error.message });
      }
    }
    
    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      results,
    });
    
  } catch (error: any) {
    console.error('[sync-vault-data] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    const db = await getPrisma();
    if (db) await db.$disconnect();
  }
}

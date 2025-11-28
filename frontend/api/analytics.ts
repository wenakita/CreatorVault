import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Charm Finance Vault addresses
const VAULTS = {
  USD1_WLFI: '0x22828dbf15f5fba2394ba7cf8fa9a96bdb444b71',
  WETH_WLFI: '0x3314e248f3f752cd16939773d83beb3a362f0aef',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { vault, days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysNum);

    // If specific vault requested
    const vaultAddress = vault 
      ? (vault as string).toLowerCase()
      : null;

    // Get snapshots
    const snapshots = await prisma.vaultSnapshot.findMany({
      where: {
        ...(vaultAddress && { vaultAddress }),
        timestamp: { gte: sinceDate },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        vaultAddress: true,
        timestamp: true,
        feeApr: true,
        annualVsHold: true,
        totalAmount0: true,
        totalAmount1: true,
        totalSupply: true,
        baseWeight: true,
        limitWeight: true,
        fullRangeWeight: true,
      }
    });

    // Get daily stats
    const dailyStats = await prisma.dailyStats.findMany({
      where: {
        ...(vaultAddress && { vaultAddress }),
        date: { gte: sinceDate },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate summary stats
    const latestSnapshots: Record<string, typeof snapshots[0]> = {};
    for (const snap of snapshots) {
      if (!latestSnapshots[snap.vaultAddress] || 
          snap.timestamp > latestSnapshots[snap.vaultAddress].timestamp) {
        latestSnapshots[snap.vaultAddress] = snap;
      }
    }

    // Calculate APY metrics
    const now = Date.now() / 1000;
    const oneWeekAgo = now - (7 * 24 * 60 * 60);
    const oneMonthAgo = now - (30 * 24 * 60 * 60);

    const calculateApyMetrics = (vaultSnapshots: typeof snapshots) => {
      if (vaultSnapshots.length === 0) return null;

      const weeklySnapshots = vaultSnapshots.filter(
        s => s.timestamp.getTime() / 1000 >= oneWeekAgo
      );
      const monthlySnapshots = vaultSnapshots.filter(
        s => s.timestamp.getTime() / 1000 >= oneMonthAgo
      );

      const avgApy = (snaps: typeof snapshots) => {
        const validSnaps = snaps.filter(s => s.annualVsHold !== null);
        if (validSnaps.length === 0) return null;
        return validSnaps.reduce((sum, s) => sum + (s.annualVsHold! * 100), 0) / validSnaps.length;
      };

      const avgApr = (snaps: typeof snapshots) => {
        const validSnaps = snaps.filter(s => s.feeApr !== null);
        if (validSnaps.length === 0) return null;
        return validSnaps.reduce((sum, s) => sum + (s.feeApr! * 100), 0) / validSnaps.length;
      };

      const latest = vaultSnapshots[vaultSnapshots.length - 1];

      return {
        currentFeeApr: latest.feeApr ? (latest.feeApr * 100).toFixed(2) : null,
        weeklyApy: avgApy(weeklySnapshots)?.toFixed(2) || null,
        monthlyApy: avgApy(monthlySnapshots)?.toFixed(2) || null,
        inceptionApy: avgApy(vaultSnapshots)?.toFixed(2) || null,
        weeklyFeeApr: avgApr(weeklySnapshots)?.toFixed(2) || null,
        snapshotCount: vaultSnapshots.length,
      };
    };

    // Group by vault
    const vaultData: Record<string, any> = {};
    
    for (const [name, address] of Object.entries(VAULTS)) {
      const vaultSnapshots = snapshots.filter(s => s.vaultAddress === address.toLowerCase());
      const vaultDailyStats = dailyStats.filter(s => s.vaultAddress === address.toLowerCase());
      
      vaultData[name] = {
        address,
        metrics: calculateApyMetrics(vaultSnapshots),
        latestSnapshot: latestSnapshots[address.toLowerCase()] || null,
        dailyStats: vaultDailyStats,
        historicalSnapshots: vaultSnapshots.map(s => ({
          timestamp: Math.floor(s.timestamp.getTime() / 1000),
          feeApr: s.feeApr ? (s.feeApr * 100).toFixed(2) : null,
          annualVsHold: s.annualVsHold ? (s.annualVsHold * 100).toFixed(2) : null,
        })),
      };
    }

    // Get sync status
    const syncStatus = await prisma.syncStatus.findMany();

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return res.status(200).json({
      success: true,
      data: {
        vaults: vaultData,
        syncStatus: syncStatus.reduce((acc, s) => {
          acc[s.vaultAddress] = {
            lastSyncAt: s.lastSyncAt,
            syncErrors: s.syncErrors,
            lastError: s.lastError,
          };
          return acc;
        }, {} as Record<string, any>),
        meta: {
          daysRequested: daysNum,
          totalSnapshots: snapshots.length,
          generatedAt: new Date().toISOString(),
        }
      }
    });

  } catch (error: any) {
    console.error('[analytics] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
}


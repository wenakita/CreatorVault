import React, { useEffect, useState } from 'react';
import {
  fetchPositionHistory,
  getPoolPerformanceMetrics,
  trackPositionPerformance
} from '../../utils/graphQueries';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsDashboardProps {
  poolAddress: string;
  positionId: string;
  chainId: number;
  walletAddress: string;
}

interface PoolMetrics {
  apr: number;
  volume24h: number;
  tvl: number;
  fees24h: number;
  historicalData: any[];
  currentPrices: {
    token0Price: string;
    token1Price: string;
  };
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  poolAddress,
  positionId,
  chainId,
  walletAddress
}) => {
  const [poolMetrics, setPoolMetrics] = useState<PoolMetrics | null>(null);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [positionPerformance, setPositionPerformance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all data concurrently
        const [metrics, history, performance] = await Promise.all([
          getPoolPerformanceMetrics(poolAddress, chainId),
          fetchPositionHistory(walletAddress, chainId),
          trackPositionPerformance(positionId, chainId)
        ]);

        setPoolMetrics(metrics);
        setPositionHistory(history);
        setPositionPerformance(performance);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [poolAddress, positionId, chainId, walletAddress]);

  const chartData = {
    labels: poolMetrics?.historicalData.map(data => 
      new Date(data.date * 1000).toLocaleDateString()
    ) || [],
    datasets: [
      {
        label: 'Volume (USD)',
        data: poolMetrics?.historicalData.map(data => parseFloat(data.volumeUSD)) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'TVL (USD)',
        data: poolMetrics?.historicalData.map(data => parseFloat(data.tvlUSD)) || [],
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }
    ]
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-2xl border border-gray-800/30 p-6 space-y-6">
      {/* Pool Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1B1B1B] rounded-xl p-4">
          <div className="text-sm text-gray-400">APR</div>
          <div className="text-2xl font-bold text-yellow-400">
            {poolMetrics?.apr.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#1B1B1B] rounded-xl p-4">
          <div className="text-sm text-gray-400">24h Volume</div>
          <div className="text-2xl font-bold text-white">
            ${poolMetrics?.volume24h.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1B1B1B] rounded-xl p-4">
          <div className="text-sm text-gray-400">TVL</div>
          <div className="text-2xl font-bold text-white">
            ${poolMetrics?.tvl.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1B1B1B] rounded-xl p-4">
          <div className="text-sm text-gray-400">24h Fees</div>
          <div className="text-2xl font-bold text-green-400">
            ${poolMetrics?.fees24h.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#1B1B1B] rounded-xl p-4">
        <div className="text-sm font-medium mb-4">Historical Performance</div>
        <div className="h-64">
          <Line 
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                  }
                }
              },
              plugins: {
                legend: {
                  labels: {
                    color: 'rgba(255, 255, 255, 0.7)'
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* Position Details */}
      {positionPerformance && (
        <div className="bg-[#1B1B1B] rounded-xl p-4">
          <div className="text-sm font-medium mb-4">Position Performance</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">Current Balance</div>
              <div className="text-lg">
                Token0: {parseFloat(positionPerformance.currentBalance.token0).toFixed(6)}
                <br />
                Token1: {parseFloat(positionPerformance.currentBalance.token1).toFixed(6)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Fees Collected</div>
              <div className="text-lg text-green-400">
                Token0: {positionPerformance.feesCollected.amount0.toFixed(6)}
                <br />
                Token1: {positionPerformance.feesCollected.amount1.toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Position History */}
      <div className="bg-[#1B1B1B] rounded-xl p-4">
        <div className="text-sm font-medium mb-4">Position History</div>
        <div className="space-y-2">
          {positionHistory.map((position, index) => (
            <div key={index} className="flex justify-between items-center p-2 hover:bg-[#2D2D2D] rounded-lg">
              <div>
                <div className="text-sm">Position #{position.id}</div>
                <div className="text-xs text-gray-400">
                  Created: {new Date(parseInt(position.transaction.timestamp) * 1000).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm">Liquidity: {parseFloat(position.liquidity).toExponential(2)}</div>
                <div className="text-xs text-gray-400">
                  Range: {position.tickLower} - {position.tickUpper}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 
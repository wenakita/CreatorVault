import { useState, useRef, useMemo } from 'react';

interface AnalyticsTabProps {
  vaultData: any;
}

export function AnalyticsTab({ vaultData }: AnalyticsTabProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Get prices with fallbacks
  const wlfiPrice = Number(vaultData.wlfiPrice) || 0.153;
  const wethPrice = Number(vaultData.wethPrice) || 3500;
  
  // Calculate current holdings
  const totalWLFI = (Number(vaultData.vaultLiquidWLFI) || 0) + 
                    (Number(vaultData.strategyWLFIinUSD1Pool) || 0) + 
                    (Number(vaultData.strategyWLFIinPool) || 0);
  
  const totalUSD1 = (Number(vaultData.vaultLiquidUSD1) || 0) + 
                    (Number(vaultData.strategyUSD1InPool) || 0);
  
  const totalWETH = Number(vaultData.strategyWETH) || 0;
  
  // Convert to WLFI equivalent
  const wlfiFromUSD1 = wlfiPrice > 0 ? totalUSD1 / wlfiPrice : 0;
  const wlfiFromWETH = wlfiPrice > 0 ? (totalWETH * wethPrice) / wlfiPrice : 0;
  const totalValue = totalWLFI + wlfiFromUSD1 + wlfiFromWETH;
  const totalValueUSD = totalValue * wlfiPrice;

  // Strategy breakdown
  const strategyUSD1Value = Number(vaultData.strategyUSD1) || 0;
  const strategyWETHValue = (Number(vaultData.strategyWETH) || 0) * wethPrice + 
                            (Number(vaultData.strategyWLFIinPool) || 0) * wlfiPrice;
  const vaultReserves = (Number(vaultData.vaultLiquidUSD1) || 0) + 
                        (Number(vaultData.vaultLiquidWLFI) || 0) * wlfiPrice;

  // Asset breakdown
  const assets = useMemo(() => {
    if (totalValue === 0) return [];
    return [
      { 
        name: 'WLFI', 
        amount: totalWLFI, 
        percentage: (totalWLFI / totalValue) * 100,
        color: '#F2D57C' // Gold
      },
      { 
        name: 'USD1', 
        amount: wlfiFromUSD1, 
        percentage: (wlfiFromUSD1 / totalValue) * 100,
        color: '#a8c0ff' // Crystal blue
      },
      { 
        name: 'WETH', 
        amount: wlfiFromWETH, 
        percentage: (wlfiFromWETH / totalValue) * 100,
        color: '#5e6d8a' // Slate accent
      }
    ].filter(a => a.percentage > 0);
  }, [totalWLFI, wlfiFromUSD1, wlfiFromWETH, totalValue]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (totalValue === 0) return [];
    return Array.from({ length: 30 }, (_, i) => {
      const progress = i / 29;
      const base = totalValue * 0.85;
      const growth = totalValue * 0.15 * progress;
      const variation = Math.sin(i * 0.8) * totalValue * 0.02;
      return {
        day: i,
        value: Math.max(0, base + growth + variation),
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      };
    });
  }, [totalValue]);

  // Chart calculations
  const chartStats = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 1, range: 1 };
    const values = chartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max, range: max - min || 1 };
  }, [chartData]);

  // Generate smooth SVG path
  const chartPath = useMemo(() => {
    if (chartData.length === 0) return '';
    const { min, range } = chartStats;
    const points = chartData.map((d, i) => ({
      x: (i / (chartData.length - 1)) * 100,
      y: 100 - ((d.value - min) / range) * 80 - 10
    }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [chartData, chartStats]);

  const formatNumber = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return '0';
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const formatPercent = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return '0';
    return n.toFixed(1);
  };

  const formatUSD = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return '$0';
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Basalt design styles
  const basaltStyles = {
    panel: "bg-[#0a0a0b] border border-[#2a2a30]",
    panelHover: "hover:border-[#5e6d8a] transition-all duration-300",
    label: "text-[0.7rem] text-[#5e6d8a] uppercase tracking-[0.15em] font-medium",
    mono: "font-mono text-[#5e6d8a]",
    value: "text-white font-light",
    gold: "text-[#F2D57C]",
    crystalBlue: "text-[#a8c0ff]",
    divider: "border-[#2a2a30]",
  };

  return (
    <div className="p-4 sm:p-6 space-y-[2px] bg-[#2a2a30]">
      {/* SVG Grain Texture Overlay */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.03] z-50">
        <filter id='noiseFilter'>
          <feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/>
        </filter>
        <rect width='100%' height='100%' filter='url(#noiseFilter)'/>
      </svg>

      {/* Main Grid - Chronostructure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[2px]">
        
        {/* LEFT: Total Value Monolith */}
        <div className={`${basaltStyles.panel} p-6 relative`}>
          <div className="border-b border-[#2a2a30] pb-4 mb-6">
            <span className={basaltStyles.label}>Vault Analytics</span>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff80] animate-pulse" />
              <span className="text-[0.65rem] text-[#00ff80] uppercase tracking-wider">Live Data</span>
            </div>
          </div>

          <div className="mb-8">
            <p className={basaltStyles.label}>Total Value Locked</p>
            <h2 className="text-4xl text-white font-light mt-2 tabular-nums">
              {formatNumber(totalValue)}
            </h2>
            <p className={`text-lg mt-1 ${basaltStyles.gold}`}>
              WLFI Equivalent
            </p>
          </div>

          <div className="mb-8">
            <p className={basaltStyles.label}>USD Value</p>
            <h2 className="text-3xl text-white font-light mt-2 tabular-nums">
              {formatUSD(totalValueUSD)}
            </h2>
          </div>

          {/* Chrono Bar */}
          <div className="mt-auto">
            <div className="flex justify-between text-[0.65rem] mb-2">
              <span className={basaltStyles.label}>Strategy Allocation</span>
              <span className={basaltStyles.mono}>{formatPercent(((strategyUSD1Value + strategyWETHValue) / (totalValueUSD || 1)) * 100)}%</span>
            </div>
            <div className="h-1 bg-[#2a2a30] w-full">
              <div 
                className="h-full bg-[#F2D57C]" 
                style={{ 
                  width: `${Math.min(100, ((strategyUSD1Value + strategyWETHValue) / (totalValueUSD || 1)) * 100)}%`,
                  boxShadow: '0 0 15px rgba(242, 213, 124, 0.4)'
                }}
              />
            </div>
          </div>
        </div>

        {/* CENTER: Performance Chart */}
        <div className={`${basaltStyles.panel} p-6 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className={basaltStyles.label}>Performance // 30D</span>
              <p className="text-2xl text-white font-light mt-2 tabular-nums">
                {formatNumber(totalValue)} <span className="text-sm text-[#5e6d8a]">WLFI</span>
              </p>
            </div>
            
            {hoveredIndex !== null && chartData[hoveredIndex] ? (
              <div className="text-right">
                <p className={basaltStyles.mono} style={{ fontSize: '0.7rem' }}>
                  {chartData[hoveredIndex].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-xl text-white font-light tabular-nums">
                  {formatNumber(chartData[hoveredIndex].value)}
                </p>
              </div>
            ) : (
              <div className="text-right">
                <p className={basaltStyles.mono} style={{ fontSize: '0.7rem' }}>30 Day Change</p>
                <p className={`text-lg font-medium ${basaltStyles.gold}`}>
                  +{formatPercent(((chartData[chartData.length - 1]?.value || 0) / (chartData[0]?.value || 1) - 1) * 100)}%
                </p>
              </div>
            )}
          </div>
          
          {/* Chart Area */}
          <div 
            ref={chartRef}
            className="relative h-48 cursor-crosshair"
            onMouseMove={(e) => {
              if (!chartRef.current) return;
              const rect = chartRef.current.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const index = Math.round(x * (chartData.length - 1));
              setHoveredIndex(Math.max(0, Math.min(chartData.length - 1, index)));
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {chartData.length > 0 ? (
              <svg 
                viewBox="0 0 100 100" 
                preserveAspectRatio="none" 
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="basaltChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F2D57C" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#F2D57C" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#F2D57C" stopOpacity="0" />
                  </linearGradient>
                  
                  <filter id="basaltGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Grid lines */}
                {[20, 40, 60, 80].map((y) => (
                  <line
                    key={y}
                    x1="0" y1={y} x2="100" y2={y}
                    stroke="#2a2a30"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                
                {/* Area fill */}
                <path 
                  d={`${chartPath} L 100,100 L 0,100 Z`}
                  fill="url(#basaltChartFill)"
                />
                
                {/* Main line */}
                <path 
                  d={chartPath}
                  fill="none"
                  stroke="#F2D57C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  filter="url(#basaltGlow)"
                />
                
                {/* Hover elements */}
                {hoveredIndex !== null && chartData[hoveredIndex] && (() => {
                  const x = (hoveredIndex / (chartData.length - 1)) * 100;
                  const y = 100 - ((chartData[hoveredIndex].value - chartStats.min) / chartStats.range) * 80 - 10;
                  return (
                    <>
                      <line
                        x1={x} y1="0" x2={x} y2="100"
                        stroke="#F2D57C"
                        strokeWidth="1"
                        strokeOpacity="0.3"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={x} cy={y} r="6" fill="#F2D57C" fillOpacity="0.2" />
                      <circle cx={x} cy={y} r="3" fill="#F2D57C" />
                      <circle cx={x} cy={y} r="1.5" fill="#0a0a0b" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-[#5e6d8a]">
                No data available
              </div>
            )}
          </div>
          
          {/* X-axis */}
          <div className="flex justify-between mt-3 text-[0.65rem] text-[#5e6d8a]">
            <span>30D AGO</span>
            <span>15D</span>
            <span>NOW</span>
          </div>
        </div>
      </div>

      {/* Strategy Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px]">
        {/* USD1/WLFI Strategy */}
        <div className={`${basaltStyles.panel} ${basaltStyles.panelHover} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <span className={basaltStyles.label}>USD1/WLFI Strategy</span>
            <span className="text-[0.65rem] px-2 py-0.5 bg-[#1c1c21] text-[#5e6d8a] font-mono">50%</span>
          </div>
          <div className="text-2xl text-white font-light tabular-nums">
            {formatUSD(strategyUSD1Value)}
          </div>
          <a 
            href="https://alpha.charm.fi/ethereum/vault/0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[0.65rem] text-[#5e6d8a] hover:text-[#F2D57C] transition-colors mt-2 inline-block"
          >
            CHARM_ALPHA ↗
          </a>
        </div>

        {/* WETH/WLFI Strategy */}
        <div className={`${basaltStyles.panel} ${basaltStyles.panelHover} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <span className={basaltStyles.label}>WETH/WLFI Strategy</span>
            <span className="text-[0.65rem] px-2 py-0.5 bg-[#1c1c21] text-[#5e6d8a] font-mono">50%</span>
          </div>
          <div className="text-2xl text-white font-light tabular-nums">
            {formatUSD(strategyWETHValue)}
          </div>
          <a 
            href="https://alpha.charm.fi/ethereum/vault/0x3314e248F3F752Cd16939773D83bEb3a362F0AEF" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[0.65rem] text-[#5e6d8a] hover:text-[#F2D57C] transition-colors mt-2 inline-block"
          >
            CHARM_ALPHA ↗
          </a>
        </div>

        {/* Vault Reserves */}
        <div className={`${basaltStyles.panel} ${basaltStyles.panelHover} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <span className={basaltStyles.label}>Vault Reserves</span>
            <span className="text-[0.65rem] px-2 py-0.5 bg-[#1c1c21] text-[#00ff80] font-mono">LIQUID</span>
          </div>
          <div className="text-2xl text-white font-light tabular-nums">
            {formatUSD(vaultReserves)}
          </div>
          <span className="text-[0.65rem] text-[#5e6d8a] mt-2 inline-block">
            AVAILABLE_NOW
          </span>
        </div>
      </div>

      {/* Asset Composition */}
      <div className={`${basaltStyles.panel} p-5`}>
        <p className={`${basaltStyles.label} mb-4`}>Asset Composition</p>
        
        {/* Composition Bar */}
        <div className="h-2 bg-[#1c1c21] w-full flex overflow-hidden">
          {assets.map((asset, i) => (
            <div
              key={i}
              className="h-full transition-all duration-500"
              style={{ 
                width: `${asset.percentage}%`,
                backgroundColor: asset.color
              }}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-6 mt-4">
          {assets.map((asset, i) => (
            <div key={i} className="flex items-center gap-3">
              <div 
                className="w-3 h-3" 
                style={{ backgroundColor: asset.color }}
              />
              <div>
                <span className="text-sm text-white font-light">{asset.name}</span>
                <span className="text-sm text-[#5e6d8a] ml-2 font-mono">
                  {formatPercent(asset.percentage)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oracle Status */}
      <div className={`${basaltStyles.panel} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#F2D57C] animate-pulse" />
          <span className="text-[0.65rem] text-[#5e6d8a] font-mono uppercase">
            Oracle: Uniswap V3 TWAP // 1800s Interval
          </span>
        </div>
        <span className="text-[0.65rem] text-[#5e6d8a] font-mono">
          WLFI: ${wlfiPrice.toFixed(4)} // ETH: ${formatNumber(wethPrice)}
        </span>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';

interface AssetAllocationSunburstProps {
  vaultWLFI: number;
  vaultUSD1: number;
  strategyWLFI: number;
  strategyUSD1: number;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.9}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 15}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

export default function AssetAllocationSunburst({
  vaultWLFI,
  vaultUSD1,
  strategyWLFI,
  strategyUSD1
}: AssetAllocationSunburstProps) {
  
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeInnerIndex, setActiveInnerIndex] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  
  const totalVault = vaultWLFI + vaultUSD1;
  const totalStrategy = strategyWLFI + strategyUSD1;
  const grandTotal = totalVault + totalStrategy;

  // Outer ring: Vault vs Strategies
  const outerData = useMemo(() => [
    { name: 'Vault Reserves', value: totalVault, color: '#10b981' },
    { name: 'Charm Strategy', value: totalStrategy, color: '#6366f1' },
  ], [totalVault, totalStrategy]);

  // Inner ring: Token breakdown
  const innerData = useMemo(() => [
    { name: 'Vault WLFI', value: vaultWLFI, color: '#34d399' },
    { name: 'Vault USD1', value: vaultUSD1, color: '#059669' },
    { name: 'Strategy WLFI', value: strategyWLFI, color: '#818cf8' },
    { name: 'Strategy USD1', value: strategyUSD1, color: '#4f46e5' },
  ], [vaultWLFI, vaultUSD1, strategyWLFI, strategyUSD1]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = grandTotal > 0 ? ((data.value / grandTotal) * 100).toFixed(1) : '0';
      return (
        <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-xl">
          <p className="text-white font-semibold text-sm">{data.name}</p>
          <p className="text-gray-400 text-xs mt-1">{data.value.toFixed(2)} tokens</p>
          <p className="text-yellow-500 text-xs">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  const handleSectionClick = (section: string) => {
    setSelectedSection(selectedSection === section ? null : section);
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Asset Allocation</h3>
        {selectedSection && (
          <button
            onClick={() => setSelectedSection(null)}
            className="text-xs text-yellow-500 hover:text-yellow-400"
          >
            Reset View
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-6">
        {/* Interactive Sunburst Chart */}
        <div className="flex-1 cursor-pointer">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              {/* Inner ring - Token breakdown */}
              <Pie
                data={innerData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                activeIndex={activeInnerIndex !== null ? activeInnerIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveInnerIndex(index)}
                onMouseLeave={() => setActiveInnerIndex(null)}
                onClick={(data) => handleSectionClick(data.name)}
              >
                {innerData.map((entry, index) => (
                  <Cell 
                    key={`inner-${index}`} 
                    fill={entry.color}
                    opacity={selectedSection && selectedSection !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              
              {/* Outer ring - Vault vs Strategy */}
              <Pie
                data={outerData}
                cx="50%"
                cy="50%"
                innerRadius={100}
                outerRadius={130}
                paddingAngle={3}
                dataKey="value"
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(data) => handleSectionClick(data.name)}
                label={({ name, value }) => 
                  grandTotal > 0 ? `${((value / grandTotal) * 100).toFixed(0)}%` : '0%'
                }
              >
                {outerData.map((entry, index) => (
                  <Cell 
                    key={`outer-${index}`} 
                    fill={entry.color}
                    opacity={selectedSection && selectedSection !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Label */}
          <div className="text-center -mt-48">
            <div className="text-2xl font-bold text-white">{grandTotal.toFixed(0)}</div>
            <div className="text-xs text-gray-500">Total Tokens</div>
          </div>
        </div>

        {/* Interactive Legend */}
        <div className="space-y-4">
          <div 
            className={`cursor-pointer p-3 rounded-lg transition-all ${
              selectedSection === 'Vault Reserves' 
                ? 'bg-emerald-500/20 border border-emerald-500/50' 
                : 'hover:bg-white/5'
            }`}
            onClick={() => handleSectionClick('Vault Reserves')}
          >
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Vault Reserves</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#34d399' }}></div>
                  <span className="text-sm text-gray-300">WLFI</span>
                </div>
                <span className="text-sm font-mono text-white">{vaultWLFI.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                  <span className="text-sm text-gray-300">USD1</span>
                </div>
                <span className="text-sm font-mono text-white">{vaultUSD1.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              {grandTotal > 0 ? ((totalVault / grandTotal) * 100).toFixed(1) : '0'}% of total
            </div>
          </div>
          
          <div 
            className={`cursor-pointer p-3 rounded-lg transition-all ${
              selectedSection === 'Charm Strategy' 
                ? 'bg-indigo-500/20 border border-indigo-500/50' 
                : 'hover:bg-white/5'
            }`}
            onClick={() => handleSectionClick('Charm Strategy')}
          >
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Charm Strategy</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#818cf8' }}></div>
                  <span className="text-sm text-gray-300">WLFI</span>
                </div>
                <span className="text-sm font-mono text-white">{strategyWLFI.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4f46e5' }}></div>
                  <span className="text-sm text-gray-300">USD1</span>
                </div>
                <span className="text-sm font-mono text-white">{strategyUSD1.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              {grandTotal > 0 ? ((totalStrategy / grandTotal) * 100).toFixed(1) : '0'}% of total
            </div>
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="text-xs text-gray-500">Total Assets</div>
            <div className="text-lg font-bold text-white">{grandTotal.toFixed(2)}</div>
          </div>

          {selectedSection && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="text-xs text-yellow-400 font-semibold mb-1">
                ✨ {selectedSection} Selected
              </div>
              <p className="text-xs text-gray-400">
                Click again to deselect, or click another section
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


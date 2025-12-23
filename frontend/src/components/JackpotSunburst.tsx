/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as d3 from 'd3'
import { Trophy, Flame, Building2 } from 'lucide-react'

interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
  color?: string
  description?: string
  symbol?: string
}

interface JackpotToken {
  symbol: string
  name: string
  value: number // in USD
  color: string
}

interface JackpotSunburstProps {
  /** wsTokens in the jackpot pool */
  tokens?: JackpotToken[]
  /** Total jackpot in ETH */
  totalEth?: string
  /** Total jackpot in USD */
  totalUsd?: number
}

// Example tokens in the jackpot pool
const DEFAULT_TOKENS: JackpotToken[] = [
  { symbol: 'wsAKITA', name: 'Wrapped Staked AKITA', value: 280, color: '#f97316' },
  { symbol: 'wsCREATOR', name: 'Wrapped Staked CREATOR', value: 50, color: '#8b5cf6' },
  { symbol: 'wsDAWG', name: 'Wrapped Staked DAWG', value: 20, color: '#06b6d4' },
]

/**
 * D3-based Sunburst showing jackpot composition
 * Outer ring: wsTokens composition
 * Inner breakdown: Distribution (90% winner, 5% burn, 5% protocol)
 */
export function JackpotSunburst({
  tokens = DEFAULT_TOKENS,
  totalEth = '0.1 ETH',
  totalUsd = 350,
}: JackpotSunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [hoveredToken, setHoveredToken] = useState<string | null>(null)

  // Build hierarchical data: Jackpot → Tokens → Distribution
  const data: HierarchyNode = useMemo(() => {
    const tokenChildren = tokens.map((token) => ({
      name: token.symbol,
      color: token.color,
      description: token.name,
      symbol: token.symbol,
      children: [
        {
          name: 'Winner Pool',
          value: token.value * 0.9,
          color: '#eab308',
          description: '90% to random winner',
        },
        {
          name: 'Burn',
          value: token.value * 0.05,
          color: '#ef4444',
          description: '5% permanently burned',
        },
        {
          name: 'Protocol',
          value: token.value * 0.05,
          color: '#0052FF',
          description: '5% development fund',
        },
      ],
    }))

    return {
      name: 'Jackpot Pool',
      children: tokenChildren,
    }
  }, [tokens])

  useEffect(() => {
    if (!svgRef.current) return

    // Initialize tooltip
    const tooltip = d3.select('#jackpot-tooltip')
    tooltip
      .style('position', 'fixed')
      .style('opacity', '0')
      .style('left', '-9999px')
      .style('top', '-9999px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    // Sizing
    const isMobile = window.innerWidth < 640
    const width = isMobile ? 300 : 380
    const height = isMobile ? 300 : 380
    const radius = Math.min(width, height) / 2 - 20

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    // Hierarchy
    const root = d3
      .hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Partition
    const partition = d3.partition<HierarchyNode>().size([2 * Math.PI, radius])
    partition(root)

    // Arc generators
    const arc = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.008))
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1)

    const arcHover = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 + 6)

    // Glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow-jackpot')
    filter.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Create arcs
    svg
      .selectAll('path')
      .data(root.descendants().filter((d) => d.depth > 0))
      .join('path')
      .attr('d', arc as any)
      .attr('fill', (d: any) => d.data.color || '#666')
      .attr('opacity', (d: any) => {
        if (hoveredToken && d.depth === 1 && d.data.name !== hoveredToken) return 0.3
        return 0.85
      })
      .attr('stroke', 'rgba(255, 255, 255, 0.08)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))')
      .on('mouseenter', function (this: any, event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arcHover as any)
          .attr('opacity', 1)
          .style('filter', `drop-shadow(0 4px 12px ${d.data.color}60)`)

        const usdValue = d.value || 0
        const percentage = totalUsd > 0 ? ((usdValue / totalUsd) * 100).toFixed(1) : '0'
        const isToken = d.depth === 1

        d3.select('#jackpot-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .style('opacity', '1')
          .html(`
            <div style="
              background: rgba(15,23,42,0.98);
              padding: 14px;
              border-radius: 10px;
              border: 1px solid rgba(255,255,255,0.1);
              box-shadow: 0 16px 32px rgba(0,0,0,0.4);
              backdrop-filter: blur(8px);
              min-width: 160px;
            ">
              <div style="color: ${d.data.color}; font-weight: 700; margin-bottom: 8px; font-size: 13px;">
                ${d.data.name}
              </div>
              ${d.data.description ? `<div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">${d.data.description}</div>` : ''}
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="color: #94a3b8; font-size: 11px;">Value:</span>
                <span style="color: white; font-weight: 600; font-family: monospace; font-size: 12px;">$${usdValue.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
                <span style="color: #94a3b8; font-size: 11px;">${isToken ? 'Pool Share' : 'Distribution'}:</span>
                <span style="color: ${d.data.color}; font-weight: 700; font-size: 14px;">${percentage}%</span>
              </div>
            </div>
          `)
      })
      .on('mousemove', function (event: any) {
        d3.select('#jackpot-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
      })
      .on('mouseleave', function (this: any, _event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc as any)
          .attr('opacity', hoveredToken && d.depth === 1 && d.data.name !== hoveredToken ? 0.3 : 0.85)
          .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))')

        d3.select('#jackpot-tooltip').style('opacity', '0')
      })

    // Center content
    const centerGroup = svg.append('g')

    centerGroup
      .append('circle')
      .attr('r', isMobile ? 45 : 55)
      .attr('fill', 'rgba(15, 23, 42, 0.7)')
      .attr('stroke', 'rgba(234, 179, 8, 0.2)')
      .attr('stroke-width', 1)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -10)
      .style('font-size', isMobile ? '9px' : '10px')
      .style('fill', '#64748b')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '1px')
      .text('Jackpot')

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 12)
      .style('font-size', isMobile ? '16px' : '20px')
      .style('font-weight', '700')
      .style('fill', '#eab308')
      .text(totalEth)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 28)
      .style('font-size', isMobile ? '8px' : '9px')
      .style('fill', '#94a3b8')
      .text(`≈ $${totalUsd.toFixed(0)}`)
  }, [data, totalEth, totalUsd, hoveredToken])

  return (
    <>
      {createPortal(<div id="jackpot-tooltip" />, document.body)}

      <div className="relative bg-gradient-to-br from-surface-900 to-surface-950 rounded-2xl p-4 sm:p-5 overflow-hidden border border-surface-800/50">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full blur-3xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base">Jackpot Pool</h3>
              <p className="text-[10px] text-surface-500">wsToken composition • Hover for details</p>
            </div>
            <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 text-[10px] font-medium">
              Live
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-5">
            {/* Sunburst */}
            <div className="flex-shrink-0 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-blue-500/5 rounded-full blur-xl" />
              <svg ref={svgRef} className="relative" />
            </div>

            {/* Legend */}
            <div className="flex-1 w-full space-y-3">
              {/* Token Composition */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">Pool Composition</p>
                {tokens.map((token) => (
                  <div
                    key={token.symbol}
                    className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer ${
                      hoveredToken === token.symbol
                        ? 'bg-surface-800/80 border border-surface-700'
                        : 'bg-surface-900/50 border border-transparent hover:bg-surface-800/50'
                    }`}
                    onMouseEnter={() => setHoveredToken(token.symbol)}
                    onMouseLeave={() => setHoveredToken(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: token.color }}
                      />
                      <span className="text-xs font-medium text-white">{token.symbol}</span>
                    </div>
                    <span className="text-xs font-mono text-surface-400">
                      ${token.value.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Distribution */}
              <div className="pt-2 border-t border-surface-800/50 space-y-1.5">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">Distribution</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    <span className="text-surface-300">Winner</span>
                  </div>
                  <span className="font-bold text-yellow-500">90%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-red-500" />
                    <span className="text-surface-300">Burn</span>
                  </div>
                  <span className="font-bold text-red-500">5%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-brand-500" />
                    <span className="text-surface-300">Protocol</span>
                  </div>
                  <span className="font-bold text-brand-500">5%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


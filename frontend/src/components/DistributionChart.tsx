/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as d3 from 'd3'

interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
  color?: string
  description?: string
}

interface LotteryDistributionChartProps {
  jackpotAmount?: string
  jackpotUsd?: number
}

/**
 * D3-based Sunburst Chart for Lottery Distribution
 * Inspired by AssetAllocationSunburst.tsx - Looker Studio style
 */
export function LotteryDistributionChart({
  jackpotAmount = '0.1 ETH',
  jackpotUsd = 350,
}: LotteryDistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Hierarchical data for lottery distribution
  // 69% jackpot, 21.4% burn (31% * 0.69), 9.6% treasury (31% * 0.31)
  const data: HierarchyNode = useMemo(
    () => ({
      name: 'Jackpot Pool',
      children: [
        {
          name: 'Winner',
          color: '#eab308', // yellow-500
          children: [
            {
              name: 'Random VRF Draw',
              value: jackpotUsd * 0.69,
              color: '#fbbf24',
              description: 'Chainlink VRF v2.5',
            },
          ],
        },
        {
          name: 'Burns',
          color: '#ef4444', // red-500
          children: [
            {
              name: 'Token Burn',
              value: jackpotUsd * 0.214,
              color: '#f87171',
              description: 'Permanently removed',
            },
          ],
        },
        {
          name: 'Treasury',
          color: '#0052FF', // Base blue
          children: [
            {
              name: 'Development',
              value: jackpotUsd * 0.096,
              color: '#3b82f6',
              description: 'Platform sustainability',
            },
          ],
        },
      ],
    }),
    [jackpotUsd]
  )

  useEffect(() => {
    if (!svgRef.current) return

    // Initialize tooltip
    const tooltip = d3.select('#lottery-tooltip')
    tooltip
      .style('position', 'fixed')
      .style('opacity', '0')
      .style('left', '-9999px')
      .style('top', '-9999px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('transition', 'opacity 0.2s ease')

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    // Responsive sizing
    const isMobile = window.innerWidth < 640
    const width = isMobile ? 280 : 340
    const height = isMobile ? 280 : 340
    const radius = Math.min(width, height) / 2 - 20

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    // Create hierarchy
    const root = d3
      .hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Partition layout
    const partition = d3.partition<HierarchyNode>().size([2 * Math.PI, radius])
    partition(root)

    // Arc generators
    const arc = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1)

    const arcCollapsed = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius(0)
      .outerRadius(0)

    const arcHover = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 + 8)

    // Add glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow-lottery')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const grandTotal = jackpotUsd

    // Create arcs
    svg
      .selectAll('path')
      .data(root.descendants().filter((d) => d.depth > 0))
      .join('path')
      .attr('d', arc as any)
      .attr('fill', (d) => d.data.color || '#666')
      .attr('opacity', (d) =>
        selectedPath && d.data.name !== selectedPath ? 0.3 : 0.85
      )
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)')
      .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))')
      .on('mouseenter', function (this: any, event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(300)
          .ease(d3.easeCubicOut)
          .attr('d', arcHover as any)
          .attr('opacity', 1)
          .style(
            'filter',
            `drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 20px ${d.data.color || '#666'}80)`
          )

        const usdValue = d.value || 0
        const percentage =
          grandTotal > 0 ? ((usdValue / grandTotal) * 100).toFixed(1) : '0'

        d3.select('#lottery-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .style('opacity', '1')
          .html(`
            <div style="
              background: linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%);
              padding: 16px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.15);
              box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 20px ${d.data.color}40;
              backdrop-filter: blur(10px);
              min-width: 180px;
            ">
              <div style="color: ${d.data.color}; font-weight: 700; margin-bottom: 10px; font-size: 14px; letter-spacing: 0.5px;">${d.data.name.toUpperCase()}</div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <span style="color: #94a3b8; font-size: 12px;">Value:</span>
                <span style="color: white; font-weight: 600; font-family: monospace; font-size: 13px;">$${usdValue.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #94a3b8; font-size: 12px;">Share:</span>
                <span style="color: ${d.data.color}; font-weight: 700; font-size: 16px;">${percentage}%</span>
              </div>
              ${d.data.description ? `<div style="color: #64748b; font-size: 11px; margin-top: 8px;">${d.data.description}</div>` : ''}
            </div>
          `)
      })
      .on('mousemove', function (event: any) {
        d3.select('#lottery-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
      })
      .on('mouseleave', function (this: any, _event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(250)
          .ease(d3.easeCubicIn)
          .attr('d', arc as any)
          .attr('opacity', selectedPath && d.data.name !== selectedPath ? 0.3 : 0.85)
          .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))')

        d3.select('#lottery-tooltip')
          .transition()
          .duration(200)
          .style('opacity', '0')
          .on('end', function (this: any) {
            d3.select(this).style('left', '-9999px').style('top', '-9999px')
          })
      })
      .on('click', function (event: any, d: any) {
        event.stopPropagation()
        setSelectedPath(d.data.name)

        d3.select('#lottery-tooltip')
          .style('opacity', '0')
          .style('left', '-9999px')
          .style('top', '-9999px')

        // Close-then-open animation
        svg
          .selectAll('path')
          .transition()
          .duration(400)
          .ease(d3.easeCubicIn)
          .attr('d', arcCollapsed as any)
          .attr('opacity', 0)
          .on('end', function () {
            svg
              .selectAll('path')
              .transition()
              .duration(600)
              .ease(d3.easeCubicOut)
              .attr('d', arc as any)
              .attr('opacity', 0.85)
          })
      })

    // Center content
    const centerGroup = svg.append('g')

    centerGroup
      .append('circle')
      .attr('r', isMobile ? 50 : 60)
      .attr('fill', 'rgba(15, 23, 42, 0.6)')
      .attr('stroke', 'rgba(234, 179, 8, 0.3)')
      .attr('stroke-width', 1.5)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -12)
      .style('font-size', isMobile ? '10px' : '11px')
      .style('fill', '#64748b')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '1.5px')
      .text('Jackpot')

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 12)
      .style('font-size', isMobile ? '18px' : '22px')
      .style('font-weight', '700')
      .style('fill', '#eab308')
      .style('letter-spacing', '0.5px')
      .text(jackpotAmount)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 30)
      .style('font-size', isMobile ? '9px' : '10px')
      .style('fill', '#94a3b8')
      .text(`≈ $${jackpotUsd.toFixed(0)}`)
  }, [data, jackpotAmount, jackpotUsd, selectedPath])

  return (
    <>
      {createPortal(<div id="lottery-tooltip" />, document.body)}

      <div className="relative bg-gradient-to-br from-surface-900 to-surface-950 rounded-2xl p-4 sm:p-6 overflow-hidden border border-surface-800/50">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full blur-2xl" />

        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg mb-1">
                Jackpot Distribution
              </h3>
              <p className="text-xs text-surface-500">
                Click segments to animate • Hover for details
              </p>
            </div>
            {selectedPath && (
              <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{selectedPath}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10">
            {/* D3 Sunburst Chart */}
            <div className="flex-shrink-0 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-blue-500/10 rounded-full blur-2xl" />
              <svg ref={svgRef} className="relative drop-shadow-2xl" />
            </div>

            {/* Legend */}
            <div className="space-y-2.5 w-full lg:w-auto lg:min-w-[200px]">
              <LegendItem
                color="#eab308"
                name="Winner"
                value="90%"
                description="Random VRF draw"
                isSelected={selectedPath === 'Winner'}
                onClick={() => setSelectedPath(selectedPath === 'Winner' ? null : 'Winner')}
              />
              <LegendItem
                color="#ef4444"
                name="Burn"
                value="5%"
                description="Permanently removed"
                isSelected={selectedPath === 'Burns'}
                onClick={() => setSelectedPath(selectedPath === 'Burns' ? null : 'Burns')}
              />
              <LegendItem
                color="#0052FF"
                name="Protocol"
                value="5%"
                description="Development fund"
                isSelected={selectedPath === 'Protocol'}
                onClick={() => setSelectedPath(selectedPath === 'Protocol' ? null : 'Protocol')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface LegendItemProps {
  color: string
  name: string
  value: string
  description: string
  isSelected?: boolean
  onClick?: () => void
}

function LegendItem({
  color,
  name,
  value,
  description,
  isSelected,
  onClick,
}: LegendItemProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-3 rounded-xl transition-all duration-300 border ${
        isSelected
          ? 'bg-surface-800/80 border-surface-600'
          : 'bg-surface-900/50 border-surface-800/50 hover:bg-surface-800/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div>
            <span className="text-sm font-medium text-white">{name}</span>
            <p className="text-xs text-surface-500">{description}</p>
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  )
}

// Compact version for dashboard
export function LotteryDistributionCompact({
  jackpotAmount = '0.1 ETH',
}: {
  jackpotAmount?: string
}) {
  const data = [
    { name: 'Winner', value: 69, color: '#eab308' },
    { name: 'Burn', value: 21.4, color: '#ef4444' },
    { name: 'Treasury', value: 9.6, color: '#0052FF' },
  ]

  return (
    <div className="flex items-center gap-4">
      {/* Simple donut using CSS - 69% winner, 21.4% burn, 9.6% treasury */}
      <div
        className="w-[80px] h-[80px] rounded-full flex-shrink-0 relative"
        style={{
          background: `conic-gradient(
            #eab308 0deg 248.4deg,
            #ef4444 248.4deg 325.44deg,
            #0052FF 325.44deg 360deg
          )`,
        }}
      >
        <div className="absolute inset-2 bg-surface-900 rounded-full flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-yellow-500">{jackpotAmount}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-surface-400">{item.name}</span>
            <span className="font-medium text-white">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Re-export for backwards compatibility
export { LotteryDistributionChart as DistributionChart }

import { createPortal } from 'react-dom'
import * as d3 from 'd3'

interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
  color?: string
  description?: string
}

interface LotteryDistributionChartProps {
  jackpotAmount?: string
  jackpotUsd?: number
}

/**
 * D3-based Sunburst Chart for Lottery Distribution
 * Inspired by AssetAllocationSunburst.tsx - Looker Studio style
 */
export function LotteryDistributionChart({
  jackpotAmount = '0.1 ETH',
  jackpotUsd = 350,
}: LotteryDistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Hierarchical data for lottery distribution
  // 69% jackpot, 21.4% burn (31% * 0.69), 9.6% treasury (31% * 0.31)
  const data: HierarchyNode = useMemo(
    () => ({
      name: 'Jackpot Pool',
      children: [
        {
          name: 'Winner',
          color: '#eab308', // yellow-500
          children: [
            {
              name: 'Random VRF Draw',
              value: jackpotUsd * 0.69,
              color: '#fbbf24',
              description: 'Chainlink VRF v2.5',
            },
          ],
        },
        {
          name: 'Burns',
          color: '#ef4444', // red-500
          children: [
            {
              name: 'Token Burn',
              value: jackpotUsd * 0.214,
              color: '#f87171',
              description: 'Permanently removed',
            },
          ],
        },
        {
          name: 'Treasury',
          color: '#0052FF', // Base blue
          children: [
            {
              name: 'Development',
              value: jackpotUsd * 0.096,
              color: '#3b82f6',
              description: 'Platform sustainability',
            },
          ],
        },
      ],
    }),
    [jackpotUsd]
  )

  useEffect(() => {
    if (!svgRef.current) return

    // Initialize tooltip
    const tooltip = d3.select('#lottery-tooltip')
    tooltip
      .style('position', 'fixed')
      .style('opacity', '0')
      .style('left', '-9999px')
      .style('top', '-9999px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('transition', 'opacity 0.2s ease')

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    // Responsive sizing
    const isMobile = window.innerWidth < 640
    const width = isMobile ? 280 : 340
    const height = isMobile ? 280 : 340
    const radius = Math.min(width, height) / 2 - 20

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    // Create hierarchy
    const root = d3
      .hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Partition layout
    const partition = d3.partition<HierarchyNode>().size([2 * Math.PI, radius])
    partition(root)

    // Arc generators
    const arc = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1)

    const arcCollapsed = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius(0)
      .outerRadius(0)

    const arcHover = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 + 8)

    // Add glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow-lottery')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const grandTotal = jackpotUsd

    // Create arcs
    svg
      .selectAll('path')
      .data(root.descendants().filter((d) => d.depth > 0))
      .join('path')
      .attr('d', arc as any)
      .attr('fill', (d) => d.data.color || '#666')
      .attr('opacity', (d) =>
        selectedPath && d.data.name !== selectedPath ? 0.3 : 0.85
      )
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)')
      .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))')
      .on('mouseenter', function (this: any, event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(300)
          .ease(d3.easeCubicOut)
          .attr('d', arcHover as any)
          .attr('opacity', 1)
          .style(
            'filter',
            `drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 20px ${d.data.color || '#666'}80)`
          )

        const usdValue = d.value || 0
        const percentage =
          grandTotal > 0 ? ((usdValue / grandTotal) * 100).toFixed(1) : '0'

        d3.select('#lottery-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .style('opacity', '1')
          .html(`
            <div style="
              background: linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%);
              padding: 16px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.15);
              box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 20px ${d.data.color}40;
              backdrop-filter: blur(10px);
              min-width: 180px;
            ">
              <div style="color: ${d.data.color}; font-weight: 700; margin-bottom: 10px; font-size: 14px; letter-spacing: 0.5px;">${d.data.name.toUpperCase()}</div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <span style="color: #94a3b8; font-size: 12px;">Value:</span>
                <span style="color: white; font-weight: 600; font-family: monospace; font-size: 13px;">$${usdValue.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #94a3b8; font-size: 12px;">Share:</span>
                <span style="color: ${d.data.color}; font-weight: 700; font-size: 16px;">${percentage}%</span>
              </div>
              ${d.data.description ? `<div style="color: #64748b; font-size: 11px; margin-top: 8px;">${d.data.description}</div>` : ''}
            </div>
          `)
      })
      .on('mousemove', function (event: any) {
        d3.select('#lottery-tooltip')
          .style('left', event.clientX + 15 + 'px')
          .style('top', event.clientY - 10 + 'px')
      })
      .on('mouseleave', function (this: any, _event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(250)
          .ease(d3.easeCubicIn)
          .attr('d', arc as any)
          .attr('opacity', selectedPath && d.data.name !== selectedPath ? 0.3 : 0.85)
          .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))')

        d3.select('#lottery-tooltip')
          .transition()
          .duration(200)
          .style('opacity', '0')
          .on('end', function (this: any) {
            d3.select(this).style('left', '-9999px').style('top', '-9999px')
          })
      })
      .on('click', function (event: any, d: any) {
        event.stopPropagation()
        setSelectedPath(d.data.name)

        d3.select('#lottery-tooltip')
          .style('opacity', '0')
          .style('left', '-9999px')
          .style('top', '-9999px')

        // Close-then-open animation
        svg
          .selectAll('path')
          .transition()
          .duration(400)
          .ease(d3.easeCubicIn)
          .attr('d', arcCollapsed as any)
          .attr('opacity', 0)
          .on('end', function () {
            svg
              .selectAll('path')
              .transition()
              .duration(600)
              .ease(d3.easeCubicOut)
              .attr('d', arc as any)
              .attr('opacity', 0.85)
          })
      })

    // Center content
    const centerGroup = svg.append('g')

    centerGroup
      .append('circle')
      .attr('r', isMobile ? 50 : 60)
      .attr('fill', 'rgba(15, 23, 42, 0.6)')
      .attr('stroke', 'rgba(234, 179, 8, 0.3)')
      .attr('stroke-width', 1.5)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -12)
      .style('font-size', isMobile ? '10px' : '11px')
      .style('fill', '#64748b')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '1.5px')
      .text('Jackpot')

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 12)
      .style('font-size', isMobile ? '18px' : '22px')
      .style('font-weight', '700')
      .style('fill', '#eab308')
      .style('letter-spacing', '0.5px')
      .text(jackpotAmount)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 30)
      .style('font-size', isMobile ? '9px' : '10px')
      .style('fill', '#94a3b8')
      .text(`≈ $${jackpotUsd.toFixed(0)}`)
  }, [data, jackpotAmount, jackpotUsd, selectedPath])

  return (
    <>
      {createPortal(<div id="lottery-tooltip" />, document.body)}

      <div className="relative bg-gradient-to-br from-surface-900 to-surface-950 rounded-2xl p-4 sm:p-6 overflow-hidden border border-surface-800/50">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full blur-2xl" />

        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg mb-1">
                Jackpot Distribution
              </h3>
              <p className="text-xs text-surface-500">
                Click segments to animate • Hover for details
              </p>
            </div>
            {selectedPath && (
              <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{selectedPath}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10">
            {/* D3 Sunburst Chart */}
            <div className="flex-shrink-0 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-blue-500/10 rounded-full blur-2xl" />
              <svg ref={svgRef} className="relative drop-shadow-2xl" />
            </div>

            {/* Legend */}
            <div className="space-y-2.5 w-full lg:w-auto lg:min-w-[200px]">
              <LegendItem
                color="#eab308"
                name="Winner"
                value="90%"
                description="Random VRF draw"
                isSelected={selectedPath === 'Winner'}
                onClick={() => setSelectedPath(selectedPath === 'Winner' ? null : 'Winner')}
              />
              <LegendItem
                color="#ef4444"
                name="Burn"
                value="5%"
                description="Permanently removed"
                isSelected={selectedPath === 'Burns'}
                onClick={() => setSelectedPath(selectedPath === 'Burns' ? null : 'Burns')}
              />
              <LegendItem
                color="#0052FF"
                name="Protocol"
                value="5%"
                description="Development fund"
                isSelected={selectedPath === 'Protocol'}
                onClick={() => setSelectedPath(selectedPath === 'Protocol' ? null : 'Protocol')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface LegendItemProps {
  color: string
  name: string
  value: string
  description: string
  isSelected?: boolean
  onClick?: () => void
}

function LegendItem({
  color,
  name,
  value,
  description,
  isSelected,
  onClick,
}: LegendItemProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-3 rounded-xl transition-all duration-300 border ${
        isSelected
          ? 'bg-surface-800/80 border-surface-600'
          : 'bg-surface-900/50 border-surface-800/50 hover:bg-surface-800/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div>
            <span className="text-sm font-medium text-white">{name}</span>
            <p className="text-xs text-surface-500">{description}</p>
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  )
}

// Compact version for dashboard
export function LotteryDistributionCompact({
  jackpotAmount = '0.1 ETH',
}: {
  jackpotAmount?: string
}) {
  const data = [
    { name: 'Winner', value: 69, color: '#eab308' },
    { name: 'Burn', value: 21.4, color: '#ef4444' },
    { name: 'Treasury', value: 9.6, color: '#0052FF' },
  ]

  return (
    <div className="flex items-center gap-4">
      {/* Simple donut using CSS - 69% winner, 21.4% burn, 9.6% treasury */}
      <div
        className="w-[80px] h-[80px] rounded-full flex-shrink-0 relative"
        style={{
          background: `conic-gradient(
            #eab308 0deg 248.4deg,
            #ef4444 248.4deg 325.44deg,
            #0052FF 325.44deg 360deg
          )`,
        }}
      >
        <div className="absolute inset-2 bg-surface-900 rounded-full flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-yellow-500">{jackpotAmount}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-surface-400">{item.name}</span>
            <span className="font-medium text-white">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Re-export for backwards compatibility
export { LotteryDistributionChart as DistributionChart }

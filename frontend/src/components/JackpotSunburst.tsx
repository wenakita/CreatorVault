/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { Trophy, Flame, Building2, RotateCcw } from 'lucide-react'

interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
  color?: string
  description?: string
}

interface JackpotToken {
  symbol: string
  name: string
  value: number // in USD
  color: string
}

interface JackpotSunburstProps {
  tokens?: JackpotToken[]
  totalEth?: string
  totalUsd?: number
}

const DEFAULT_TOKENS: JackpotToken[] = [
  { symbol: 'wsAKITA', name: 'Wrapped Staked AKITA', value: 280, color: '#f97316' },
  { symbol: 'wsCREATOR', name: 'Wrapped Staked CREATOR', value: 50, color: '#8b5cf6' },
  { symbol: 'wsDAWG', name: 'Wrapped Staked DAWG', value: 20, color: '#06b6d4' },
]

/**
 * Looker-style Zoomable Sunburst for Jackpot Pool
 * - Click slice → zoom into that node
 * - Click center → zoom back out
 * - Labels appear when arc space is sufficient
 */
export function JackpotSunburst({
  tokens = DEFAULT_TOKENS,
  totalEth = '0.1 ETH',
  totalUsd = 350,
}: JackpotSunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  
  // Build hierarchical data
  const data: HierarchyNode = useMemo(() => {
    const tokenChildren = tokens.map((token) => ({
      name: token.symbol,
      color: token.color,
      description: token.name,
      children: [
        { name: 'Winner', value: token.value * 0.9, color: '#eab308' },
        { name: 'Burn', value: token.value * 0.05, color: '#ef4444' },
        { name: 'Protocol', value: token.value * 0.05, color: '#0052FF' },
      ],
    }))

    return {
      name: 'Jackpot',
      children: tokenChildren,
    }
  }, [tokens])

  // Sizing
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const size = isMobile ? 300 : 380
  const radius = size / 2

  // Build partition layout
  const root = useMemo(() => {
    const r = d3
      .hierarchy<HierarchyNode>(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    return d3.partition<HierarchyNode>().size([2 * Math.PI, radius])(r)
  }, [data, radius])

  // Current focus node (zoom state)
  const [focus, setFocus] = useState(root)

  // Reset focus when data changes
  useEffect(() => setFocus(root), [root])

  // D3 rendering
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)

    // Color scale based on token colors or category
    const tokenColorMap: Record<string, string> = {}
    tokens.forEach((t) => {
      tokenColorMap[t.symbol] = t.color
    })

    const getColor = (d: d3.HierarchyRectangularNode<HierarchyNode>) => {
      // If it's a leaf (Winner/Burn/Protocol), use its color
      if (d.data.color && d.depth > 1) return d.data.color
      // If it's a token, use token color
      if (tokenColorMap[d.data.name]) return tokenColorMap[d.data.name]
      // Find ancestor token
      const tokenAncestor = d.ancestors().find((a) => tokenColorMap[a.data.name])
      if (tokenAncestor) return tokenColorMap[tokenAncestor.data.name]
      return '#64748b'
    }

    const arc = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.01))
      .padRadius(radius)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => Math.max(d.y0, d.y1 - 1))

    // Scale functions for zoom
    let x = d3.scaleLinear().domain([focus.x0, focus.x1]).range([0, 2 * Math.PI])
    let y = d3.scaleLinear().domain([focus.y0, radius]).range([0, radius])

    function arcVisible(d: d3.HierarchyRectangularNode<HierarchyNode>) {
      return d.y1 <= radius && d.y0 >= 0 && d.x1 > d.x0
    }

    function labelVisible(d: d3.HierarchyRectangularNode<HierarchyNode>) {
      const a = x(d.x1) - x(d.x0)
      const rMid = (y(d.y0) + y(d.y1)) / 2
      return arcVisible(d) && a * rMid > 12
    }

    function labelTransform(d: d3.HierarchyRectangularNode<HierarchyNode>) {
      const angle = ((x(d.x0) + x(d.x1)) / 2) * (180 / Math.PI)
      const r = (y(d.y0) + y(d.y1)) / 2
      return `rotate(${angle - 90}) translate(${r},0) rotate(${angle < 180 ? 0 : 180})`
    }

    const g = svg.append('g')

    // Center circle (click to zoom out)
    const centerRadius = y(focus.y0) || 50
    const center = g
      .append('circle')
      .attr('r', centerRadius)
      .attr('fill', 'rgba(15, 23, 42, 0.8)')
      .attr('stroke', 'rgba(234, 179, 8, 0.3)')
      .attr('stroke-width', 1.5)
      .attr('pointer-events', 'all')
      .style('cursor', focus.parent ? 'pointer' : 'default')
      .on('click', () => {
        if (focus.parent) setFocus(focus.parent)
      })

    // Center text
    const centerGroup = g.append('g').attr('pointer-events', 'none')

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -8)
      .style('font-size', '10px')
      .style('fill', '#64748b')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '1px')
      .text(focus.depth === 0 ? 'Jackpot' : focus.data.name)

    centerGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 14)
      .style('font-size', '18px')
      .style('font-weight', '700')
      .style('fill', '#eab308')
      .text(focus.depth === 0 ? totalEth : `$${(focus.value || 0).toFixed(0)}`)

    if (focus.parent) {
      centerGroup
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 32)
        .style('font-size', '9px')
        .style('fill', '#94a3b8')
        .text('← click to zoom out')
    } else {
      centerGroup
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 32)
        .style('font-size', '9px')
        .style('fill', '#94a3b8')
        .text(`≈ $${totalUsd.toFixed(0)}`)
    }

    // Arc paths
    const nodes = root.descendants().filter((d) => d.depth)

    const path = g
      .selectAll('path')
      .data(nodes)
      .join('path')
      .attr('fill', (d: any) => getColor(d))
      .attr('fill-opacity', (d: any) => (arcVisible(d) ? 0.85 : 0))
      .attr('pointer-events', (d: any) => (arcVisible(d) ? 'auto' : 'none'))
      .attr('d', (d: any) =>
        arc({
          ...d,
          x0: x(d.x0),
          x1: x(d.x1),
          y0: y(d.y0),
          y1: y(d.y1),
        } as any)
      )
      .style('cursor', 'pointer')
      .style('transition', 'filter 0.2s')
      .on('mouseenter', function () {
        d3.select(this).style('filter', 'brightness(1.2)')
      })
      .on('mouseleave', function () {
        d3.select(this).style('filter', 'none')
      })
      .on('click', (_: any, d: any) => setFocus(d))

    // Tooltips
    path.append('title').text((d: any) => {
      const label = d
        .ancestors()
        .reverse()
        .map((n: any) => n.data.name)
        .join(' → ')
      const pct = totalUsd > 0 ? (((d.value || 0) / totalUsd) * 100).toFixed(1) : '0'
      return `${label}\n$${(d.value || 0).toFixed(2)} (${pct}%)`
    })

    // Labels
    g.selectAll('text.label')
      .data(nodes)
      .join('text')
      .attr('class', 'label')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('fill-opacity', (d: any) => (labelVisible(d) ? 1 : 0))
      .attr('transform', (d: any) => labelTransform(d))
      .text((d: any) => d.data.name)

    // Zoom transition function
    function zoomTo(newFocus: d3.HierarchyRectangularNode<HierarchyNode>) {
      const xNew = d3
        .scaleLinear()
        .domain([newFocus.x0, newFocus.x1])
        .range([0, 2 * Math.PI])

      const yNew = d3.scaleLinear().domain([newFocus.y0, radius]).range([0, radius])

      const t = g.transition().duration(600)

      center
        .style('cursor', newFocus.parent ? 'pointer' : 'default')
        .transition(t as any)
        .attr('r', yNew(newFocus.y0) || 50)

      // Update center text
      centerGroup.selectAll('*').remove()

      centerGroup
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -8)
        .style('font-size', '10px')
        .style('fill', '#64748b')
        .style('text-transform', 'uppercase')
        .style('letter-spacing', '1px')
        .text(newFocus.depth === 0 ? 'Jackpot' : newFocus.data.name)

      centerGroup
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 14)
        .style('font-size', '18px')
        .style('font-weight', '700')
        .style('fill', '#eab308')
        .text(newFocus.depth === 0 ? totalEth : `$${(newFocus.value || 0).toFixed(0)}`)

      if (newFocus.parent) {
        centerGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 32)
          .style('font-size', '9px')
          .style('fill', '#94a3b8')
          .text('← click to zoom out')
      } else {
        centerGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 32)
          .style('font-size', '9px')
          .style('fill', '#94a3b8')
          .text(`≈ $${totalUsd.toFixed(0)}`)
      }

      path
        .transition(t as any)
        .attr('fill-opacity', (d: any) => (arcVisible(d) ? 0.85 : 0))
        .attr('pointer-events', (d: any) => (arcVisible(d) ? 'auto' : 'none'))
        .attrTween('d', (d: any) => {
          const i = d3.interpolate(
            { x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) },
            { x0: xNew(d.x0), x1: xNew(d.x1), y0: yNew(d.y0), y1: yNew(d.y1) }
          )
          return (tt: number) => arc({ ...d, ...i(tt) } as any) as string
        })

      g.selectAll('text.label')
        .transition(t as any)
        .attr('fill-opacity', (d: any) => {
          const a = xNew(d.x1) - xNew(d.x0)
          const rMid = (yNew(d.y0) + yNew(d.y1)) / 2
          return a * rMid > 12 ? 1 : 0
        })
        .attrTween('transform', (d: any) => {
          const i = d3.interpolate(
            { x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) },
            { x0: xNew(d.x0), x1: xNew(d.x1), y0: yNew(d.y0), y1: yNew(d.y1) }
          )
          return (tt: number) => {
            const v = i(tt)
            const angle = ((v.x0 + v.x1) / 2) * (180 / Math.PI)
            const rMid = (v.y0 + v.y1) / 2
            return `rotate(${angle - 90}) translate(${rMid},0) rotate(${angle < 180 ? 0 : 180})`
          }
        })

      // Update scales for next transition
      x = xNew
      y = yNew
    }

    zoomTo(focus)

    return () => {
      svg.selectAll('*').remove()
    }
  }, [root, focus, radius, size, tokens, totalEth, totalUsd])

  return (
    <div className="relative bg-gradient-to-br from-surface-900 to-surface-950 rounded-2xl p-4 sm:p-5 overflow-hidden border border-surface-800/50">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-sm sm:text-base">Jackpot Pool</h3>
            <p className="text-[10px] text-surface-500">
              Click to drill down • Center to zoom out
            </p>
          </div>
          <div className="flex items-center gap-2">
            {focus.parent && (
              <button
                onClick={() => setFocus(root)}
                className="p-1.5 rounded-md bg-surface-800/50 text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 text-[10px] font-medium">
              Live
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-5">
          {/* Zoomable Sunburst */}
          <div className="flex-shrink-0 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-blue-500/5 rounded-full blur-xl" />
            <svg ref={svgRef} width={size} height={size} className="relative" />
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-3">
            {/* Token Composition */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">
                Pool Composition
              </p>
              {tokens.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => {
                    const node = root.descendants().find((d) => d.data.name === token.symbol)
                    if (node) setFocus(node)
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-900/50 border border-transparent hover:bg-surface-800/50 hover:border-surface-700 transition-all text-left"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: token.color }}
                    />
                    <span className="text-xs font-medium text-white">{token.symbol}</span>
                  </div>
                  <span className="text-xs font-mono text-surface-400">${token.value.toFixed(0)}</span>
                </button>
              ))}
            </div>

            {/* Distribution */}
            <div className="pt-2 border-t border-surface-800/50 space-y-1.5">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">
                Distribution
              </p>
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
  )
}

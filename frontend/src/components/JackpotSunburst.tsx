/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { Trophy, Flame, Building2, RotateCcw } from 'lucide-react'

interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
  color?: string
}

interface JackpotToken {
  symbol: string
  name: string
  value: number
  color: string
}

interface JackpotSunburstProps {
  tokens?: JackpotToken[]
  totalEth?: string
  totalUsd?: number
}

const DEFAULT_TOKENS: JackpotToken[] = [
  { symbol: 'wsAKITA', name: 'Wrapped Staked AKITA', value: 280, color: '#f97316' },
  { symbol: 'wsCREATOR', name: 'Wrapped Staked CREATOR', value: 50, color: '#a855f7' },
  { symbol: 'wsDAWG', name: 'Wrapped Staked DAWG', value: 20, color: '#06b6d4' },
]

/**
 * 3D-style Zoomable Sunburst with gradients and depth
 */
export function JackpotSunburst({
  tokens = DEFAULT_TOKENS,
  totalEth = '0.1 ETH',
  totalUsd = 350,
}: JackpotSunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const data: HierarchyNode = useMemo(() => {
    const tokenChildren = tokens.map((token) => ({
      name: token.symbol,
      color: token.color,
      children: [
        { name: 'Winner', value: token.value * 0.9, color: '#facc15' },
        { name: 'Burn', value: token.value * 0.05, color: '#f87171' },
        { name: 'Protocol', value: token.value * 0.05, color: '#60a5fa' },
      ],
    }))
    return { name: 'Jackpot', children: tokenChildren }
  }, [tokens])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const size = isMobile ? 320 : 400
  const radius = size / 2

  const root = useMemo(() => {
    const r = d3
      .hierarchy<HierarchyNode>(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    return d3.partition<HierarchyNode>().size([2 * Math.PI, radius])(r)
  }, [data, radius])

  const [focus, setFocus] = useState(root)
  useEffect(() => setFocus(root), [root])

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)

    // Gradients for 3D effect
    const defs = svg.append('defs')

    // Radial gradient for depth
    const radialGrad = defs.append('radialGradient')
      .attr('id', 'depthGradient')
      .attr('cx', '30%')
      .attr('cy', '30%')
    radialGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.15)')
    radialGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.3)')

    // Drop shadow filter
    const filter = defs.append('filter')
      .attr('id', 'dropShadow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%')
    filter.append('feDropShadow')
      .attr('dx', '0').attr('dy', '4')
      .attr('stdDeviation', '8')
      .attr('flood-color', 'rgba(0,0,0,0.5)')

    // Glow filter
    const glow = defs.append('filter').attr('id', 'glow')
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur')
    glow.append('feMerge').html('<feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>')

    // Token colors
    const tokenColorMap: Record<string, string> = {}
    tokens.forEach((t) => { tokenColorMap[t.symbol] = t.color })

    const getColor = (d: any) => {
      if (d.data.color && d.depth > 1) return d.data.color
      if (tokenColorMap[d.data.name]) return tokenColorMap[d.data.name]
      const ancestor = d.ancestors().find((a: any) => tokenColorMap[a.data.name])
      return ancestor ? tokenColorMap[ancestor.data.name] : '#64748b'
    }

    // Create gradient for each token
    tokens.forEach((token) => {
      const grad = defs.append('linearGradient')
        .attr('id', `grad-${token.symbol}`)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '100%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(token.color)?.brighter(0.5)?.toString() || token.color)
      grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(token.color)?.darker(0.5)?.toString() || token.color)
    })

    const arc = d3.arc<any>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle(0.01)
      .padRadius(radius * 0.5)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => Math.max(d.y0, d.y1 - 2))
      .cornerRadius(4)

    let x = d3.scaleLinear().domain([focus.x0, focus.x1]).range([0, 2 * Math.PI])
    let y = d3.scaleLinear().domain([focus.y0, radius]).range([0, radius])

    const g = svg.append('g').attr('filter', 'url(#dropShadow)')

    // Center glow circle
    g.append('circle')
      .attr('r', y(focus.y0) + 5 || 55)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(234, 179, 8, 0.2)')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)')

    // Center circle
    const centerR = y(focus.y0) || 50
    const center = g.append('circle')
      .attr('r', centerR)
      .attr('fill', 'url(#centerGrad)')
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1)
      .style('cursor', focus.parent ? 'pointer' : 'default')
      .on('click', () => { if (focus.parent) setFocus(focus.parent) })

    // Center gradient
    const centerGrad = defs.append('radialGradient')
      .attr('id', 'centerGrad')
      .attr('cx', '35%').attr('cy', '35%')
    centerGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(30,41,59,1)')
    centerGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(15,23,42,1)')

    // Center text
    const centerText = g.append('g').attr('pointer-events', 'none')
    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -12)
      .style('font-size', '10px')
      .style('fill', '#94a3b8')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '2px')
      .text(focus.depth === 0 ? 'Jackpot' : focus.data.name)

    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 12)
      .style('font-size', '22px')
      .style('font-weight', '700')
      .style('fill', '#fbbf24')
      .style('text-shadow', '0 0 20px rgba(251,191,36,0.5)')
      .text(focus.depth === 0 ? totalEth : `$${(focus.value || 0).toFixed(0)}`)

    if (focus.parent) {
      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 32)
        .style('font-size', '9px')
        .style('fill', '#64748b')
        .text('tap to zoom out')
    } else {
      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 32)
        .style('font-size', '10px')
        .style('fill', '#64748b')
        .text(`≈ $${totalUsd.toFixed(0)} USD`)
    }

    // Arcs
    const nodes = root.descendants().filter((d) => d.depth)
    const path = g.selectAll('path')
      .data(nodes)
      .join('path')
      .attr('fill', (d: any) => {
        const color = getColor(d)
        // Use gradient for depth 1 (tokens)
        if (d.depth === 1) {
          return `url(#grad-${d.data.name})`
        }
        return color
      })
      .attr('fill-opacity', (d: any) => d.y1 <= radius && d.y0 >= 0 && d.x1 > d.x0 ? 0.9 : 0)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 0.5)
      .attr('d', (d: any) => arc({ ...d, x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) }))
      .style('cursor', 'pointer')
      .on('mouseenter', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('fill-opacity', 1)
          .attr('stroke-width', 1.5)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('fill-opacity', 0.9)
          .attr('stroke-width', 0.5)
      })
      .on('click', (_: any, d: any) => setFocus(d))

    // Tooltips
    path.append('title').text((d: any) => {
      const label = d.ancestors().reverse().map((n: any) => n.data.name).join(' → ')
      return `${label}\n$${(d.value || 0).toFixed(2)} (${totalUsd > 0 ? ((d.value || 0) / totalUsd * 100).toFixed(1) : 0}%)`
    })

    // Labels
    g.selectAll('text.label')
      .data(nodes)
      .join('text')
      .attr('class', 'label')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', '600')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('fill-opacity', (d: any) => {
        const a = x(d.x1) - x(d.x0)
        const rMid = (y(d.y0) + y(d.y1)) / 2
        return a * rMid > 14 ? 1 : 0
      })
      .attr('transform', (d: any) => {
        const angle = ((x(d.x0) + x(d.x1)) / 2) * (180 / Math.PI)
        const r = (y(d.y0) + y(d.y1)) / 2
        return `rotate(${angle - 90}) translate(${r},0) rotate(${angle < 180 ? 0 : 180})`
      })
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)')
      .text((d: any) => d.data.name)

    // Zoom function
    function zoomTo(newFocus: any) {
      const xNew = d3.scaleLinear().domain([newFocus.x0, newFocus.x1]).range([0, 2 * Math.PI])
      const yNew = d3.scaleLinear().domain([newFocus.y0, radius]).range([0, radius])
      const t = g.transition().duration(750).ease(d3.easeCubicInOut)

      center
        .style('cursor', newFocus.parent ? 'pointer' : 'default')
        .transition(t as any)
        .attr('r', yNew(newFocus.y0) || 50)

      // Update center text
      centerText.selectAll('*').remove()
      centerText.append('text')
        .attr('text-anchor', 'middle').attr('y', -12)
        .style('font-size', '10px').style('fill', '#94a3b8')
        .style('text-transform', 'uppercase').style('letter-spacing', '2px')
        .text(newFocus.depth === 0 ? 'Jackpot' : newFocus.data.name)
      centerText.append('text')
        .attr('text-anchor', 'middle').attr('y', 12)
        .style('font-size', '22px').style('font-weight', '700')
        .style('fill', '#fbbf24').style('text-shadow', '0 0 20px rgba(251,191,36,0.5)')
        .text(newFocus.depth === 0 ? totalEth : `$${(newFocus.value || 0).toFixed(0)}`)
      centerText.append('text')
        .attr('text-anchor', 'middle').attr('y', 32)
        .style('font-size', newFocus.parent ? '9px' : '10px').style('fill', '#64748b')
        .text(newFocus.parent ? 'tap to zoom out' : `≈ $${totalUsd.toFixed(0)} USD`)

      path.transition(t as any)
        .attr('fill-opacity', (d: any) => d.y1 <= radius && d.y0 >= 0 && d.x1 > d.x0 ? 0.9 : 0)
        .attrTween('d', (d: any) => {
          const i = d3.interpolate(
            { x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) },
            { x0: xNew(d.x0), x1: xNew(d.x1), y0: yNew(d.y0), y1: yNew(d.y1) }
          )
          return (tt: number) => arc({ ...d, ...i(tt) }) as string
        })

      g.selectAll('text.label').transition(t as any)
        .attr('fill-opacity', (d: any) => {
          const a = xNew(d.x1) - xNew(d.x0)
          const rMid = (yNew(d.y0) + yNew(d.y1)) / 2
          return a * rMid > 14 ? 1 : 0
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

      x = xNew; y = yNew
    }

    zoomTo(focus)
    return () => { svg.selectAll('*').remove() }
  }, [root, focus, radius, size, tokens, totalEth, totalUsd])

  return (
    <div className="relative">
      {/* Ambient glow behind chart */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950/90 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-white/5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold text-base tracking-tight">Live Jackpot Pool</h3>
            <p className="text-slate-500 text-xs mt-0.5">Tap to explore • Center to zoom out</p>
          </div>
          {focus.parent && (
            <button
              onClick={() => setFocus(root)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Chart */}
          <div className="relative">
            <svg ref={svgRef} width={size} height={size} />
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium mb-2">Pool Assets</p>
              <div className="space-y-1.5">
                {tokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      const node = root.descendants().find((d) => d.data.name === token.symbol)
                      if (node) setFocus(node)
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: token.color, boxShadow: `0 0 12px ${token.color}50` }} />
                      <span className="text-sm font-medium text-white/90 group-hover:text-white">{token.symbol}</span>
                    </div>
                    <span className="text-sm font-mono text-slate-400">${token.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium mb-2">Distribution</p>
              <div className="space-y-2">
                {[
                  { icon: Trophy, label: 'Winner', pct: '90%', color: 'text-yellow-400' },
                  { icon: Flame, label: 'Burn', pct: '5%', color: 'text-red-400' },
                  { icon: Building2, label: 'Protocol', pct: '5%', color: 'text-blue-400' },
                ].map(({ icon: Icon, label, pct, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className="text-slate-400">{label}</span>
                    </div>
                    <span className={`font-semibold ${color}`}>{pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

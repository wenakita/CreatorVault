/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Trophy, Flame, Building2, RotateCcw, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

export function JackpotSunburst({
  tokens = DEFAULT_TOKENS,
  totalEth = '0.1 ETH',
  totalUsd = 350,
}: JackpotSunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltipData, setTooltipData] = useState<{
    name: string
    value: number
    percentage: number
    x: number
    y: number
  } | null>(null)

  const data: HierarchyNode = useMemo(() => {
    const tokenChildren = tokens.map((token) => ({
      name: token.symbol,
      color: token.color,
      children: [
        { name: 'Winner', value: token.value * 0.9, color: '#fbbf24' },
        { name: 'Burn', value: token.value * 0.05, color: '#f87171' },
        { name: 'Protocol', value: token.value * 0.05, color: '#60a5fa' },
      ],
    }))
    return { name: 'Pool', children: tokenChildren }
  }, [tokens])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const size = isMobile ? 280 : 340
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

  const tokenColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    tokens.forEach((t) => { map[t.symbol] = t.color })
    return map
  }, [tokens])

  const getNodeColor = useCallback((d: any): string => {
    if (d.data.color && d.depth > 1) return d.data.color
    if (tokenColorMap[d.data.name]) return tokenColorMap[d.data.name]
    const ancestor = d.ancestors().find((a: any) => tokenColorMap[a.data.name])
    return ancestor ? tokenColorMap[ancestor.data.name] : '#64748b'
  }, [tokenColorMap])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)

    const defs = svg.append('defs')

    // Refined gradients for each token
    tokens.forEach((token) => {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${token.symbol}`)
        .attr('gradientTransform', 'rotate(45)')
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(token.color)?.brighter(0.3)?.toString() || token.color)
      gradient.append('stop')
        .attr('offset', '50%')
        .attr('stop-color', token.color)
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d3.color(token.color)?.darker(0.3)?.toString() || token.color)
    })

    // Distribution gradients
    const distColors = [
      { id: 'winner', colors: ['#fde047', '#fbbf24', '#f59e0b'] },
      { id: 'burn', colors: ['#fca5a5', '#f87171', '#ef4444'] },
      { id: 'protocol', colors: ['#93c5fd', '#60a5fa', '#3b82f6'] },
    ]
    distColors.forEach(({ id, colors }) => {
      const grad = defs.append('linearGradient')
        .attr('id', `gradient-${id}`)
        .attr('gradientTransform', 'rotate(45)')
      grad.append('stop').attr('offset', '0%').attr('stop-color', colors[0])
      grad.append('stop').attr('offset', '50%').attr('stop-color', colors[1])
      grad.append('stop').attr('offset', '100%').attr('stop-color', colors[2])
    })

    // Subtle inner shadow
    const innerShadow = defs.append('filter').attr('id', 'innerShadow')
    innerShadow.append('feOffset').attr('dx', '0').attr('dy', '2')
    innerShadow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'offset-blur')
    innerShadow.append('feComposite')
      .attr('operator', 'out')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'offset-blur')
      .attr('result', 'inverse')
    innerShadow.append('feFlood').attr('flood-color', 'black').attr('flood-opacity', '0.15').attr('result', 'color')
    innerShadow.append('feComposite').attr('operator', 'in').attr('in', 'color').attr('in2', 'inverse').attr('result', 'shadow')
    innerShadow.append('feComposite').attr('operator', 'over').attr('in', 'shadow').attr('in2', 'SourceGraphic')

    // Outer glow
    const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    glow.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', '4').attr('result', 'blur')
    glow.append('feOffset').attr('in', 'blur').attr('dx', '0').attr('dy', '0').attr('result', 'offsetBlur')
    const glowMerge = glow.append('feMerge')
    glowMerge.append('feMergeNode').attr('in', 'offsetBlur')
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Arc generator with refined styling
    const arc = d3.arc<any>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle(0.015)
      .padRadius(radius * 0.4)
      .innerRadius((d) => d.y0 + 2)
      .outerRadius((d) => Math.max(d.y0 + 2, d.y1 - 3))
      .cornerRadius(6)

    const arcHover = d3.arc<any>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle(0.015)
      .padRadius(radius * 0.4)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 + 4)
      .cornerRadius(8)

    let x = d3.scaleLinear().domain([focus.x0, focus.x1]).range([0, 2 * Math.PI])
    let y = d3.scaleLinear().domain([focus.y0, radius]).range([0, radius])

    const g = svg.append('g')

    // Ambient ring
    g.append('circle')
      .attr('r', radius - 10)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.03)')
      .attr('stroke-width', 1)

    // Center background
    const centerR = y(focus.y0) || 45
    g.append('circle')
      .attr('r', centerR + 8)
      .attr('fill', 'rgba(15,23,42,0.4)')
      .attr('filter', 'url(#glow)')

    // Center circle with gradient
    const centerGrad = defs.append('radialGradient')
      .attr('id', 'centerGrad')
      .attr('cx', '35%').attr('cy', '35%')
    centerGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(30,41,59,1)')
    centerGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(15,23,42,1)')

    const center = g.append('circle')
      .attr('r', centerR)
      .attr('fill', 'url(#centerGrad)')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#innerShadow)')
      .style('cursor', focus.parent ? 'pointer' : 'default')
      .on('click', () => { if (focus.parent) setFocus(focus.parent) })

    // Golden ring accent
    g.append('circle')
      .attr('r', centerR)
      .attr('fill', 'none')
      .attr('stroke', 'url(#goldRing)')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6)

    const goldRing = defs.append('linearGradient').attr('id', 'goldRing').attr('gradientTransform', 'rotate(90)')
    goldRing.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(251,191,36,0.4)')
    goldRing.append('stop').attr('offset', '50%').attr('stop-color', 'rgba(251,191,36,0.1)')
    goldRing.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(251,191,36,0.4)')

    // Center text
    const centerText = g.append('g').attr('pointer-events', 'none')
    
    if (focus.depth === 0) {
      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -14)
        .attr('fill', '#94a3b8')
        .style('font-size', '9px')
        .style('font-weight', '500')
        .style('letter-spacing', '1.5px')
        .style('text-transform', 'uppercase')
        .text('Jackpot')

      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 10)
        .attr('fill', '#fbbf24')
        .style('font-size', '20px')
        .style('font-weight', '700')
        .text(totalEth)

      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 28)
        .attr('fill', '#64748b')
        .style('font-size', '10px')
        .text(`≈ $${totalUsd.toFixed(0)}`)
    } else {
      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -8)
        .attr('fill', '#94a3b8')
        .style('font-size', '9px')
        .style('font-weight', '500')
        .style('letter-spacing', '1px')
        .text(focus.data.name)

      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 14)
        .attr('fill', '#fbbf24')
        .style('font-size', '18px')
        .style('font-weight', '700')
        .text(`$${(focus.value || 0).toFixed(0)}`)

      centerText.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 32)
        .attr('fill', '#475569')
        .style('font-size', '9px')
        .text('← back')
    }

    // Draw arcs
    const nodes = root.descendants().filter((d) => d.depth)

    const paths = g.selectAll('path.arc')
      .data(nodes)
      .join('path')
      .attr('class', 'arc')
      .attr('fill', (d: any) => {
        const name = d.data.name.toLowerCase()
        if (d.depth === 1) return `url(#gradient-${d.data.name})`
        if (name === 'winner') return 'url(#gradient-winner)'
        if (name === 'burn') return 'url(#gradient-burn)'
        if (name === 'protocol') return 'url(#gradient-protocol)'
        return getNodeColor(d)
      })
      .attr('fill-opacity', (d: any) => {
        const visible = d.y1 <= radius && d.y0 >= 0 && d.x1 > d.x0
        if (!visible) return 0
        if (hoveredNode && hoveredNode !== d.data.name) return 0.5
        return 0.95
      })
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 0.5)
      .attr('d', (d: any) => arc({ ...d, x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) }))
      .style('cursor', 'pointer')
      .style('transition', 'fill-opacity 200ms ease')
      .on('mouseenter', function(event: any, d: any) {
        setHoveredNode(d.data.name)
        d3.select(this)
          .transition()
          .duration(200)
          .ease(d3.easeCubicOut)
          .attr('d', arcHover({ ...d, x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) }))
          .attr('fill-opacity', 1)
          .attr('stroke-width', 1)

        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          setTooltipData({
            name: d.data.name,
            value: d.value || 0,
            percentage: totalUsd > 0 ? ((d.value || 0) / totalUsd) * 100 : 0,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        }
      })
      .on('mousemove', function(event: any, d: any) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          setTooltipData({
            name: d.data.name,
            value: d.value || 0,
            percentage: totalUsd > 0 ? ((d.value || 0) / totalUsd) * 100 : 0,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        }
      })
      .on('mouseleave', function(_, d: any) {
        setHoveredNode(null)
        setTooltipData(null)
        d3.select(this)
          .transition()
          .duration(200)
          .ease(d3.easeCubicIn)
          .attr('d', arc({ ...d, x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) }))
          .attr('fill-opacity', 0.95)
          .attr('stroke-width', 0.5)
      })
      .on('click', (_, d: any) => {
        setTooltipData(null)
        setFocus(d)
      })

    // Zoom transition
    function zoomTo(newFocus: any) {
      const xNew = d3.scaleLinear().domain([newFocus.x0, newFocus.x1]).range([0, 2 * Math.PI])
      const yNew = d3.scaleLinear().domain([newFocus.y0, radius]).range([0, radius])
      const t = g.transition().duration(800).ease(d3.easeCubicInOut)

      const newCenterR = yNew(newFocus.y0) || 45

      center
        .style('cursor', newFocus.parent ? 'pointer' : 'default')
        .transition(t as any)
        .attr('r', newCenterR)

      // Update center text
      centerText.selectAll('*').remove()
      if (newFocus.depth === 0) {
        centerText.append('text').attr('text-anchor', 'middle').attr('y', -14).attr('fill', '#94a3b8')
          .style('font-size', '9px').style('font-weight', '500').style('letter-spacing', '1.5px')
          .style('text-transform', 'uppercase').text('Jackpot')
        centerText.append('text').attr('text-anchor', 'middle').attr('y', 10).attr('fill', '#fbbf24')
          .style('font-size', '20px').style('font-weight', '700').text(totalEth)
        centerText.append('text').attr('text-anchor', 'middle').attr('y', 28).attr('fill', '#64748b')
          .style('font-size', '10px').text(`≈ $${totalUsd.toFixed(0)}`)
      } else {
        centerText.append('text').attr('text-anchor', 'middle').attr('y', -8).attr('fill', '#94a3b8')
          .style('font-size', '9px').style('font-weight', '500').style('letter-spacing', '1px').text(newFocus.data.name)
        centerText.append('text').attr('text-anchor', 'middle').attr('y', 14).attr('fill', '#fbbf24')
          .style('font-size', '18px').style('font-weight', '700').text(`$${(newFocus.value || 0).toFixed(0)}`)
        centerText.append('text').attr('text-anchor', 'middle').attr('y', 32).attr('fill', '#475569')
          .style('font-size', '9px').text('← back')
      }

      paths.transition(t as any)
        .attr('fill-opacity', (d: any) => d.y1 <= radius && d.y0 >= 0 && d.x1 > d.x0 ? 0.95 : 0)
        .attrTween('d', (d: any) => {
          const i = d3.interpolate(
            { x0: x(d.x0), x1: x(d.x1), y0: y(d.y0), y1: y(d.y1) },
            { x0: xNew(d.x0), x1: xNew(d.x1), y0: yNew(d.y0), y1: yNew(d.y1) }
          )
          return (tt: number) => arc({ ...d, ...i(tt) }) as string
        })

      x = xNew
      y = yNew
    }

    zoomTo(focus)

    return () => { svg.selectAll('*').remove() }
  }, [root, focus, radius, size, tokens, totalEth, totalUsd, tokenColorMap, getNodeColor, hoveredNode])

  return (
    <div className="relative">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <div className="w-48 h-48 bg-amber-500/5 rounded-full blur-[60px]" />
      </div>

      <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl rounded-3xl border border-white/[0.06] shadow-2xl overflow-hidden">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white/90 font-semibold text-sm tracking-tight">Live Jackpot</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">Tap segments to explore</p>
            </div>
            <AnimatePresence>
              {focus.parent && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setFocus(root)}
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Chart */}
            <div className="relative flex-shrink-0">
              <svg ref={svgRef} width={size} height={size} className="drop-shadow-xl" />
              
              {/* Custom tooltip */}
              <AnimatePresence>
                {tooltipData && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg bg-slate-800/95 backdrop-blur border border-white/10 shadow-xl"
                    style={{
                      left: tooltipData.x + 12,
                      top: tooltipData.y - 40,
                    }}
                  >
                    <div className="text-white font-medium text-xs">{tooltipData.name}</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-amber-400 font-semibold text-sm">${tooltipData.value.toFixed(2)}</span>
                      <span className="text-slate-500 text-[10px]">{tooltipData.percentage.toFixed(1)}%</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full lg:max-w-[200px] space-y-4">
              {/* Pool assets */}
              <div>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium mb-2">Pool Assets</p>
                <div className="space-y-1">
                  {tokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        const node = root.descendants().find((d) => d.data.name === token.symbol)
                        if (node) setFocus(node)
                      }}
                      onMouseEnter={() => setHoveredNode(token.symbol)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group ${
                        hoveredNode === token.symbol
                          ? 'bg-white/[0.06] border-white/10'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                      } border`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ 
                            backgroundColor: token.color,
                            boxShadow: hoveredNode === token.symbol ? `0 0 8px ${token.color}` : 'none'
                          }} 
                        />
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                          {token.symbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono text-slate-500">${token.value}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Distribution */}
              <div className="pt-3 border-t border-white/[0.04]">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium mb-2">Distribution</p>
                <div className="space-y-1.5">
                  {[
                    { icon: Trophy, label: 'Winner', pct: 90, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                    { icon: Flame, label: 'Burn', pct: 5, color: 'text-red-400', bg: 'bg-red-400/10' },
                    { icon: Building2, label: 'Protocol', pct: 5, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  ].map(({ icon: Icon, label, pct, color, bg }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${bg}`}>
                          <Icon className={`w-3 h-3 ${color}`} />
                        </div>
                        <span className="text-slate-400">{label}</span>
                      </div>
                      <span className={`font-semibold tabular-nums ${color}`}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useId, useMemo } from 'react'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

type Pt = { x: number; y: number }

function fmt(n: number): string {
  // Keep SVG strings short but stable (helps perf and avoids flicker from float noise).
  return n.toFixed(2)
}

function smoothPath(
  points: Pt[],
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number; baseY: number },
  tension = 1,
): { lineD: string; areaD: string } | null {
  if (points.length < 2) return null

  const { xMin, xMax, yMin, yMax, baseY } = bounds

  let lineD = `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`
  let areaD = `M ${fmt(points[0]!.x)} ${fmt(baseY)} L ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2

    const cp1x = clamp(p1.x + ((p2.x - p0.x) / 6) * tension, xMin, xMax)
    const cp1y = clamp(p1.y + ((p2.y - p0.y) / 6) * tension, yMin, yMax)
    const cp2x = clamp(p2.x - ((p3.x - p1.x) / 6) * tension, xMin, xMax)
    const cp2y = clamp(p2.y - ((p3.y - p1.y) / 6) * tension, yMin, yMax)

    const seg = ` C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`
    lineD += seg
    areaD += seg
  }

  areaD += ` L ${fmt(points[points.length - 1]!.x)} ${fmt(baseY)} Z`
  return { lineD, areaD }
}

export function Sparkline({
  values,
  width = 140,
  height = 36,
  stroke,
}: {
  values?: number[]
  width?: number
  height?: number
  stroke: string
}) {
  const gradientId = useId().replace(/:/g, '')

  const paths = useMemo(() => {
    const raw = (values ?? []).filter((x) => Number.isFinite(x)) as number[]
    if (raw.length < 2) return null

    // Downsample for visual cleanliness + smaller SVG paths (helps perf when rendering lots of rows).
    const maxPoints = Math.max(24, Math.floor(width * 1.5))
    const step = raw.length > maxPoints ? Math.ceil(raw.length / maxPoints) : 1
    const v = step > 1 ? raw.filter((_, i) => i % step === 0 || i === raw.length - 1) : raw
    if (v.length < 2) return null

    const min = Math.min(...v)
    const max = Math.max(...v)
    const span = max - min
    const isFlat = span === 0

    // Slightly more breathing room than before → looks less "cramped" in a dense table.
    const padX = 3
    const padY = 3
    const w = Math.max(1, width - padX * 2)
    const h = Math.max(1, height - padY * 2)

    const pts: Pt[] = v.map((val, i) => {
      const x = padX + (i / (v.length - 1)) * w
      const t = isFlat ? 0.5 : (val - min) / span
      const y = padY + (1 - t) * h
      return { x: clamp(x, padX, padX + w), y: clamp(y, padY, padY + h) }
    })

    // CoinGecko-ish: smooth, minimalist curve with subtle area fill.
    return smoothPath(
      pts,
      {
        xMin: padX,
        xMax: padX + w,
        yMin: padY,
        yMax: padY + h,
        baseY: padY + h,
      },
      1, // medium smoothing
    )
  }, [height, values, width])

  if (!paths) return null

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sparkline-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={paths.areaD} fill={`url(#sparkline-fill-${gradientId})`} />
      <path
        d={paths.lineD}
        fill="none"
        stroke={stroke}
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
      />
    </svg>
  )
}



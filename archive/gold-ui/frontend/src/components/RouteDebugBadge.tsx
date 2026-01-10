import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

function isDebugEnabled(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('debug') === '1' || params.get('debugRoute') === '1'
}

export function RouteDebugBadge() {
  const location = useLocation()
  const enabled = useMemo(() => isDebugEnabled(location.search), [location.search])
  const [copied, setCopied] = useState(false)

  if (!enabled) return null

  const path = `${location.pathname}${location.search}${location.hash}`

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(path)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          // ignore
        }
      }}
      className="fixed bottom-20 right-4 z-[999] rounded-md border border-zinc-800 bg-black/80 backdrop-blur px-3 py-2 text-xs font-mono text-zinc-300 shadow"
      aria-label="Route debug badge (click to copy)"
    >
      <div className="uppercase tracking-[0.2em] text-[10px] text-zinc-500">
        {copied ? 'Copied' : 'Route'}
      </div>
      <div className="mt-1">{path}</div>
    </button>
  )
}



import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

type Align = 'left' | 'right'
type Size = 'sm' | 'md'

export function InfoPopover({
  label = 'Info',
  title,
  children,
  align = 'left',
  size = 'md',
}: {
  label?: string
  title?: string
  children: ReactNode
  align?: Align
  size?: Size
}) {
  const popoverId = useId()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = wrapperRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setOpen(false)
    }
    if (!open) return
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (!open) return
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const panelAlign = align === 'right' ? 'right-0' : 'left-0'
  const buttonClass =
    size === 'sm'
      ? 'w-6 h-6'
      : 'w-7 h-7'
  const iconClass =
    size === 'sm'
      ? 'w-3.5 h-3.5'
      : 'w-4 h-4'
  const panelTop = size === 'sm' ? 'top-8' : 'top-9'
  const panelWidth = size === 'sm' ? 'w-[280px]' : 'w-[320px]'

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-center ${buttonClass} rounded-full border border-white/10 bg-transparent text-zinc-500 hover:text-white hover:border-white/20 transition-colors`}
      >
        <Info className={iconClass} />
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={title ?? label}
          className={`absolute ${panelTop} ${panelAlign} z-50 ${panelWidth} max-w-[80vw] rounded-xl border border-white/10 bg-black/90 backdrop-blur p-4 shadow-xl`}
        >
          {title ? <div className="text-white text-sm font-medium mb-2">{title}</div> : null}
          <div className="text-zinc-400 text-xs leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  )
}



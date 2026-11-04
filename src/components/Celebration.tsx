import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Confetti } from '@phosphor-icons/react'
import { haptic } from '../lib/motion'

type Celebrate = (title: string, message: string) => void
const CelebrationContext = createContext<Celebrate>(() => {})

export function useCelebrate() {
  return useContext(CelebrationContext)
}

const COLORS = ['#0F9D6B', '#FF6B4A', '#6E56F0', '#F2A516', '#0E9AA7', '#D6457A']

/** Confete em canvas (sem biblioteca), cai por ~2 segundos. */
function ConfettiCanvas({ run }: { run: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = innerWidth * dpr
    canvas.height = innerHeight * dpr
    ctx.scale(dpr, dpr)
    const pieces = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (const p of pieces) {
        p.vy += 0.32
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.r += p.vr
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - t / 2400)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)))
        ctx.restore()
      }
      if (t < 2400) frame = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, innerWidth, innerHeight)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run])
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] size-full" />
}

/** Comemoração (marcos 25/50/75/100% das caixinhas, conquistas): confete, vibração e um cartão no meio. */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(0)
  const [card, setCard] = useState<{ title: string; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const celebrate = useCallback<Celebrate>((title, message) => {
    clearTimeout(timer.current)
    setRun((r) => r + 1)
    setCard({ title, message })
    haptic([18, 40, 18])
    timer.current = setTimeout(() => setCard(null), 3600)
  }, [])

  return (
    <CelebrationContext.Provider value={celebrate}>
      {children}
      <ConfettiCanvas run={run} />
      {card && (
        <div role="status" className="fixed inset-x-0 top-1/3 z-[61] flex justify-center px-6" onClick={() => setCard(null)}>
          <div className="animate-pop w-full max-w-xs rounded-[1.5rem] bg-surface p-6 text-center shadow-[0_24px_60px_-12px_rgb(15_36_51/0.35)]">
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-coral-soft text-coral-strong">
              <Confetti size={30} weight="duotone" />
            </span>
            <p className="text-[1.25rem] leading-tight font-extrabold">{card.title}</p>
            <p className="mt-1.5 leading-snug text-muted">{card.message}</p>
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  )
}

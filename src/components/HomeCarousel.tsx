import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export type Slide = { id: string; to: string; kicker: string; title: string; text: string; icon: PhosphorIcon; from: string; to2: string }

/**
 * Carrossel da tela inicial: cartões que passam sozinhos a cada 5 segundos.
 * Dá para arrastar com o dedo; parar o dedo em cima pausa a troca.
 */
export function HomeCarousel({ slides }: { slides: Slide[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const paused = useRef(false)

  // Qual cartão está visível (pelo scroll)
  function onScroll() {
    const el = ref.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      const el = ref.current
      if (!el || paused.current || document.hidden) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, 5000)
    return () => clearInterval(t)
  }, [slides.length])

  if (!slides.length) return null
  return (
    <div className="-mx-4 py-5">
      <div
        ref={ref}
        onScroll={onScroll}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => setTimeout(() => (paused.current = false), 4000)}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-center px-4">
            <Link to={s.to} className="press relative flex min-h-[8.5rem] overflow-hidden rounded-[1.25rem] p-4 text-white" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to2})` }}>
              <span aria-hidden className="absolute -top-6 -right-6 size-28 rounded-full bg-white/10" />
              <div className="relative flex-1 pr-14">
                <p className="text-[0.8125rem] font-semibold tracking-wide uppercase opacity-80">{s.kicker}</p>
                <p className="mt-1 text-[1.125rem] leading-snug font-extrabold">{s.title}</p>
                <p className="mt-1 text-[0.9375rem] leading-snug opacity-90">{s.text}</p>
              </div>
              <s.icon size={40} weight="duotone" className="absolute right-4 bottom-4 opacity-90" aria-hidden />
            </Link>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-surface-2'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

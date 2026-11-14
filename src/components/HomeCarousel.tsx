import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Pig } from './Pig'

export type Slide = {
  id: string
  to: string
  kicker: string
  title: string
  text: string
  icon: PhosphorIcon
  from: string
  to2: string
  /** arte do mascote que acompanha o cartão (public/mascote/…) */
  art?: string
  /** texto do botão (padrão: "Ver") */
  cta?: string
  /** selo pequeno no canto (ex.: "Em breve") */
  badge?: string
}

/**
 * Carrossel da tela inicial: cartões que passam sozinhos a cada 6 segundos, com o mascote dando o recado.
 * Dá para arrastar com o dedo; tocar pausa a troca.
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
    }, 6000)
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
        {slides.map((s, i) => (
          <div key={s.id} className="w-full shrink-0 snap-center px-4">
            <Link
              to={s.to}
              aria-label={`${s.kicker}: ${s.title}`}
              className="press slide-card relative flex min-h-[10.25rem] overflow-hidden rounded-[1.5rem] text-white shadow-[0_14px_30px_-18px_rgb(15_36_51/0.7)]"
              style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to2})` }}
            >
              {/* Véu escuro atrás do texto: o texto branco fica legível com qualquer cor de fundo */}
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0/0.22),rgb(0_0_0/0.06)_65%,transparent)]" />
              {/* Fundo: brilho no canto, anel e uma faixa de luz bem leve */}
              <span aria-hidden className="absolute -top-16 -right-10 size-52 rounded-full bg-white/[0.13]" />
              <span aria-hidden className="absolute right-[-1.5rem] bottom-[-3.5rem] size-44 rounded-full border-[14px] border-white/[0.07]" />
              <span aria-hidden className="slide-sheen absolute inset-y-0 -left-1/3 w-1/3" />

              <div className="relative flex min-w-0 flex-1 flex-col p-4 pr-1">
                <p className="flex items-center gap-1.5 self-start rounded-full bg-white/[0.16] py-1 pr-2.5 pl-1.5 text-[0.75rem] font-bold tracking-wide uppercase">
                  <span className="grid size-5 place-items-center rounded-full bg-white/25">
                    <s.icon size={13} weight="fill" aria-hidden />
                  </span>
                  <span className="max-w-[11rem] truncate">{s.kicker}</span>
                </p>
                <p className="mt-2 line-clamp-2 text-[1.1875rem] leading-[1.2] font-extrabold tracking-tight">{s.title}</p>
                <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-white/85">{s.text}</p>
                <span className="mt-auto flex items-center gap-1.5 self-start rounded-full bg-white px-3 py-1.5 text-[0.8125rem] font-bold" style={{ color: s.to2 }}>
                  {s.cta ?? 'Ver'} <ArrowRight size={14} weight="bold" aria-hidden />
                </span>
              </div>

              <div className="relative mr-2.5 w-[6.5rem] shrink-0 self-end">
                <span aria-hidden className="absolute bottom-1 left-1/2 h-3 w-20 -translate-x-1/2 rounded-[50%] bg-black/25 blur-[6px]" />
                <Pig art={s.art ?? 'principal'} px={104} still={i !== index} className="-mb-1 block" />
              </div>
              {s.badge && <span className="absolute top-3 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide uppercase backdrop-blur-sm">{s.badge}</span>}
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

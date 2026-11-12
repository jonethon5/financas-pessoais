import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Faz o bloco "subir" suavemente quando aparece na tela ao rolar (como no Mobills).
 * O que já está visível ao abrir a tela também sobe, em sequência (`delay`).
 * Sem suporte ao IntersectionObserver ou com "reduzir movimento" ligado, aparece parado.
 */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'idle' | 'hidden' | 'in'>('idle')

  // Antes de pintar a tela (sem piscar o bloco antes de esconder)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setState('hidden')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('in')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`${state === 'hidden' ? 'reveal' : state === 'in' ? 'reveal reveal-in' : ''} ${className}`} style={state === 'in' ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}

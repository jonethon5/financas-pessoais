import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pig } from './Pig'

/**
 * Guia interativo do primeiro acesso: escurece a tela, destaca (piscando) o que está sendo explicado
 * e o porquinho explica num balão. Cada tela tem o seu guia; aparece uma vez só.
 * O alvo é marcado no HTML com data-tour="nome".
 */
export type TourStep = { target: string; title: string; text: string }

const KEY = 'poupei:guia:'

export function tourSeen(id: string): boolean {
  try {
    return localStorage.getItem(KEY + id) === '1'
  } catch {
    return true // sem armazenamento: não insiste
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(KEY + id, '1')
  } catch {
    /* tudo bem */
  }
}
/** "Ver o guia de novo" (Ajustes) e "começar do zero". */
export function resetTours() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY)) localStorage.removeItem(k)
  } catch {
    /* tudo bem */
  }
}

type Box = { top: number; left: number; width: number; height: number }

export function Tour({ id, steps, delay = 900 }: { id: string; steps: TourStep[]; delay?: number }) {
  const [index, setIndex] = useState<number | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [bubbleH, setBubbleH] = useState(180)

  const targetOf = useCallback((i: number) => document.querySelector<HTMLElement>(`[data-tour="${steps[i]?.target}"]`), [steps])

  // Começa depois que a tela terminou de aparecer (e só se nunca foi visto)
  useEffect(() => {
    if (tourSeen(id)) return
    let t: ReturnType<typeof setTimeout>
    let waited = false
    // Espera a comemoração (confete) fechar e dá um respiro antes de começar a explicar
    const tryStart = () => {
      if (document.querySelector('[data-celebrating]') || document.querySelector('dialog[open]')) {
        waited = true
        t = setTimeout(tryStart, 400)
        return
      }
      if (waited) {
        waited = false
        t = setTimeout(tryStart, 900)
        return
      }
      const first = steps.findIndex((_, i) => targetOf(i))
      if (first >= 0) setIndex(first)
    }
    t = setTimeout(tryStart, delay)
    return () => clearTimeout(t)
  }, [id, steps, delay, targetOf])

  // Mede o alvo (e acompanha rolagem e giro da tela)
  useEffect(() => {
    if (index == null) return
    const el = targetOf(index)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
    }
    const t = setTimeout(measure, 380)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [index, targetOf])

  useLayoutEffect(() => {
    if (bubble.current) setBubbleH(bubble.current.offsetHeight)
  }, [box, index])

  if (index == null || !box) return null
  const step = steps[index]
  const visible = steps.map((_, i) => i).filter((i) => targetOf(i))
  const pos = visible.indexOf(index)
  const last = pos === visible.length - 1

  const finish = () => {
    markSeen(id)
    setIndex(null)
    setBox(null)
  }
  const next = () => {
    if (last) return finish()
    setBox(null)
    setIndex(visible[pos + 1])
  }

  const vh = window.innerHeight
  const below = box.top + box.height + 16 + bubbleH < vh - 12
  const bubbleTop = below ? box.top + box.height + 16 : Math.max(12, box.top - 16 - bubbleH)
  // Seta do balão apontando para o meio do alvo
  const bw = Math.min(window.innerWidth - 32, 384)
  const bl = (window.innerWidth - bw) / 2
  const arrowX = Math.min(Math.max(box.left + box.width / 2 - bl - 8, 18), bw - 34)

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Escurece tudo menos o alvo, que pisca */}
      <div
        className="tour-spot pointer-events-none fixed rounded-[1.1rem] transition-all duration-300"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
      <button type="button" aria-label="Próximo" onClick={next} className="absolute inset-0 cursor-default" />

      {/* Balão do porquinho */}
      <div
        ref={bubble}
        className="animate-pop fixed left-1/2 w-[calc(100%-2rem)] max-w-[24rem] -translate-x-1/2"
        style={{ top: bubbleTop }}
      >
        <span
          aria-hidden
          className="absolute size-4 rotate-45 rounded-[3px] bg-primary"
          style={below ? { top: -7, left: arrowX } : { bottom: -7, left: arrowX }}
        />
        <div className="relative flex gap-3 rounded-[1.25rem] bg-primary p-4 text-on-primary shadow-[0_18px_40px_-14px_rgb(0_0_0/0.6)]">
          <Pig art="principal" px={64} still className="-mt-1 -ml-1" />
          <div className="min-w-0 flex-1">
            <p className="text-[1.0625rem] font-bold">{step.title}</p>
            <p className="mt-1 text-[0.9375rem] leading-snug opacity-90">{step.text}</p>
            <div className="mt-3 flex items-center justify-between text-[0.9375rem]">
              <button type="button" onClick={finish} className="font-semibold opacity-85">
                Pular
              </button>
              <span className="flex items-center gap-4">
                <span className="opacity-80">
                  {pos + 1}/{visible.length}
                </span>
                <button type="button" onClick={next} className="rounded-full bg-white/20 px-3.5 py-1.5 font-bold">
                  {last ? 'Concluir' : 'Próximo'}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Movimento: números que "contam" até o valor e vibração curta nas conquistas.
import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Anima de onde estava até o novo valor (centavos inteiros o tempo todo). */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(reduced() ? target : 0)
  const from = useRef(reduced() ? target : 0)
  useEffect(() => {
    if (reduced()) {
      setValue(target)
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(begin + (target - begin) * eased)
      setValue(v)
      from.current = v
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

/** Começa em 0 e vai para o valor no quadro seguinte (para barras "encherem" ao aparecer). */
export function useGrow(value: number): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return v
}

/** Vibração leve (Android; o iPhone ignora). */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* sem vibração */
  }
}

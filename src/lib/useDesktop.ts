import { useEffect, useState } from 'react'

/** Tela de computador (1024 px ou mais): menu na lateral em vez da barra de abas. Mesmo ponto do `lg:` do Tailwind. */
export const DESKTOP_QUERY = '(min-width: 64rem)'

export function useDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

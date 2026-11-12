import { useEffect, useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { mascotSrc, type PigColor } from './Pig'

const KEY = 'poupei:abertura'

/** A cor do mascote fica guardada no aparelho para a abertura já sair certa (antes de carregar o perfil). */
function storedColor(): PigColor {
  try {
    return localStorage.getItem('poupei:cor') === 'rosa' ? 'rosa' : 'azul'
  } catch {
    return 'azul'
  }
}

/**
 * Abertura do app: o porquinho cai e quica, moedas saltam em volta e o nome sobe letra por letra.
 * Aparece uma vez a cada vez que o app é aberto (sessão); um toque pula.
 */
export function Splash() {
  const [phase, setPhase] = useState<'on' | 'leaving' | 'off'>(() => {
    try {
      return sessionStorage.getItem(KEY) ? 'off' : 'on'
    } catch {
      return 'on'
    }
  })
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (phase !== 'on') return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* tudo bem */
    }
    const leave = setTimeout(() => setPhase('leaving'), reduced ? 600 : 2100)
    return () => clearTimeout(leave)
  }, [phase, reduced])

  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('off'), 450)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'off') return null
  const color = storedColor()
  return (
    <div
      role="presentation"
      onClick={() => setPhase('leaving')}
      className={`splash fixed inset-0 z-[100] grid place-items-center overflow-hidden ${phase === 'leaving' ? 'splash-out' : ''}`}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative size-44">
          {/* moedas que saltam em volta */}
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} aria-hidden className="splash-coin" style={{ '--i': i } as React.CSSProperties}>
              $
            </span>
          ))}
          <span aria-hidden className="splash-ring" />
          <img src={mascotSrc(color, 'principal')} alt="" className="splash-pig absolute inset-0 size-full object-contain" draggable={false} />
        </div>
        <p className="splash-word mt-5 flex text-[2.75rem] font-extrabold tracking-[-0.03em] text-white" aria-label={APP_NAME}>
          {[...APP_NAME].map((ch, i) => (
            <span key={i} aria-hidden style={{ '--i': i } as React.CSSProperties}>
              {ch}
            </span>
          ))}
        </p>
        <p className="splash-tag mt-1 max-w-[16rem] text-center text-[0.9375rem] leading-snug text-white/80">{APP_TAGLINE}</p>
      </div>
    </div>
  )
}

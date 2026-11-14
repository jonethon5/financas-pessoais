import { useEffect, useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { mascotSrc, type PigColor } from './Pig'

const KEY = 'poupei:abertura'

/** Os três momentos da cena (artes alinhadas pela moeda da cabeça: public/mascote/{cor}/abertura-*.webp). */
const POSES = ['pensa', 'uau', 'feliz'] as const

/** Quanto a cena dura até começar a sair (ms). */
const SCENE_MS = 3000

/** A cor do mascote fica guardada no aparelho para a abertura já sair certa (antes de carregar o perfil). */
function storedColor(): PigColor {
  try {
    return localStorage.getItem('poupei:cor') === 'rosa' ? 'rosa' : 'azul'
  } catch {
    return 'azul'
  }
}

/**
 * Abertura do app, uma cena curta: o porquinho aparece pensando, uma moeda cai no cofrinho da cabeça,
 * ele vibra (olhos de estrela, moedas saltando), pula de alegria e o nome sobe letra por letra.
 * Aparece uma vez a cada vez que o app é aberto (sessão); um toque pula.
 * A cena só começa quando as artes já carregaram (no máximo 0,7 s de espera), para não piscar no meio.
 */
export function Splash() {
  const [phase, setPhase] = useState<'on' | 'leaving' | 'off'>(() => {
    try {
      return sessionStorage.getItem(KEY) ? 'off' : 'on'
    } catch {
      return 'on'
    }
  })
  const [ready, setReady] = useState(false)
  const [color] = useState(storedColor)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // guarda que a abertura já passou nesta sessão e espera as artes
  useEffect(() => {
    if (phase !== 'on') return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* tudo bem */
    }
    let alive = true
    const go = () => alive && setReady(true)
    const cap = setTimeout(go, 700)
    Promise.all(
      POSES.map((p) => {
        const img = new Image()
        img.src = mascotSrc(color, `abertura-${p}`)
        return img.decode().catch(() => undefined)
      }),
    ).then(go)
    return () => {
      alive = false
      clearTimeout(cap)
    }
    // só na primeira montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'on' || !ready) return
    const leave = setTimeout(() => setPhase('leaving'), reduced ? 700 : SCENE_MS)
    return () => clearTimeout(leave)
  }, [phase, ready, reduced])

  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('off'), 450)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'off') return null
  return (
    <div
      role="presentation"
      onClick={() => setPhase('leaving')}
      className={`splash fixed inset-0 z-[100] grid place-items-center overflow-hidden ${phase === 'leaving' ? 'splash-out' : ''}`}
    >
      <div className={`splash-scene relative flex flex-col items-center ${ready ? 'is-go' : ''}`}>
        <div className="splash-stage relative">
          {/* brilho e moedas que saltam do cofrinho quando a moeda entra */}
          <span aria-hidden className="splash-flash" />
          <span aria-hidden className="splash-ring" />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} aria-hidden className="splash-coin" style={{ '--i': i } as React.CSSProperties}>
              $
            </span>
          ))}
          {/* o porquinho: cada camada cuida de um movimento (entrar, balançar pensando, amassar com a moeda, pular) */}
          <div className="sp-enter absolute inset-0">
            <div className="sp-sway absolute inset-0">
              <div className="sp-bump absolute inset-0">
                <div className="sp-hop absolute inset-0">
                  {POSES.map((p) => (
                    <img
                      key={p}
                      src={mascotSrc(color, `abertura-${p}`)}
                      alt=""
                      draggable={false}
                      className={`sp-pose sp-${p} absolute inset-0 size-full object-contain`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* a moeda que cai girando e entra no cofrinho */}
          <span aria-hidden className="sp-drop">
            <span className="sp-drop-spin">$</span>
          </span>
        </div>
        <p className="splash-word mt-4 flex text-[2.75rem] font-extrabold tracking-[-0.03em] text-white" aria-label={APP_NAME}>
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

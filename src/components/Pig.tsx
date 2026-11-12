import { useEffect } from 'react'
import { useProfile } from '../data/hooks'
import type { AiTone } from '../types'
import type { PigMood, PigSize } from '../lib/pig'
import { MASCOT_NAME } from '../brand'

/** Porquinho (azul) ou porquinha (rosa): a pessoa escolhe no primeiro acesso. */
export type PigColor = 'azul' | 'rosa'

/** Nome do mascote conforme a escolha: Poupinho / Poupinha. */
export function mascotName(color: PigColor | undefined | null): string {
  return color === 'rosa' ? MASCOT_NAME.replace(/o$/, 'a') : MASCOT_NAME
}

/** Cor escolhida (padrão: azul). */
export function usePigColor(): PigColor {
  const profile = useProfile()
  const color = profile.data?.prefs.pig?.color ?? 'azul'
  useEffect(() => {
    if (!profile.data) return
    try {
      localStorage.setItem('poupei:cor', color)
    } catch {
      /* tudo bem */
    }
  }, [color, profile.data])
  return color
}

/** Endereço de uma arte do mascote (public/mascote/{cor}/{nome}.webp). */
export function mascotSrc(color: PigColor, name: string): string {
  return `${import.meta.env.BASE_URL}mascote/${color}/${name}.webp`
}

/** Qual arte usar para o humor e o modo (roupa da loja tem prioridade). */
export function pigArt(mood: PigMood, tone: AiTone, wear?: string | null): string {
  if (wear) return `loja-${wear}`
  if (mood === 'festa') return 'rosto-animado'
  if (mood === 'triste') return tone === 'agressivo' ? 'rosto-bravo' : 'rosto-triste'
  if (mood === 'feliz') return 'rosto-feliz'
  return tone === 'suave' ? 'modo-suave' : tone === 'agressivo' ? 'modo-rigido' : 'modo-moderado'
}

// Barriga: mais magrinho ou mais gordinho conforme a meta que a própria pessoa escolheu
const SHAPE: Record<PigSize, string> = { magro: 'scale(0.9, 1)', normal: 'scale(1, 1)', gordo: 'scale(1.1, 0.98)' }

/**
 * O mascote em si. Use `art` para uma arte específica (ex.: 'tela-alerta', 'meta-atingida');
 * senão a arte sai do humor, do modo e da roupa.
 */
export function Pig({
  size = 'normal',
  mood = 'normal',
  tone = 'equilibrado',
  wear,
  color,
  art,
  className = '',
  px = 160,
  still = false,
}: {
  size?: PigSize
  mood?: PigMood
  tone?: AiTone
  wear?: string | null
  color?: PigColor
  art?: string
  className?: string
  px?: number
  still?: boolean
}) {
  const chosen = usePigColor()
  const c = color ?? chosen
  const name = art ?? pigArt(mood, tone, wear)
  return (
    <span className={`relative inline-block shrink-0 ${still ? '' : 'pig-bob'} ${className}`} style={{ width: px, height: px }}>
      <img
        src={mascotSrc(c, name)}
        alt={`${mascotName(c)}${mood === 'triste' ? ' tristinho' : mood === 'festa' ? ' comemorando' : ''}`}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain object-bottom transition-transform duration-500 select-none"
        style={{ transform: SHAPE[size], transformOrigin: '50% 100%' }}
      />
    </span>
  )
}

/** Ilustração para tela vazia, aviso ou comemoração. */
export function MascotArt({ name, px = 150, className = '' }: { name: string; px?: number; className?: string }) {
  const c = usePigColor()
  return <img src={mascotSrc(c, name)} alt="" aria-hidden draggable={false} className={`mx-auto object-contain select-none ${className}`} style={{ width: px, height: px }} />
}

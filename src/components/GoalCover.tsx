import {
  Airplane, Baby, Bicycle, Car, Couch, Diamond, DeviceMobile, Gift, GraduationCap, Heart, House, Laptop, Lifebuoy, Monitor, MusicNotes,
  PawPrint, PiggyBank, ShoppingBag, TreePalm, Wrench, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { useFileUrl } from '../data/hooks'
import type { Goal } from '../types'

const GOAL_ICONS: Record<string, PhosphorIcon> = {
  piggy: PiggyBank, lifebuoy: Lifebuoy, airplane: Airplane, bag: ShoppingBag, gift: Gift, graduation: GraduationCap, car: Car,
  house: House, monitor: Monitor, laptop: Laptop, phone: DeviceMobile, sofa: Couch, heart: Heart, ring: Diamond, baby: Baby,
  paw: PawPrint, beach: TreePalm, music: MusicNotes, bike: Bicycle, tools: Wrench,
}
export const GOAL_ICON_KEYS = Object.keys(GOAL_ICONS)
export const GOAL_COLORS = ['#0B7F5A', '#0F9D6B', '#0E9AA7', '#2F6F8F', '#3E7CB1', '#0F2433', '#6E56F0', '#9C6ADE', '#D6457A', '#FF6B4A', '#C2410C', '#F2A516']

export function goalIcon(key: string | null | undefined): PhosphorIcon {
  return GOAL_ICONS[key ?? ''] ?? PiggyBank
}

/** Escurece uma cor #RRGGBB (para o degradê da capa). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Capa da caixinha: a foto escolhida pela pessoa ou um degradê na cor da caixinha
 * com formas suaves e o ícone grande (sem emoji).
 */
export function GoalCover({ goal, className = '', iconSize = 44, children }: { goal: Pick<Goal, 'icon' | 'color' | 'photo_path'>; className?: string; iconSize?: number; children?: React.ReactNode }) {
  const photo = useFileUrl('fotos', goal.photo_path)
  const Icon = goalIcon(goal.icon)
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${goal.color} 0%, ${shade(goal.color, 0.35)} 100%)` }}>
      {photo.data ? (
        <>
          <img src={photo.data} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </>
      ) : (
        <>
          <span aria-hidden className="absolute -top-8 -right-6 size-32 rounded-full bg-white/10" />
          <span aria-hidden className="absolute -bottom-10 left-6 size-24 rounded-full bg-white/[0.07]" />
          <span aria-hidden className="absolute top-1/2 right-5 -translate-y-1/2 text-white/95 drop-shadow-[0_6px_14px_rgb(0_0_0/0.18)]">
            <Icon size={iconSize} weight="duotone" />
          </span>
        </>
      )}
      {children && <div className="relative">{children}</div>}
    </div>
  )
}

/** Ícone pequeno da caixinha (listas). */
export function GoalBadgeIcon({ goal, size = 40 }: { goal: Pick<Goal, 'icon' | 'color'>; size?: number }) {
  const Icon = goalIcon(goal.icon)
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-[0.8rem] text-white" style={{ width: size, height: size, background: `linear-gradient(135deg, ${goal.color}, ${shade(goal.color, 0.3)})` }}>
      <Icon size={size * 0.55} weight="duotone" />
    </span>
  )
}

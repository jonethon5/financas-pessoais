import {
  Airplane, Baby, Barbell, BookOpen, Briefcase, Bus, Car, Coffee, DeviceMobile, Drop, ForkKnife, GameController, GasPump, Gift,
  GraduationCap, Hammer, Heartbeat, House, Lightning, Money, MusicNotes, Package, PawPrint, Pill, Receipt, Scissors, ShoppingCart,
  TShirt, Television, Ticket, Wallet, WifiHigh, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { liftForDark, useIsDark } from '../lib/theme'
import type { Category } from '../types'
import { IconTile } from './ui'

// Nomes guardados no banco → ícones (Phosphor, estilo duotone)
const ICONS: Record<string, PhosphorIcon> = {
  house: House, 'shopping-cart': ShoppingCart, bus: Bus, car: Car, fuel: GasPump, 'graduation-cap': GraduationCap, 'heart-pulse': Heartbeat,
  pill: Pill, smartphone: DeviceMobile, wifi: WifiHigh, zap: Lightning, droplet: Drop, tv: Television, music: MusicNotes, utensils: ForkKnife,
  coffee: Coffee, ticket: Ticket, 'gamepad-2': GameController, shirt: TShirt, package: Package, scissors: Scissors, 'book-open': BookOpen,
  dumbbell: Barbell, gift: Gift, 'paw-print': PawPrint, baby: Baby, plane: Airplane, hammer: Hammer, briefcase: Briefcase, receipt: Receipt,
  wallet: Wallet, banknote: Money,
}

export function iconFor(name: string | null | undefined): PhosphorIcon {
  return ICONS[name ?? ''] ?? Receipt
}

/** Ícone duotone (linha + preenchimento suave) na cor da categoria. */
export function DuoIcon({ name, color, size = 24 }: { name: string | null | undefined; color: string; size?: number }) {
  const Icon = iconFor(name)
  const dark = useIsDark()
  return <Icon size={size} weight="duotone" color={liftForDark(color, dark)} aria-hidden />
}

/**
 * Ícone da categoria: duotone na cor da categoria (a mesma da fatia no gráfico),
 * sobre um quadradinho com um véu bem leve da mesma cor. Sem emoji.
 */
export function CategoryIcon({ category, size = 'md' }: { category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const dark = useIsDark()
  const color = liftForDark(category?.color ?? '#5B6B7A', dark)
  const px = { sm: 19, md: 22, lg: 30 }[size]
  return (
    <IconTile size={size} className="relative !bg-transparent">
      <span className="absolute inset-0 rounded-[inherit]" style={{ background: `linear-gradient(145deg, ${color}1F, ${color}0D)` }} />
      <span className="relative">
        <DuoIcon name={category?.icon} color={color} size={px} />
      </span>
    </IconTile>
  )
}

import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Car, Coffee, Droplet, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, Hammer, HeartPulse, House,
  Music, Package, PawPrint, Pill, Plane, Receipt, Scissors, Shirt, ShoppingCart, Smartphone, Ticket, Tv, Utensils, Wallet, Wifi, Zap, type LucideIcon,
} from 'lucide-react'
import type { Category } from '../types'
import { IconTile } from './ui'

const ICONS: Record<string, LucideIcon> = {
  house: House, 'shopping-cart': ShoppingCart, bus: Bus, car: Car, fuel: Fuel, 'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse,
  pill: Pill, smartphone: Smartphone, wifi: Wifi, zap: Zap, droplet: Droplet, tv: Tv, music: Music, utensils: Utensils, coffee: Coffee,
  ticket: Ticket, 'gamepad-2': Gamepad2, shirt: Shirt, package: Package, scissors: Scissors, 'book-open': BookOpen, dumbbell: Dumbbell,
  gift: Gift, 'paw-print': PawPrint, baby: Baby, plane: Plane, hammer: Hammer, briefcase: Briefcase, receipt: Receipt, wallet: Wallet,
  banknote: Banknote,
}

export function iconFor(name: string | null | undefined): LucideIcon {
  return ICONS[name ?? ''] ?? Receipt
}

/**
 * Ícone da categoria: desenho de linha na cor da categoria (a mesma da fatia no gráfico),
 * sobre um quadradinho cinza-claro. Sem emoji e sem fundo colorido.
 */
export function CategoryIcon({ category, size = 'md' }: { category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = iconFor(category?.icon)
  return (
    <IconTile size={size}>
      <Icon strokeWidth={1.9} style={{ color: category?.color ?? '#5B6B7A' }} />
    </IconTile>
  )
}

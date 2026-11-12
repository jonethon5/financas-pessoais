import {
  Airplane, Baby, Backpack, Bank, Barbell, Bed, BeerStein, Bicycle, BookOpen, Books, Briefcase, Broom, Bus, Cake, Calculator, Camera, Car, Cat,
  Church, Cigarette, Coffee, Coins, Confetti, CookingPot, Couch, CreditCard, DeviceMobile, Dog, Dress, Drop, Eyeglasses, FilmSlate, Fire,
  FirstAidKit, ForkKnife, GameController, GasPump, Gift, GraduationCap, Guitar, Hamburger, Hammer, HandCoins, HandHeart, Handshake, Headphones,
  Heart, Heartbeat, House, Key, Laptop, Lightbulb, Lightning, Money, Motorcycle, Mountains, MusicNotes, Package, PawPrint, Percent, PersonSimpleRun,
  PiggyBank, Pill, Pizza, Plant, Popcorn, Receipt, Scales, Scissors, ShoppingBag, ShoppingCart, Sneaker, SoccerBall, Sparkle, SteeringWheel,
  Stethoscope, Storefront, Sun, TShirt, Tag, Taxi, Television, Tent, Ticket, Tooth, Train, TrendUp, Umbrella, UsersThree, Wallet, WashingMachine,
  Watch, WifiHigh, Wine, Wrench, type Icon as PhosphorIcon,
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
  // mais opções (para as categorias que a pessoa cria)
  pizza: Pizza, beer: BeerStein, wine: Wine, burger: Hamburger, cooking: CookingPot, popcorn: Popcorn, cake: Cake, 'first-aid': FirstAidKit,
  tooth: Tooth, stethoscope: Stethoscope, glasses: Eyeglasses, run: PersonSimpleRun, bike: Bicycle, train: Train, taxi: Taxi, motorcycle: Motorcycle,
  steering: SteeringWheel, wrench: Wrench, key: Key, lightbulb: Lightbulb, fire: Fire, broom: Broom, couch: Couch, bed: Bed, washing: WashingMachine,
  plant: Plant, dog: Dog, cat: Cat, users: UsersThree, heart: Heart, backpack: Backpack, books: Books, 'shopping-bag': ShoppingBag,
  store: Storefront, dress: Dress, sneaker: Sneaker, watch: Watch, laptop: Laptop, headphones: Headphones, camera: Camera, film: FilmSlate,
  guitar: Guitar, soccer: SoccerBall, tent: Tent, mountains: Mountains, sun: Sun, confetti: Confetti, church: Church, 'hand-heart': HandHeart,
  'piggy-bank': PiggyBank, 'credit-card': CreditCard, bank: Bank, 'trend-up': TrendUp, coins: Coins, 'hand-coins': HandCoins, umbrella: Umbrella,
  scales: Scales, percent: Percent, calculator: Calculator, handshake: Handshake, tag: Tag, sparkle: Sparkle, cigarette: Cigarette,
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

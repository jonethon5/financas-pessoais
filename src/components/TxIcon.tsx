import { useState, type ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { merchantLogo, merchantOf } from '../lib/merchants'
import type { Category } from '../types'
import { CategoryIcon } from './CategoryIcon'

/**
 * Ícone do lançamento: o logo da empresa quando o app reconhece (Uber, iFood, Renner…),
 * senão o ícone da categoria. Sem internet, ou se o logo não carregar, volta para a categoria.
 */
export function TxIcon({
  description,
  category,
  size = 'sm',
  flow,
}: {
  description: string
  category: Pick<Category, 'icon' | 'color'> | null | undefined
  size?: 'sm' | 'md'
  /** Pix/transferência: setinha no canto, como no app do banco (↗ enviado, ↙ recebido) */
  flow?: 'saida' | 'entrada' | null
}) {
  const merchant = merchantOf(description)
  const [failed, setFailed] = useState(false)
  const box = size === 'sm' ? 'size-8 rounded-[0.6rem]' : 'size-10 rounded-[0.75rem]'
  const icon: ReactNode =
    !merchant || failed ? (
      <CategoryIcon category={category} size={size} />
    ) : (
      <span className={`grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-line ${box}`} title={merchant.name}>
        <img src={merchantLogo(merchant)} alt={merchant.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-[70%] object-contain" />
      </span>
    )
  if (!flow) return icon
  const Arrow = flow === 'saida' ? ArrowUpRight : ArrowDownLeft
  return (
    <span className="relative inline-grid shrink-0">
      {icon}
      <span
        aria-hidden
        className={`absolute -right-1 -bottom-1 grid size-[1.05rem] place-items-center rounded-full ring-2 ring-surface ${flow === 'saida' ? 'bg-ink text-on-ink' : 'bg-grow text-white'}`}
      >
        <Arrow className="size-[0.7rem]" strokeWidth={3} />
      </span>
    </span>
  )
}

import { useState } from 'react'
import { merchantLogo, merchantOf } from '../lib/merchants'
import type { Category } from '../types'
import { CategoryIcon } from './CategoryIcon'

/**
 * Ícone do lançamento: o logo da empresa quando o app reconhece (Uber, iFood, Renner…),
 * senão o ícone da categoria. Sem internet, ou se o logo não carregar, volta para a categoria.
 */
export function TxIcon({ description, category, size = 'sm' }: { description: string; category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' }) {
  const merchant = merchantOf(description)
  const [failed, setFailed] = useState(false)
  if (!merchant || failed) return <CategoryIcon category={category} size={size} />
  const box = size === 'sm' ? 'size-8 rounded-[0.6rem]' : 'size-10 rounded-[0.75rem]'
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-line ${box}`} title={merchant.name}>
      <img src={merchantLogo(merchant)} alt={merchant.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-[70%] object-contain" />
    </span>
  )
}

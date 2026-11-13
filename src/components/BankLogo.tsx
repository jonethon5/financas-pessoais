import { useState } from 'react'
import { Bank, CreditCard } from '@phosphor-icons/react'
import type { Institution } from '../lib/institutions'

const SIZES = { xs: 'size-4 rounded-[0.25rem]', sm: 'size-9 rounded-[0.625rem]', md: 'size-11 rounded-[0.75rem]' }

/**
 * Logo do banco num quadradinho arredondado. Sem internet (ou banco desconhecido),
 * mostra a inicial na cor do banco ou o ícone genérico.
 */
export function BankLogo({ inst, credit, size = 'md' }: { inst: Institution | null; credit?: boolean; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false)
  const box = `grid shrink-0 place-items-center overflow-hidden ${SIZES[size]}`
  if (inst && inst.logo && !failed) {
    return (
      <span className={`${box} bg-white ring-1 ring-line`}>
        <img src={inst.logo} alt={inst.name} className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    )
  }
  if (inst) {
    return (
      <span className={`${box} ${size === 'xs' ? 'text-[0.5rem]' : 'text-[1rem]'} font-extrabold text-white`} style={{ background: inst.color }} aria-label={inst.name}>
        {inst.name.slice(0, 2)}
      </span>
    )
  }
  return <span className={`${box} bg-surface-2 text-muted`}>{credit ? <CreditCard size={size === 'xs' ? 11 : 22} weight="duotone" /> : <Bank size={size === 'xs' ? 11 : 22} weight="duotone" />}</span>
}

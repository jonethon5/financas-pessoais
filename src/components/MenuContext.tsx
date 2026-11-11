import { createContext, useContext } from 'react'
import { List as MenuIcon } from '@phosphor-icons/react'

/** Abre o menu ☰ de qualquer tela (o Layout fornece; telas de formulário não têm). */
export const MenuContext = createContext<(() => void) | null>(null)

export function useOpenMenu() {
  return useContext(MenuContext)
}

/** Botão ☰ do canto superior direito: fica no mesmo lugar em todas as telas. */
export function MenuButton({ className = 'text-primary active:bg-surface-2' }: { className?: string }) {
  const open = useOpenMenu()
  if (!open) return null
  return (
    <button type="button" onClick={open} aria-label="Menu" className={`grid size-10 shrink-0 place-items-center rounded-full ${className}`}>
      <MenuIcon size={26} />
    </button>
  )
}

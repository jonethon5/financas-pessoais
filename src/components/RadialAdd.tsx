import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowCircleDown, CalendarCheck, PiggyBank, Receipt, Stack, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Plus } from 'lucide-react'

type Item = { label: string; to: string; icon: PhosphorIcon; color: string }

// Em arco, da esquerda para a direita
const ITEMS: Item[] = [
  { label: 'Renda', to: '/lancar?tipo=renda', icon: ArrowCircleDown, color: '#0F9D6B' },
  { label: 'Gasto fixo', to: '/lancar?tipo=fixo', icon: CalendarCheck, color: '#6E56F0' },
  { label: 'Gasto', to: '/lancar?tipo=dia', icon: Receipt, color: '#E5484D' },
  { label: 'Parcelado', to: '/lancar?tipo=parcelado', icon: Stack, color: '#C2410C' },
  { label: 'Guardar', to: '/caixinhas', icon: PiggyBank, color: '#2F6FEB' },
]
const RADIUS = 122
const ANGLES = [168, 129, 90, 51, 12] // graus (90 = bem em cima do "+")

/**
 * Menu do "+": escurece a tela e abre as opções em arco acima do botão (que vira um X).
 * No computador (`anchor`: o botão Lançar do menu lateral) vira uma lista logo abaixo do botão.
 */
export function RadialAdd({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor?: RefObject<HTMLElement | null> | null }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [shown, setShown] = useState(false)

  // Monta e depois anima (abre do centro para fora)
  useEffect(() => {
    if (!open) return setShown(false)
    const t = requestAnimationFrame(() => setShown(true))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      cancelAnimationFrame(t)
      window.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  if (!open) return null

  const go = (to: string) => {
    onClose()
    // Na tela Mês olhando um mês que vem (planejando): o gasto fixo já nasce nesse mês
    const viewing = pathname === '/mes' ? new URLSearchParams(search).get('mes') : null
    navigate(to === '/lancar?tipo=fixo' && viewing ? `${to}&mes=${viewing}` : to)
  }

  if (anchor) return <AddMenu anchor={anchor} shown={shown} onClose={onClose} go={go} />

  return (
    <div role="dialog" aria-modal="true" aria-label="Lançar" className="fixed inset-0 z-40">
      <button type="button" aria-label="Fechar" onClick={onClose} className={`absolute inset-0 bg-[#0B1622]/60 backdrop-blur-[3px] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`} />

      <div className="pointer-events-none absolute bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2">
        {/* Mesmo lugar do "+" da barra de abas */}
        <div className="px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-5 border border-transparent px-1 py-1">
          <div className="col-start-3 flex h-[3.25rem] items-center justify-center">
            <div className="relative size-12">
              {ITEMS.map((it, i) => {
                const a = (ANGLES[i] * Math.PI) / 180
                const x = Math.cos(a) * RADIUS
                const y = -Math.sin(a) * RADIUS
                return (
                  <button
                    key={it.label}
                    type="button"
                    onClick={() => go(it.to)}
                    className="pointer-events-auto absolute top-1/2 left-1/2 flex w-[4.5rem] flex-col items-center gap-1.5"
                    style={{
                      transform: shown ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` : 'translate(-50%, -50%) scale(0.4)',
                      opacity: shown ? 1 : 0,
                      transition: `transform 320ms cubic-bezier(0.23, 1, 0.32, 1) ${i * 30}ms, opacity 180ms ease-out ${i * 30}ms`,
                    }}
                  >
                    <span className="grid size-[3.25rem] place-items-center rounded-full bg-white shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]" style={{ color: it.color }}>
                      <it.icon size={26} weight="duotone" />
                    </span>
                    <span className="text-[0.8125rem] leading-tight font-semibold text-white drop-shadow">{it.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="pointer-events-auto relative grid size-12 place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_-6px_rgb(47_111_235/0.55)]"
              >
                <Plus className={`size-7 transition-transform duration-300 ${shown ? 'rotate-45' : ''}`} strokeWidth={2.4} aria-hidden />
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Lista do botão Lançar no computador: abre logo abaixo do botão, navegável pelo teclado (setas, Esc). */
function AddMenu({ anchor, shown, onClose, go }: { anchor: RefObject<HTMLElement | null>; shown: boolean; onClose: () => void; go: (to: string) => void }) {
  const list = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    // Abre alinhado ao botão; perto da borda direita da tela, alinha pela direita do botão
    const width = Math.max(r.width, 240)
    setPos({ top: r.bottom + 10, left: r.left + width > window.innerWidth - 16 ? r.right - width : r.left, width })
  }, [anchor])
  useEffect(() => {
    if (pos) list.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [pos])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div className="fixed inset-0 z-40" onMouseDown={onClose}>
      <div
        ref={list}
        role="menu"
        aria-label="Lançar"
        onKeyDown={onKey}
        onMouseDown={(e) => e.stopPropagation()}
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden' }}
        className={`absolute origin-top rounded-[1rem] border border-line bg-bg p-1.5 shadow-[0_18px_40px_-16px_rgb(15_36_51/0.35)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${shown ? 'scale-100 opacity-100' : 'scale-[0.97] -translate-y-1 opacity-0'}`}
      >
        {ITEMS.map((it) => (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            onClick={() => go(it.to)}
            className="flex h-11 w-full items-center gap-3 rounded-[0.7rem] px-2.5 text-left text-[0.9375rem] font-semibold outline-none hover:bg-surface focus-visible:bg-surface"
          >
            <span className="grid size-8 place-items-center rounded-full bg-surface" style={{ color: it.color }}>
              <it.icon size={20} weight="duotone" />
            </span>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

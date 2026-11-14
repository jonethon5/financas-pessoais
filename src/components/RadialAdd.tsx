import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
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
 */
export function RadialAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
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
    navigate(to)
  }

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

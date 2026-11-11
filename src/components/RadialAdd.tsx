import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowCircleDown, CalendarCheck, PiggyBank, Receipt, Stack, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Plus } from 'lucide-react'
import { useBackend } from '../data/backend'
import { insertTxWithRules, useHistory, useWrite } from '../data/finance'
import { quickPicks } from '../lib/budget'
import { todayISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import { useToast } from './Toast'

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
 * Em cima, os gastos mais comuns para lançar de novo com um toque.
 */
export function RadialAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const backend = useBackend()
  const write = useWrite()
  const history = useHistory(3)
  const picks = quickPicks(history.data ?? []).slice(0, 4)
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

  async function launch(p: (typeof picks)[number]) {
    onClose()
    const id = crypto.randomUUID()
    try {
      await write.mutateAsync((b) =>
        insertTxWithRules(b, { id, kind: 'expense', type: 'dia', amount_cents: p.amountCents, date: todayISO(), description: p.description, category_id: p.categoryId, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null }),
      )
      toast(`${p.description} · ${formatBRL(p.amountCents)}`, { label: 'Desfazer', run: () => write.mutate(() => backend.remove('transactions', [id])) })
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Lançar" className="fixed inset-0 z-40">
      <button type="button" aria-label="Fechar" onClick={onClose} className={`absolute inset-0 bg-[#0B1622]/60 backdrop-blur-[3px] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`} />

      <div className="pointer-events-none absolute bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2">
        {/* Lançar de novo com um toque */}
        {picks.length > 0 && (
          <div className={`pointer-events-auto mx-4 mb-[13.5rem] transition-all duration-300 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
            <p className="mb-2 text-center text-[0.8125rem] font-semibold text-white/80">Lançar de novo</p>
            <div className="flex flex-wrap justify-center gap-2">
              {picks.map((p) => (
                <button key={p.description} type="button" onClick={() => void launch(p)} className="press rounded-full bg-white/95 px-3.5 py-2 text-[0.875rem] font-semibold text-[#0F2433] shadow-lg">
                  {p.description} · {formatBRL(p.amountCents)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mesmo lugar do "+" da barra de abas */}
        <div className="pb-safe grid grid-cols-5 px-1">
          <div className="col-start-3 flex h-[3.25rem] justify-center">
            <div className="relative -mt-6 size-[3.5rem]">
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
                      transition: `transform 420ms cubic-bezier(.32,1.25,.5,1) ${i * 35}ms, opacity 200ms ease ${i * 35}ms`,
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
                className="pointer-events-auto relative grid size-[3.5rem] place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_-6px_rgb(47_111_235/0.55)]"
              >
                <Plus className={`size-7 transition-transform duration-300 ${shown ? 'rotate-45' : ''}`} strokeWidth={2.4} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

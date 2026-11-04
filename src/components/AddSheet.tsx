import { useNavigate } from 'react-router'
import { CalendarClock, Layers, ShoppingBag, TrendingUp, type LucideIcon } from 'lucide-react'
import { useBackend } from '../data/backend'
import { useCategories, useHistory, useWrite } from '../data/finance'
import { quickPicks } from '../lib/budget'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import { todayISO } from '../lib/dates'
import { CategoryIcon } from './CategoryIcon'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { List, Row } from './ui'

const OPTIONS: { tipo: string; label: string; hint: string; icon: LucideIcon; primary?: boolean }[] = [
  { tipo: 'dia', label: 'Gasto', hint: 'do dia a dia', icon: ShoppingBag, primary: true },
  { tipo: 'renda', label: 'Renda', hint: 'extra, freela, 13º', icon: TrendingUp },
  { tipo: 'fixo', label: 'Gasto fixo', hint: 'repete todo mês', icon: CalendarClock },
  { tipo: 'parcelado', label: 'Parcelado', hint: 'em vezes', icon: Layers },
]

/**
 * Menu do "+": o jeito mais curto de lançar.
 * Os gastos mais comuns aparecem com o último valor: um toque e está lançado (com "Desfazer").
 */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const backend = useBackend()
  const write = useWrite()
  const history = useHistory(3)
  const categories = useCategories()
  const picks = quickPicks(history.data ?? [])

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  async function launch(p: (typeof picks)[number]) {
    onClose()
    const id = crypto.randomUUID()
    try {
      await write.mutateAsync((b) =>
        b.insert('transactions', [
          { id, kind: 'expense', type: 'dia', amount_cents: p.amountCents, date: todayISO(), description: p.description, category_id: p.categoryId, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null },
        ]),
      )
      toast(`${p.description} · ${formatBRL(p.amountCents)}`, { label: 'Desfazer', run: () => write.mutate(() => backend.remove('transactions', [id])) })
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Lançar">
      <div className="grid grid-cols-2 gap-2.5">
        {OPTIONS.map(({ tipo, label, hint, icon: Icon, primary }) => (
          <button
            key={tipo}
            type="button"
            onClick={() => go(`/lancar?tipo=${tipo}`)}
            className={`shadow-soft flex flex-col items-start gap-4 rounded-[1.25rem] p-3.5 text-left transition active:scale-[0.98] ${primary ? 'bg-primary text-on-primary' : 'bg-surface'}`}
          >
            <Icon className={`size-6 ${primary ? '' : 'text-ink/80'}`} strokeWidth={1.8} aria-hidden />
            <span>
              <span className="block text-[1rem] leading-tight font-semibold">{label}</span>
              <span className={`block text-[0.8125rem] ${primary ? 'text-white/75' : 'text-muted'}`}>{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {picks.length > 0 && (
        <List header="Lançar de novo, com um toque" className="mt-6" footer="Entra com a data de hoje. Para outro valor, use “Gasto”.">
          {picks.map((p) => (
            <Row
              key={p.description}
              onClick={() => launch(p)}
              icon={<CategoryIcon category={categories.data?.find((c) => c.id === p.categoryId)} size="sm" />}
              title={p.description}
              trailing={<span className="num text-[1rem] font-medium">{formatBRL(p.amountCents)}</span>}
            />
          ))}
        </List>
      )}
    </Sheet>
  )
}

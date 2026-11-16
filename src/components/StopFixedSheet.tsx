import { useState } from 'react'
import { useWrite } from '../data/finance'
import type { Backend } from '../data/backend'
import { addMonths, compareYearMonth, firstDayISO, isoDate, monthKey, monthLabel, parseMonthKey, type YearMonth } from '../lib/dates'
import { fixedRowsToClear, stableId } from '../lib/recurring'
import { friendlyError } from '../lib/supabase'
import type { Recurring } from '../types'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { ErrorBox } from './ui'

const mes = (ym: YearMonth) => monthLabel(ym).split(' ')[0].toLowerCase()

/** Lançamentos automáticos que saem; os do banco ficam como gasto comum (aconteceram). */
async function clearRows(b: Backend, r: Recurring, from: string | null) {
  const { remove, detach } = fixedRowsToClear(await b.list('transactions', { eq: { recurring_id: r.id } }), from)
  for (const id of detach) await b.update('transactions', id, { type: 'dia', recurring_id: null })
  if (remove.length) await b.remove('transactions', remove)
}

type Choice = 'skip' | 'stop' | 'delete'

/**
 * "Tirar este gasto fixo": as três coisas que a pessoa quer dizer, em palavras dela.
 * - Pular um mês (não pagou esse mês, volta no seguinte)
 * - O último mês é X (cancelou: os meses de antes ficam)
 * - Apagar de vez (nunca foi um gasto fixo: já está em outra conta, foi cadastrado errado)
 * `skipMonth`: o mês que pula; `stopFrom`: o primeiro mês sem o gasto.
 */
export function StopFixedSheet({ recurring, skipMonth, stopFrom, onClose, onDone }: { recurring: Recurring | null; skipMonth: YearMonth; stopFrom: YearMonth; onClose: () => void; onDone?: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const r = recurring
  const start = r ? parseMonthKey(r.start_month) : null
  // Parar só faz sentido se sobra algum mês antes (senão é o mesmo que apagar)
  const canStop = !start || compareYearMonth(stopFrom, start) > 0
  const last = addMonths(stopFrom, -1)

  async function choose(c: Choice) {
    if (!r) return
    setError(null)
    try {
      await write.mutateAsync(async (b) => {
        if (c === 'skip') {
          const id = await stableId(`fixo:${r.id}:${monthKey(skipMonth)}`)
          const existing = (await b.list('transactions', { eq: { id } }))[0]
          if (existing) await b.update('transactions', id, { skipped: true })
          else
            await b.insert('transactions', [
              { id, kind: 'expense', type: 'fixo', amount_cents: r.amount_cents, date: isoDate(skipMonth, r.day), description: r.description, category_id: r.category_id, recurring_id: r.id, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: false, skipped: true, note: null },
            ])
        } else if (c === 'stop') {
          await b.update('recurrings', r.id, { end_month: monthKey(last) })
          await clearRows(b, r, firstDayISO(stopFrom))
        } else {
          await clearRows(b, r, null)
          await b.remove('recurrings', [r.id])
        }
      })
      toast(c === 'skip' ? `Pulado em ${mes(skipMonth)}. Volta no mês seguinte.` : c === 'stop' ? `Pronto: o último mês é ${mes(last)}` : `${r.description} apagado de todos os meses`)
      onClose()
      onDone?.()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const option = (c: Choice, title: string, hint: string, danger = false) => (
    <button
      type="button"
      disabled={write.isPending}
      onClick={() => void choose(c)}
      className={`press w-full rounded-[1rem] px-4 py-3 text-left disabled:opacity-60 ${danger ? 'bg-danger-soft' : 'bg-surface-2'}`}
    >
      <span className={`block font-semibold ${danger ? 'text-danger-strong' : ''}`}>{title}</span>
      <span className="block text-[0.875rem] leading-snug text-muted">{hint}</span>
    </button>
  )

  return (
    <Sheet open={r != null} title={r ? `Tirar “${r.description}”` : 'Tirar gasto fixo'} onClose={onClose}>
      <p className="text-[0.9375rem] leading-snug text-muted">O que aconteceu com esse gasto?</p>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2.5">
        {canStop && option('stop', `Parou: o último mês é ${mes(last)}`, `Cancelou ou terminou. Some de ${mes(stopFrom)} em diante; os meses de antes ficam como estão.`)}
        {option('skip', `Pular só ${mes(skipMonth)}`, `Não paga em ${mes(skipMonth)}, mas volta no mês seguinte.`)}
        {option('delete', 'Apagar de vez', 'Não é um gasto fixo seu (já está dentro de outra conta, ou foi cadastrado errado). Some de todos os meses, inclusive deste.', true)}
      </div>
      <p className="mt-3 text-[0.8125rem] leading-snug text-muted">Pagamentos que vieram do banco nunca somem: continuam no extrato como gasto comum.</p>
    </Sheet>
  )
}

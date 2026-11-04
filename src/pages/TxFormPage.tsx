import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { useToast } from '../components/Toast'
import { Button, Chip, ErrorBox, Field, List, NavBar, NavButton, Notice, Row, Segmented, Spinner, Switch } from '../components/ui'
import { useBackend } from '../data/backend'
import { tkey, useCategories, useHistory, useWrite } from '../data/finance'
import { addMonths, currentYearMonth, dayOf, isValidISODate, monthKey, monthOf, todayISO } from '../lib/dates'
import { buildInstallments, installmentLabel } from '../lib/installments'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import type { Category, Emotion, NewRow, Transaction } from '../types'

type Mode = 'dia' | 'renda' | 'fixo' | 'parcelado'

export const EMOTIONS: { value: Emotion; label: string }[] = [
  { value: 'comemorando', label: 'Comemorando' },
  { value: 'estressado', label: 'Estressado' },
  { value: 'entediado', label: 'Entediado' },
  { value: 'cansado', label: 'Cansado' },
]

const TITLES: Record<Mode, string> = { dia: 'Novo gasto', renda: 'Nova renda', fixo: 'Novo gasto fixo', parcelado: 'Compra parcelada' }

const blankTx = (): Omit<NewRow<'transactions'>, 'kind' | 'type' | 'amount_cents' | 'date' | 'description'> => ({
  category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null,
})

/** /lancar?tipo=… (novo) e /lancamento/:id (editar) */
export function TxFormPage() {
  const { id } = useParams()
  const backend = useBackend()
  const existing = useQuery({
    queryKey: tkey('transactions', 'one', id ?? ''),
    queryFn: async () => (await backend.list('transactions', { eq: { id: id! } }))[0] ?? null,
    enabled: Boolean(id),
  })
  const categories = useCategories()
  if ((id && existing.isPending) || categories.isPending) return <Spinner />
  if (id && !existing.data) return <ErrorBox message="Lançamento não encontrado." />
  if (categories.isError) return <ErrorBox message={friendlyError(categories.error)} onRetry={() => categories.refetch()} />
  return <TxForm tx={existing.data ?? null} categories={categories.data} />
}

function TxForm({ tx, categories }: { tx: Transaction | null; categories: Category[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const write = useWrite()
  const [params] = useSearchParams()
  const history = useHistory(3)

  const mode: Mode = tx ? (tx.kind === 'income' ? 'renda' : tx.type === 'fixo' ? 'fixo' : tx.type === 'parcela' ? 'parcelado' : 'dia') : ((params.get('tipo') as Mode) ?? 'dia')
  const income = mode === 'renda'
  const today = todayISO()

  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount_cents) : '')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(tx?.category_id ?? null)
  const [date, setDate] = useState(tx?.date ?? today)
  const [emotion, setEmotion] = useState<Emotion | null>(tx?.emotion ?? null)
  const [paid, setPaid] = useState(tx?.paid ?? true)
  // Fixo
  const [day, setDay] = useState(String(dayOf(today)))
  const [remind, setRemind] = useState(true)
  // Parcelado
  const [count, setCount] = useState('10')
  const [valueIs, setValueIs] = useState<'total' | 'parcela'>('total')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cats = categories.filter((c) => !c.archived && c.kind === (income ? 'income' : 'expense'))
  const descriptions = useMemo(() => [...new Set((history.data ?? []).map((t) => t.description))].slice(0, 40), [history.data])

  const cents = parseBRL(amount)
  const preview = useMemo(() => {
    if (mode !== 'parcelado' || tx || !cents) return null
    try {
      return buildInstallments({ amountCents: cents, mode: valueIs, count: Number(count), firstDate: date })
    } catch {
      return null
    }
  }, [mode, tx, cents, valueIs, count, date])

  /** Ao escolher uma descrição que já existe, sugere a categoria usada da última vez. */
  function pickDescription(v: string) {
    setDescription(v)
    if (categoryId) return
    const last = [...(history.data ?? [])].reverse().find((t) => t.description.toLowerCase() === v.trim().toLowerCase())
    if (last?.category_id) setCategoryId(last.category_id)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!cents) errs.amount = 'Digite o valor (ex.: 42,90).'
    if (!description.trim()) errs.description = 'Dê um nome (ex.: Mercado, Uber, Aluguel).'
    if (mode !== 'fixo' && !isValidISODate(date)) errs.date = 'Data inválida.'
    if (mode === 'fixo' && !tx) {
      const d = Number(day)
      if (!Number.isInteger(d) || d < 1 || d > 31) errs.day = 'Dia de 1 a 31.'
    }
    if (mode === 'parcelado' && !tx) {
      const n = Number(count)
      if (!Number.isInteger(n) || n < 2 || n > 120) errs.count = 'De 2 a 120 parcelas.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setError(null)
    const desc = description.trim()
    try {
      if (tx) {
        await write.mutateAsync(async (b) => {
          const patch: Partial<Transaction> = { amount_cents: cents!, description: desc, category_id: categoryId, date, emotion: mode === 'dia' ? emotion : null, paid }
          if (tx.type === 'parcela' && tx.installment_group) {
            // Nome e categoria valem para todas as parcelas; valor, data e "pago" só para esta
            const group = await b.list('transactions', { eq: { installment_group: tx.installment_group } })
            for (const p of group) if (p.id !== tx.id) await b.update('transactions', p.id, { description: desc, category_id: categoryId })
          }
          await b.update('transactions', tx.id, patch)
        })
        toast('Alteração salva')
      } else if (mode === 'fixo') {
        const ym = currentYearMonth()
        await write.mutateAsync((b) =>
          b.insert('recurrings', [{ description: desc, category_id: categoryId, amount_cents: cents!, day: Number(day), remind, start_month: monthKey(ym), end_month: null, active: true }]),
        )
        toast('Gasto fixo criado: entra sozinho todo mês')
      } else if (mode === 'parcelado') {
        const group = crypto.randomUUID()
        const rows = buildInstallments({ amountCents: cents!, mode: valueIs, count: Number(count), firstDate: date }).map((p) => ({
          ...blankTx(),
          kind: 'expense' as const,
          type: 'parcela' as const,
          amount_cents: p.amountCents,
          date: p.date,
          description: desc,
          category_id: categoryId,
          installment_group: group,
          installment_no: p.no,
          installment_total: p.total,
          paid: p.date <= today,
        }))
        await write.mutateAsync((b) => b.insert('transactions', rows))
        toast(`${rows.length} parcelas lançadas`)
      } else {
        await write.mutateAsync((b) =>
          b.insert('transactions', [
            { ...blankTx(), kind: income ? 'income' : 'expense', type: income ? 'extra' : 'dia', amount_cents: cents!, date, description: desc, category_id: categoryId, emotion: income ? null : emotion },
          ]),
        )
        toast(income ? 'Renda lançada' : 'Gasto lançado')
      }
      navigate(-1)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function onDelete(kind: 'one' | 'skip' | 'stop' | 'group') {
    if (!tx) return
    setConfirmDelete(false)
    try {
      await write.mutateAsync(async (b) => {
        if (kind === 'skip') await b.update('transactions', tx.id, { skipped: true })
        else if (kind === 'stop' && tx.recurring_id) {
          // Para de repetir: este mês sai e os próximos não são criados
          await b.update('recurrings', tx.recurring_id, { end_month: monthKey(addMonths(monthOf(tx.date), -1)) })
          await b.update('transactions', tx.id, { skipped: true })
        } else if (kind === 'group' && tx.installment_group) {
          const group = await b.list('transactions', { eq: { installment_group: tx.installment_group } })
          await b.remove('transactions', group.map((p) => p.id))
        } else await b.remove('transactions', [tx.id])
      })
      toast(kind === 'skip' ? 'Pulado neste mês' : kind === 'stop' ? 'Não repete mais' : 'Apagado')
      navigate(-1)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const title = tx ? (tx.type === 'salario' ? 'Salário do mês' : tx.type === 'fixo' ? 'Gasto fixo do mês' : tx.type === 'parcela' ? `Parcela ${installmentLabel(tx.installment_no, tx.installment_total)}` : income ? 'Renda' : 'Gasto') : TITLES[mode]

  return (
    <>
      <NavBar
        title={title}
        large={false}
        left={<NavButton onClick={() => navigate(-1)}>Cancelar</NavButton>}
        right={
          <NavButton type="submit" form="lancamento" strong disabled={write.isPending}>
            Salvar
          </NavButton>
        }
      />
      <form id="lancamento" onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-3">
        {error && <ErrorBox message={error} />}

        <Field
          label={mode === 'parcelado' && !tx ? (valueIs === 'total' ? 'Valor total da compra' : 'Valor de cada parcela') : 'Valor'}
          prefix="R$"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          autoFocus={!tx}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          className="[&_input]:min-h-16 [&_input]:text-[1.75rem] [&_input]:font-semibold [&_span]:text-[1.25rem]"
        />

        <div>
          <Field label="Descrição" list="descricoes" autoComplete="off" placeholder={income ? 'ex.: Freela, 13º' : 'ex.: Mercado, Uber, iFood'} value={description} onChange={(e) => pickDescription(e.target.value)} error={errors.description} maxLength={60} />
          <datalist id="descricoes">
            {descriptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div>
          <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Categoria</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {cats.map((c) => (
              <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        {mode === 'fixo' && !tx ? (
          <>
            <Field label="Dia do vencimento" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} hint="Todo mês, nesse dia, o gasto entra sozinho. Dia 31 vira o último dia nos meses curtos." />
            <List>
              <Row title="Avisar antes de vencer" trailing={<Switch label="Avisar antes de vencer" checked={remind} onChange={setRemind} />} />
            </List>
          </>
        ) : (
          <Field label={mode === 'parcelado' && !tx ? 'Primeira parcela em' : 'Data'} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        )}

        {mode === 'parcelado' && !tx && (
          <>
            <Segmented label="O valor informado é" value={valueIs} onChange={setValueIs} options={[{ value: 'total', label: 'Total da compra' }, { value: 'parcela', label: 'De cada parcela' }]} />
            <Field label="Número de parcelas" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} error={errors.count} />
            {preview && (
              <Notice>
                {preview.length}x de <strong>{formatBRL(preview[preview.length - 1].amountCents)}</strong>
                {preview[0].amountCents !== preview[preview.length - 1].amountCents && <> (a primeira de {formatBRL(preview[0].amountCents)})</>} = {formatBRL(preview.reduce((a, p) => a + p.amountCents, 0))}. Cada parcela aparece no mês dela, com “1/{preview.length}”, “2/{preview.length}”…
              </Notice>
            )}
          </>
        )}

        {(tx?.type === 'fixo' || tx?.type === 'parcela') && (
          <List>
            <Row title="Já paguei" trailing={<Switch label="Já paguei" checked={paid} onChange={setPaid} />} />
          </List>
        )}

        {mode === 'dia' && (
          <div>
            <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Como você estava? (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((em) => (
                <Chip key={em.value} selected={emotion === em.value} onClick={() => setEmotion(emotion === em.value ? null : em.value)}>
                  {em.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[0.8125rem] text-muted">Ajuda a perceber em que momentos você mais gasta.</p>
          </div>
        )}

        <Button type="submit" loading={write.isPending} className="mt-1">
          Salvar
        </Button>
        {tx && tx.type !== 'salario' && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            {tx.type === 'fixo' ? 'Tirar deste mês' : 'Apagar'}
          </Button>
        )}
        {tx?.type === 'salario' && <p className="px-1 text-center text-[0.875rem] text-muted">O salário entra sozinho todo mês. Para mudar o valor dos próximos meses, vá em Você › Salário.</p>}
      </form>

      {tx && (
        <ConfirmSheet
          open={confirmDelete}
          title={tx.type === 'fixo' ? 'Tirar este gasto fixo' : tx.type === 'parcela' ? 'Apagar parcelamento?' : 'Apagar lançamento?'}
          confirmLabel={tx.type === 'fixo' ? 'Só neste mês' : tx.type === 'parcela' ? 'Apagar todas as parcelas' : 'Apagar'}
          destructive
          onConfirm={() => onDelete(tx.type === 'fixo' ? 'skip' : tx.type === 'parcela' ? 'group' : 'one')}
          onClose={() => setConfirmDelete(false)}
        >
          {tx.type === 'fixo' ? (
            <>
              Escolha se ele sai só deste mês ou se para de repetir.
              <Button variant="secondary" className="mt-4 w-full" onClick={() => onDelete('stop')}>
                Parar de repetir
              </Button>
            </>
          ) : tx.type === 'parcela' ? (
            `Apaga as ${tx.installment_total} parcelas de “${tx.description}”.`
          ) : (
            `“${tx.description}” · ${formatBRL(tx.amount_cents)}`
          )}
        </ConfirmSheet>
      )}
    </>
  )
}

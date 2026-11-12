import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DuoIcon } from '../components/CategoryIcon'
import { haptic } from '../lib/motion'
import { useQuery } from '@tanstack/react-query'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { useToast } from '../components/Toast'
import { Button, Chip, ErrorBox, Field, List, NavBar, NavButton, Notice, Row, Segmented, Spinner, Switch } from '../components/ui'
import { useBackend } from '../data/backend'
import { insertTxWithRules, tkey, useCategories, useGoals, useHistory, useWrite } from '../data/finance'
import { useProfile } from '../data/hooks'
import { concreteText, workTime } from '../lib/psych'
import { countKey, ignoreKey, learnKey } from '../../supabase/functions/_shared/bankmap.ts'
import { addDaysISO, addMonths, currentYearMonth, dayOf, isValidISODate, monthKey, monthOf, relativeDay, todayISO } from '../lib/dates'
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
  const profile = useProfile()
  const goals = useGoals()

  const [pickedMode, setPickedMode] = useState<Mode>((params.get('tipo') as Mode) ?? 'dia')
  const mode: Mode = tx ? (tx.kind === 'income' ? 'renda' : tx.type === 'fixo' ? 'fixo' : tx.type === 'parcela' ? 'parcelado' : 'dia') : pickedMode
  const income = mode === 'renda'
  const today = todayISO()

  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount_cents) : '')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(tx?.category_id ?? null)
  const [date, setDate] = useState(tx?.date ?? today)
  const [emotion, setEmotion] = useState<Emotion | null>(tx?.emotion ?? null)
  const [paid, setPaid] = useState(tx?.paid ?? true)
  // Veio do banco: a pessoa decide se entra na conta do mês (entrada não conta sozinha; gasto conta)
  const fromBank = tx?.source === 'banco' && tx.type !== 'salario' && tx.type !== 'fixo'
  const [counts, setCounts] = useState(tx ? !tx.skipped : true)
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
          if (fromBank && counts === tx.skipped) {
            patch.skipped = !counts
            // Aprende para os próximos da mesma origem (entrada que conta) ou do mesmo destino (gasto que não conta)
            const pattern = income ? countKey(tx.description) : ignoreKey(tx.description)
            const teach = income ? counts : !counts
            const ruleCategory = categoryId ?? tx.category_id ?? cats[0]?.id ?? null
            if (pattern && teach && ruleCategory) await b.upsert('category_rules', { pattern, category_id: ruleCategory }, 'user_id,pattern')
            if (pattern && !teach) {
              const old = (await b.list('category_rules')).filter((r) => r.pattern === pattern)
              if (old.length) await b.remove('category_rules', old.map((r) => r.id))
            }
          }
          if (tx.type === 'parcela' && tx.installment_group) {
            // Nome e categoria valem para todas as parcelas; valor, data e "pago" só para esta
            const group = await b.list('transactions', { eq: { installment_group: tx.installment_group } })
            for (const p of group) if (p.id !== tx.id) await b.update('transactions', p.id, { description: desc, category_id: categoryId })
          }
          await b.update('transactions', tx.id, patch)
          // Veio do banco e a categoria mudou: aprende para os próximos e corrige os parecidos
          if (tx.source === 'banco' && categoryId && categoryId !== tx.category_id) {
            const key = learnKey(tx.description)
            if (key) {
              await b.upsert('category_rules', { pattern: key, category_id: categoryId }, 'user_id,pattern')
              const similar = (await b.list('transactions', { eq: { source: 'banco' } })).filter((t) => t.id !== tx.id && learnKey(t.description) === key && t.category_id !== categoryId)
              for (const t of similar) await b.update('transactions', t.id, { category_id: categoryId })
            }
          }
        })
        const who = tx.description.replace(/^(Pix|Transferência) (de|para) /i, '')
        toast(
          fromBank && counts === tx.skipped
            ? income
              ? counts ? `Agora conta como renda. As próximas entradas de ${who} também` : 'Não conta mais como renda'
              : counts ? 'Voltou a contar como gasto' : `Não conta mais como gasto. Os próximos para ${who} também não`
            : tx.source === 'banco' && categoryId !== tx.category_id ? 'Salvo. Os próximos parecidos já vêm nessa categoria' : 'Alteração salva',
        )
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
        const saved = await write.mutateAsync((b) =>
          insertTxWithRules(b, { ...blankTx(), kind: income ? 'income' : 'expense', type: income ? 'extra' : 'dia', amount_cents: cents!, date, description: desc, category_id: categoryId, emotion: income ? null : emotion }),
        )
        const extra = typeof saved === 'number' && saved > 0 ? ` · ${formatBRL(saved)} foram para as caixinhas` : ''
        toast(`${income ? 'Renda lançada' : 'Gasto lançado'}${extra}`)
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
        {!tx && (mode === 'dia' || mode === 'renda') && (
          <Segmented
            label="Tipo"
            value={mode}
            onChange={(m) => {
              setPickedMode(m)
              setCategoryId(null)
            }}
            options={[
              { value: 'dia', label: 'Gasto' },
              { value: 'renda', label: 'Renda' },
            ]}
          />
        )}
        {error && <ErrorBox message={error} />}
        {tx?.source === 'banco' && <Notice>{tx.note ?? 'Veio do banco. Valor e data são os do extrato; se mudar a categoria, o app aprende para os próximos.'}</Notice>}
        {fromBank && (
          <List footer={income ? 'Sua renda do mês é o salário (em Você) mais o que você lançar. Dinheiro que entra na conta do banco só conta se você ligar aqui.' : 'Desligue se for dinheiro que só mudou de lugar (por exemplo, um Pix para outra conta sua).'}>
            <Row title={income ? 'Contar como renda do mês' : 'Contar como gasto do mês'} trailing={<Switch label={income ? 'Contar como renda do mês' : 'Contar como gasto do mês'} checked={counts} onChange={setCounts} />} />
          </List>
        )}

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
        {!income && cents ? <PriceHints cents={cents} hours={workTime(cents, profile.data?.salary_cents ?? null, profile.data?.work_hours_week ?? 44)} concrete={concreteText(cents, goals.data ?? [])} /> : null}

        <div>
          <Field label="Descrição" list="descricoes" autoComplete="off" placeholder={income ? 'ex.: Freela, 13º' : 'ex.: Mercado, Uber, iFood'} value={description} onChange={(e) => pickDescription(e.target.value)} error={errors.description} maxLength={60} />
          <datalist id="descricoes">
            {descriptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <p className="text-[0.875rem] font-medium text-muted">Categoria</p>
            <Link to="/voce/categorias" className="text-[0.875rem] font-semibold text-primary">
              Editar
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {cats.map((c) => {
              const on = categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    haptic(8)
                    setCategoryId(on ? null : c.id)
                  }}
                  className={`press flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 bg-surface px-1.5 py-2.5 text-center transition-colors ${on ? 'border-ink' : 'border-transparent shadow-soft'}`}
                >
                  <span className="grid size-11 place-items-center rounded-[0.8rem]" style={{ background: `linear-gradient(145deg, ${c.color}24, ${c.color}0F)` }}>
                    <DuoIcon name={c.icon} color={c.color} size={26} />
                  </span>
                  <span className="line-clamp-2 text-[0.8125rem] leading-tight font-semibold">{c.name}</span>
                </button>
              )
            })}
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
          <div>
            <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">{mode === 'parcelado' && !tx ? 'Primeira parcela em' : 'Data'}</p>
            <div className="shadow-soft flex items-center gap-1 rounded-[0.875rem] bg-surface p-1">
              <button type="button" aria-label="Dia anterior" onClick={() => isValidISODate(date) && setDate(addDaysISO(date, -1))} className="press grid size-11 place-items-center rounded-[0.7rem] text-primary active:bg-surface-2">
                <ChevronLeft className="size-6" />
              </button>
              <label className="relative flex-1 text-center">
                <span className="text-[1.0625rem] font-semibold">{isValidISODate(date) ? relativeDay(date, today) : 'Escolher data'}</span>
                <span className="block text-[0.8125rem] text-muted">{isValidISODate(date) ? date.split('-').reverse().join('/') : ''}</span>
                <input type="date" aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" aria-label="Próximo dia" onClick={() => isValidISODate(date) && setDate(addDaysISO(date, 1))} className="press grid size-11 place-items-center rounded-[0.7rem] text-primary active:bg-surface-2">
                <ChevronRight className="size-6" />
              </button>
            </div>
            {errors.date && <p className="mt-1.5 px-1 text-[0.875rem] font-medium text-danger-strong">{errors.date}</p>}
          </div>
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
        {/* O que veio do banco não se apaga (voltaria na próxima atualização): usa o "contar" lá em cima */}
        {tx && tx.type !== 'salario' && !fromBank && (
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

/** Preço traduzido: horas do seu trabalho e o item concreto de uma caixinha. */
function PriceHints({ cents, hours, concrete }: { cents: number; hours: string | null; concrete: string | null }) {
  if (!hours && !concrete) return null
  return (
    <div className="-mt-2 flex flex-col gap-1 px-1 text-[0.875rem] leading-snug text-muted" aria-live="polite">
      {hours && (
        <p>
          {formatBRL(cents)} = <strong className="text-ink">{hours}</strong> do seu trabalho
        </p>
      )}
      {concrete && (
        <p>
          Isso equivale a <strong className="text-ink">{concrete}</strong>
        </p>
      )}
    </div>
  )
}

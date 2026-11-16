import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Check, Plus } from 'lucide-react'
import { CategoryIcon, DuoIcon } from '../../components/CategoryIcon'
import { Sheet } from '../../components/Sheet'
import { StartMonthField } from '../../components/StartMonthField'
import { RemindDays } from '../../components/RemindDays'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { StopFixedSheet } from '../../components/StopFixedSheet'
import { useToast } from '../../components/Toast'
import { BackButton, Button, Chip, ErrorBox, Field, List, NavBar, Row, Segmented, Spinner, Switch } from '../../components/ui'
import { useCategories, useRecurrings, useWrite } from '../../data/finance'
import { CATEGORY_COLORS, CATEGORY_ICONS, GROUP_LABEL } from '../../lib/categories'
import { addMonths, compareYearMonth, currentYearMonth, isoDate, monthKey, monthLabel, parseMonthKey } from '../../lib/dates'
import { fixedToInstallments, monthsBeforeStart, stableId } from '../../lib/recurring'
import { centsToInput, formatBRL, parseBRL } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import type { Category, CategoryGroup, Recurring } from '../../types'

// ---------------------------------------------------------------------------
// Categorias e limites
// ---------------------------------------------------------------------------

export function CategoriesPage() {
  const navigate = useNavigate()
  const categories = useCategories()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  if (categories.isPending) return <Spinner />
  if (categories.isError) return <ErrorBox message={friendlyError(categories.error)} onRetry={() => categories.refetch()} />
  const active = categories.data.filter((c) => !c.archived)
  const limitText = (c: Category) =>
    [c.monthly_limit_cents != null && `${formatBRL(c.monthly_limit_cents)}/mês`, c.weekly_limit_cents != null && `${formatBRL(c.weekly_limit_cents)}/semana`].filter(Boolean).join(' · ') || GROUP_LABEL[c.grp]

  return (
    <>
      <NavBar
        title="Categorias"
        left={<BackButton label="Você" onClick={() => navigate('/voce')} />}
        right={
          <button type="button" aria-label="Nova categoria" onClick={() => setEditing('new')} className="grid size-9 place-items-center rounded-full text-primary active:bg-surface-2">
            <Plus className="size-6" />
          </button>
        }
      />
      <div className="flex flex-col gap-6">
        <List header="Gastos" footer="Limite mensal conta tudo da categoria; o semanal, só os gastos do dia a dia. Alerta em 80% e 100%.">
          {active.filter((c) => c.kind === 'expense').map((c) => (
            <Row key={c.id} icon={<CategoryIcon category={c} size="sm" />} title={c.name} subtitle={limitText(c)} chevron onClick={() => setEditing(c)} />
          ))}
        </List>
        <List header="Rendas">
          {active.filter((c) => c.kind === 'income').map((c) => (
            <Row key={c.id} icon={<CategoryIcon category={c} size="sm" />} title={c.name} chevron onClick={() => setEditing(c)} />
          ))}
        </List>
      </div>
      <CategorySheet category={editing} onClose={() => setEditing(null)} />
    </>
  )
}

/** `kind`: tipo da categoria nova (gasto ou renda). `onCreated` recebe o id da que acabou de ser criada. */
export function CategorySheet({ category, onClose, kind = 'expense', onCreated }: { category: Category | 'new' | null; onClose: () => void; kind?: Category['kind']; onCreated?: (id: string) => void }) {
  return (
    <Sheet open={category != null} onClose={onClose} title={category === 'new' ? 'Nova categoria' : 'Editar categoria'}>
      {category != null && <CategoryForm key={category === 'new' ? 'new' : category.id} category={category === 'new' ? null : category} newKind={kind} onCreated={onCreated} onDone={onClose} />}
    </Sheet>
  )
}

function CategoryForm({ category, onDone, newKind, onCreated }: { category: Category | null; onDone: () => void; newKind: Category['kind']; onCreated?: (id: string) => void }) {
  const write = useWrite()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'receipt')
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [kind] = useState(category?.kind ?? newKind)
  const [grp, setGrp] = useState<CategoryGroup>(category?.grp ?? 'desejo')
  const [monthly, setMonthly] = useState(centsToInput(category?.monthly_limit_cents))
  const [weekly, setWeekly] = useState(centsToInput(category?.weekly_limit_cents))
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const m = monthly.trim() ? parseBRL(monthly) : null
    const w = weekly.trim() ? parseBRL(weekly) : null
    if (!name.trim()) return setError('Dê um nome para a categoria.')
    if ((monthly.trim() && m == null) || (weekly.trim() && w == null)) return setError('Limite inválido. Use valores como 300,00.')
    setError(null)
    const row = { name: name.trim(), icon, color, kind, grp, monthly_limit_cents: m, weekly_limit_cents: w }
    try {
      const id = category?.id ?? crypto.randomUUID()
      await write.mutateAsync((b) => (category ? b.update('categories', category.id, row) : b.insert('categories', [{ ...row, id, sort: 90, archived: false }])))
      if (!category) onCreated?.(id)
      toast('Categoria salva')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function archive() {
    if (!category) return
    try {
      await write.mutateAsync((b) => b.update('categories', category.id, { archived: true }))
      toast('Categoria arquivada (os lançamentos antigos continuam)')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <ErrorBox message={error} />}
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      <div>
        <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Ícone</p>
        <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto overscroll-contain rounded-[0.9rem] bg-surface-2/60 p-1.5">
          {CATEGORY_ICONS.map((name) => (
            <button key={name} type="button" aria-label={name} aria-pressed={icon === name} onClick={() => setIcon(name)} className={`grid aspect-square place-items-center rounded-[0.7rem] border-2 bg-surface transition ${icon === name ? 'border-ink' : 'border-transparent'}`}>
              <DuoIcon name={name} color={color} size={22} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Cor nos gráficos</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="grid size-9 place-items-center rounded-full" style={{ background: c }}>
              {color === c && <Check className="size-5 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
      {kind === 'expense' && (
        <>
          <div>
            <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Na regra 50/30/20 é</p>
            <Segmented label="Tipo de gasto" value={grp} onChange={setGrp} options={[{ value: 'necessidade', label: 'Necessidade' }, { value: 'desejo', label: 'Desejo' }]} />
          </div>
          <Field label="Limite por mês (opcional)" prefix="R$" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          <Field label="Limite por semana (opcional)" prefix="R$" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} hint="Bom para delivery, Uber e lanches." />
        </>
      )}
      <Button type="submit" loading={write.isPending}>
        Salvar
      </Button>
      {category && (
        <Button variant="danger" onClick={archive}>
          Arquivar categoria
        </Button>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Gastos fixos
// ---------------------------------------------------------------------------

export function FixedPage() {
  const navigate = useNavigate()
  const recurrings = useRecurrings()
  const categories = useCategories()
  const [editing, setEditing] = useState<Recurring | null>(null)
  if (recurrings.isPending) return <Spinner />
  if (recurrings.isError) return <ErrorBox message={friendlyError(recurrings.error)} onRetry={() => recurrings.refetch()} />
  const current = monthKey(currentYearMonth())
  const live = recurrings.data.filter((r) => !r.end_month || r.end_month >= current)
  const active = live.filter((r) => r.active)
  const total = active.reduce((a, r) => a + r.amount_cents, 0)

  return (
    <>
      <NavBar
        title="Gastos fixos"
        subtitle={`${formatBRL(total)} por mês · ${formatBRL(total * 12)} por ano`}
        left={<BackButton label="Voltar" onClick={() => navigate(-1)} />}
        right={
          <button type="button" aria-label="Novo gasto fixo" onClick={() => navigate('/lancar?tipo=fixo')} className="grid size-9 place-items-center rounded-full text-primary active:bg-surface-2">
            <Plus className="size-6" />
          </button>
        }
      />
      {live.length === 0 ? (
        <p className="py-8 text-center text-muted">Nenhum gasto fixo. Aluguel, telefone e assinaturas entram aqui e são lançados sozinhos todo mês.</p>
      ) : (
        <List footer="Mudanças valem a partir do próximo lançamento automático. Para parar, apagar ou pular um mês, toque no gasto.">
          {live.map((r) => (
            <Row
              key={r.id}
              icon={<CategoryIcon category={categories.data?.find((c) => c.id === r.category_id)} size="sm" />}
              title={r.description}
              subtitle={`${r.start_month > current ? `Começa em ${monthLabel(parseMonthKey(r.start_month)!).split(' ')[0].toLowerCase()} · dia ${r.day}` : `Todo dia ${r.day}`}${r.active ? '' : ' · pausado'}`}
              trailing={<span className={`num ${r.active ? '' : 'text-muted'}`}>{formatBRL(r.amount_cents)}</span>}
              chevron
              onClick={() => setEditing(r)}
            />
          ))}
        </List>
      )}
      <Sheet open={editing != null} onClose={() => setEditing(null)} title="Gasto fixo">
        {editing && <RecurringForm key={editing.id} recurring={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

function RecurringForm({ recurring, onDone }: { recurring: Recurring; onDone: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const categories = useCategories()
  const [description, setDescription] = useState(recurring.description)
  const [amount, setAmount] = useState(centsToInput(recurring.amount_cents))
  const [day, setDay] = useState(String(recurring.day))
  const [categoryId, setCategoryId] = useState(recurring.category_id)
  const [remind, setRemind] = useState(recurring.remind)
  const [remindDays, setRemindDays] = useState(recurring.remind_days ?? 3)
  // "É uma compra parcelada": parcela de agora e total
  const [parcelOpen, setParcelOpen] = useState(false)
  const [parcelNo, setParcelNo] = useState('1')
  const [parcelTotal, setParcelTotal] = useState('')
  const [confirmParcel, setConfirmParcel] = useState(false)
  const [active, setActive] = useState(recurring.active)
  // Começa em: se já começou antes, mostra este mês (o passado não muda)
  const [start, setStart] = useState(() => {
    const now = currentYearMonth()
    const stored = parseMonthKey(recurring.start_month)
    return stored && compareYearMonth(stored, now) > 0 ? stored : now
  })
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseBRL(amount)
    const d = Number(day)
    if (!description.trim()) return setError('Dê um nome.')
    if (!cents) return setError('Valor inválido.')
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError('Dia de 1 a 31.')
    setError(null)
    try {
      const ym = currentYearMonth()
      const thisMonth = await stableId(`fixo:${recurring.id}:${monthKey(ym)}`)
      const later = compareYearMonth(start, ym) > 0
      // Passou a começar num mês que vem: os lançamentos automáticos de agora até lá saem
      const drop = later ? await Promise.all(monthsBeforeStart(ym, start).map((m) => stableId(`fixo:${recurring.id}:${monthKey(m)}`))) : []
      const startPatch = later || recurring.start_month > monthKey(ym) ? { start_month: monthKey(start) } : {}
      await write.mutateAsync(async (b) => {
        await b.update('recurrings', recurring.id, { description: description.trim(), amount_cents: cents, day: d, category_id: categoryId, remind, remind_days: remindDays, active, ...startPatch })
        if (drop.length) await b.remove('transactions', drop)
        else await b.update('transactions', thisMonth, { description: description.trim(), amount_cents: cents, date: isoDate(ym, d), category_id: categoryId })
      })
      toast(later ? `Gasto fixo salvo: entra a partir de ${monthLabel(start).split(' ')[0].toLowerCase()}` : 'Gasto fixo salvo')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  /** Era uma compra parcelada: vira parcelas de verdade ("3/10") e o fixo para de se repetir. */
  async function toInstallments() {
    setConfirmParcel(false)
    const now = currentYearMonth()
    const stored = parseMonthKey(recurring.start_month)
    const base = stored && compareYearMonth(stored, now) > 0 ? stored : now
    const total = Number(parcelTotal)
    const plan = fixedToInstallments(base, Number(parcelNo), total)
    if (!plan.length) return setError('Confira os números: a parcela de agora não pode ser maior que o total (até 120).')
    const d = Number(day) || recurring.day
    const cents = parseBRL(amount) ?? recurring.amount_cents
    const group = crypto.randomUUID()
    const thisMonth = await stableId(`fixo:${recurring.id}:${monthKey(base)}`)
    try {
      await write.mutateAsync(async (b) => {
        // O fixo para no mês anterior: não gera mais nada
        await b.update('recurrings', recurring.id, { end_month: monthKey(addMonths(base, -1)) })
        const rows = plan.map((p) => ({
          kind: 'expense' as const,
          type: 'parcela' as const,
          amount_cents: cents,
          date: isoDate(p.ym, d),
          description: description.trim() || recurring.description,
          category_id: categoryId,
          recurring_id: null,
          installment_group: group,
          installment_no: p.no,
          installment_total: total,
          emotion: null,
          paid: false,
          skipped: false,
          note: null,
        }))
        // O lançamento deste mês (se já entrou) vira a parcela de agora, mantendo se já foi pago e o vínculo com o banco
        const existing = (await b.list('transactions', { eq: { id: thisMonth } }))[0]
        if (existing) {
          const first = rows.shift()!
          await b.update('transactions', thisMonth, {
            type: first.type,
            recurring_id: null,
            installment_group: group,
            installment_no: first.installment_no,
            installment_total: total,
            description: first.description,
            category_id: categoryId,
          })
        }
        if (rows.length) await b.insert('transactions', rows)
      })
      toast(`Virou parcelado: ${plan.length} ${plan.length === 1 ? 'parcela' : 'parcelas'} até ${monthLabel(plan[plan.length - 1].ym).toLowerCase()}`)
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const [stopping, setStopping] = useState(false)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <ErrorBox message={error} />}
      <Field label="Nome" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={60} />
      <Field label="Valor por mês" prefix="R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Field label="Dia do vencimento" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
      <StartMonthField value={start} onChange={setStart} hint="Só para quando o gasto ainda vai começar. Para parar de cobrar, use “Tirar este gasto fixo”, lá embaixo." />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(categories.data ?? []).filter((c) => c.kind === 'expense' && !c.archived).map((c) => (
          <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
      <List>
        <Row title="Avisar antes de vencer" trailing={<Switch label="Avisar antes de vencer" checked={remind} onChange={setRemind} />} />
        <Row title="Ativo" subtitle="Desligado: pausa nos próximos meses" trailing={<Switch label="Ativo" checked={active} onChange={setActive} />} />
      </List>
      {remind && <RemindDays value={remindDays} onChange={setRemindDays} />}
      <div className="rounded-[1rem] bg-surface p-4">
        <button type="button" onClick={() => setParcelOpen((o) => !o)} aria-expanded={parcelOpen} className="w-full text-left">
          <span className="block font-semibold">É uma compra parcelada?</span>
          <span className="block text-[0.9375rem] text-muted">Ex.: sapato em 10x. Vira “3/10” e para sozinho na última parcela.</span>
        </button>
        {parcelOpen && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Esta é a parcela" inputMode="numeric" value={parcelNo} onChange={(e) => setParcelNo(e.target.value)} />
              <Field label="De quantas" inputMode="numeric" value={parcelTotal} onChange={(e) => setParcelTotal(e.target.value)} placeholder="ex.: 10" />
            </div>
            <Button variant="soft" disabled={!Number(parcelTotal)} onClick={() => setConfirmParcel(true)}>
              Transformar em parcelado
            </Button>
          </div>
        )}
      </div>
      <ConfirmSheet
        open={confirmParcel}
        title="Transformar em parcelado?"
        confirmLabel="Transformar"
        onClose={() => setConfirmParcel(false)}
        onConfirm={() => void toInstallments()}
      >
        {`${description.trim() || recurring.description} deixa de ser gasto fixo e vira as parcelas ${parcelNo} a ${parcelTotal}, uma por mês. Depois da última, não cobra mais.`}
      </ConfirmSheet>
      <Button type="submit" loading={write.isPending}>
        Salvar
      </Button>
      <Button variant="danger" onClick={() => setStopping(true)}>
        Tirar este gasto fixo
      </Button>
      <StopFixedSheet recurring={stopping ? recurring : null} skipMonth={currentYearMonth()} stopFrom={addMonths(currentYearMonth(), 1)} onClose={() => setStopping(false)} onDone={onDone} />
    </form>
  )
}

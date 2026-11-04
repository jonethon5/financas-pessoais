import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Check, Plus } from 'lucide-react'
import { CategoryIcon, DuoIcon } from '../../components/CategoryIcon'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BackButton, Button, Chip, ErrorBox, Field, List, NavBar, Row, Segmented, Spinner, Switch } from '../../components/ui'
import { useCategories, useRecurrings, useWrite } from '../../data/finance'
import { CATEGORY_COLORS, CATEGORY_ICONS, GROUP_LABEL } from '../../lib/categories'
import { currentYearMonth, isoDate, monthKey } from '../../lib/dates'
import { stableId } from '../../lib/recurring'
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

export function CategorySheet({ category, onClose }: { category: Category | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={category != null} onClose={onClose} title={category === 'new' ? 'Nova categoria' : 'Editar categoria'}>
      {category != null && <CategoryForm key={category === 'new' ? 'new' : category.id} category={category === 'new' ? null : category} onDone={onClose} />}
    </Sheet>
  )
}

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'receipt')
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [kind] = useState(category?.kind ?? 'expense')
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
      await write.mutateAsync((b) => (category ? b.update('categories', category.id, row) : b.insert('categories', [{ ...row, sort: 100, archived: false }])))
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
        <div className="grid grid-cols-8 gap-1.5">
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
        <List footer="Mudanças valem a partir do próximo lançamento automático. Pausado = não entra nos próximos meses.">
          {live.map((r) => (
            <Row
              key={r.id}
              icon={<CategoryIcon category={categories.data?.find((c) => c.id === r.category_id)} size="sm" />}
              title={r.description}
              subtitle={`Todo dia ${r.day}${r.active ? '' : ' · pausado'}`}
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
  const [active, setActive] = useState(recurring.active)
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
      await write.mutateAsync(async (b) => {
        await b.update('recurrings', recurring.id, { description: description.trim(), amount_cents: cents, day: d, category_id: categoryId, remind, active })
        await b.update('transactions', thisMonth, { description: description.trim(), amount_cents: cents, date: isoDate(ym, d), category_id: categoryId })
      })
      toast('Gasto fixo salvo')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function stop() {
    try {
      const ym = currentYearMonth()
      await write.mutateAsync((b) => b.update('recurrings', recurring.id, { end_month: monthKey({ year: ym.year, month: ym.month }) }))
      toast('Não repete mais a partir do mês que vem')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <ErrorBox message={error} />}
      <Field label="Nome" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={60} />
      <Field label="Valor por mês" prefix="R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Field label="Dia do vencimento" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
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
      <Button type="submit" loading={write.isPending}>
        Salvar
      </Button>
      <Button variant="danger" onClick={stop}>
        Encerrar (último mês é este)
      </Button>
    </form>
  )
}

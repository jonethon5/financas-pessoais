import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { MascotArt } from '../components/Pig'
import { Tour } from '../components/Tour'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { AnimatedMoney, Badge, Button, Card, ErrorBox, List, Money, NavBar, ProgressBar, Row, Segmented, Spinner } from '../components/ui'
import { CategoryDonut, type Slice } from '../components/CategoryDonut'
import { CategorySheet } from './you/MoneySettingsPages'
import { useRecurrings, useWrite } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { coverOptions, rule503020, subscriptions, type CategoryStatus } from '../lib/budget'
import { addMonths, compareYearMonth, currentYearMonth, monthKey, monthLabel, parseMonthKey, relativeDay, type YearMonth } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import type { Category } from '../types'
import type { MonthTx } from '../data/finance'

/** Texto do alerta (nunca só cor): ▲ e o quanto passou. */
export function levelText(s: Pick<CategoryStatus, 'spent' | 'limit' | 'level' | 'weekSpent' | 'weekLimit' | 'weekLevel'>): ReactNode {
  if (s.level === 'over') return <Badge tone="danger">▲ passou {formatBRL(s.spent - (s.limit ?? 0))}</Badge>
  if (s.weekLevel === 'over') return <Badge tone="danger">▲ semana: passou {formatBRL(s.weekSpent - (s.weekLimit ?? 0))}</Badge>
  if (s.level === 'warn') return <Badge tone="warn">▲ {Math.round((s.spent / (s.limit || 1)) * 100)}% do limite</Badge>
  if (s.weekLevel === 'warn') return <Badge tone="warn">▲ semana: {Math.round((s.weekSpent / (s.weekLimit || 1)) * 100)}%</Badge>
  return null
}

const link = (to: string) => (content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
)

export function MonthPage() {
  const [params, setParams] = useSearchParams()
  const ym = parseMonthKey(params.get('mes')) ?? currentYearMonth()
  const tabParam = params.get('aba')
  const tab = tabParam === 'orcamento' || tabParam === 'lancamentos' ? tabParam : 'resumo'
  const cat = params.get('cat')
  const view = useMonthView(ym)
  const set = (patch: Record<string, string | null>) => {
    const next: Record<string, string> = { mes: monthKey(ym), aba: tab }
    if (cat) next.cat = cat
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) delete next[k]
      else next[k] = v
    }
    setParams(next, { replace: true })
  }

  return (
    <>
      <NavBar title="Mês" />
      <Tour
        id="mes"
        steps={[
          { target: 'mes-seletor', title: 'Escolha o mês', text: 'Volte para ver meses passados ou avance para ver as contas que vêm por aí.' },
          { target: 'mes-abas', title: 'Resumo, lançamentos e orçamento', text: 'No Orçamento você coloca limite por categoria e o app avisa antes de estourar.' },
        ]}
      />
      <div data-tour="mes-seletor" className="shadow-soft mb-4 flex items-center justify-between rounded-[1rem] bg-surface px-1 py-1">
        <button type="button" aria-label="Mês anterior" onClick={() => set({ mes: monthKey(addMonths(ym, -1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
          <ChevronLeft className="size-6" />
        </button>
        <p className="text-[1.0625rem] font-bold">{monthLabel(ym)}</p>
        <button type="button" aria-label="Próximo mês" onClick={() => set({ mes: monthKey(addMonths(ym, 1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
          <ChevronRight className="size-6" />
        </button>
      </div>
      <div data-tour="mes-abas">
      <Segmented
        label="Ver"
        value={tab}
        onChange={(aba) => set({ aba, cat: null })}
        options={[
          { value: 'resumo', label: 'Resumo' },
          { value: 'lancamentos', label: 'Lançamentos' },
          { value: 'orcamento', label: 'Orçamento' },
        ]}
      />
      </div>
      <div className="mt-5" key={`${monthKey(ym)}-${tab}`}>
        {view.isPending ? (
          <Spinner />
        ) : view.error || !view.data ? (
          <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
        ) : tab === 'resumo' ? (
          <Summary data={view.data} onCategory={(id) => set({ aba: 'lancamentos', cat: id })} />
        ) : tab === 'lancamentos' ? (
          <Entries ym={ym} data={view.data} categoryFilter={cat} onClearFilter={() => set({ cat: null })} />
        ) : (
          <Budget ym={ym} data={view.data} />
        )}
      </div>
    </>
  )
}

type ViewData = NonNullable<ReturnType<typeof useMonthView>['data']>

/** Resumo: despesas, renda e balanço, com o gráfico de rosca por categoria. */
function Summary({ data, onCategory }: { data: ViewData; onCategory: (id: string) => void }) {
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const { txs, categories, summary: s } = data
  const expenses = s.committed + s.daily
  const balance = s.income - expenses
  const byCat = new Map<string, number>()
  for (const t of txs) if (!t.skipped && t.kind === kind) byCat.set(t.category_id ?? 'sem', (byCat.get(t.category_id ?? 'sem') ?? 0) + t.amount_cents)
  const slices: Slice[] = [...byCat.entries()]
    .map(([id, cents]) => {
      const c = categories.find((x) => x.id === id)
      return { id, name: c?.name ?? 'Sem categoria', color: c?.color ?? '#B8C0C8', cents }
    })
    .sort((a, b) => b.cents - a.cents)
  const total = slices.reduce((a, x) => a + x.cents, 0)
  const i = (n: number) => ({ '--i': n }) as CSSProperties

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3" style={i(0)}>
        <Card className="px-4 py-3.5">
          <p className="text-[0.8125rem] text-muted">Despesas</p>
          <p className="text-[1.25rem] font-bold">
            −<AnimatedMoney cents={expenses} />
          </p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[0.8125rem] text-muted">Renda</p>
          <p className="text-[1.25rem] font-bold text-primary-strong">
            +<AnimatedMoney cents={s.income} />
          </p>
        </Card>
      </div>
      <div style={i(1)}>
        <Card className="flex items-center justify-between px-4 py-3.5">
          <p className="text-[0.9375rem] leading-tight text-muted">
            Balanço do mês
            <span className="block text-[0.75rem]">renda − despesas, antes das caixinhas</span>
          </p>
          <p className={`text-[1.375rem] font-bold ${balance < 0 ? 'text-danger-strong' : ''}`}>
            {balance < 0 ? '−' : '+'}
            <AnimatedMoney cents={Math.abs(balance)} />
          </p>
        </Card>
      </div>
      <div style={i(2)}>
        <Segmented label="Mostrar" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Despesas' }, { value: 'income', label: 'Renda' }]} />
      </div>
      <div style={i(3)}>
        <Card className="py-6" key={kind}>
          <CategoryDonut slices={slices} label={kind === 'expense' ? 'Gastos do mês' : 'Rendas do mês'} />
        </Card>
      </div>
      <div style={i(4)}>
        {slices.length === 0 ? (
          <Card className="text-center text-muted">Nada lançado neste mês.</Card>
        ) : (
          <List>
            {slices.map((x) => (
              <Row
                key={x.id}
                icon={<CategoryIcon category={categories.find((c) => c.id === x.id) ?? { icon: 'receipt', color: x.color }} size="sm" />}
                title={x.name}
                trailing={
                  <span className="flex items-center gap-2.5">
                    <Money cents={x.cents} className="text-[1rem] font-semibold" />
                    <span className="num w-11 text-right text-[0.875rem] text-muted">{total ? Math.round((x.cents / total) * 100) : 0}%</span>
                  </span>
                }
                chevron={x.id !== 'sem'}
                onClick={x.id !== 'sem' ? () => onCategory(x.id) : undefined}
              />
            ))}
          </List>
        )}
      </div>
    </div>
  )
}

function Entries({ ym, data, categoryFilter, onClearFilter }: { ym: YearMonth; data: ViewData; categoryFilter: string | null; onClearFilter: () => void }) {
  const { txs: allTxs, summary: s, categories, today } = data
  const txs = categoryFilter ? allTxs.filter((t) => t.category_id === categoryFilter) : allTxs
  const future = compareYearMonth(ym, currentYearMonth()) > 0
  const live = txs.filter((t) => !t.skipped)
  // Veio do banco e não conta (entrada que não é renda, Pix entre contas próprias)
  const out = txs.filter((t) => t.skipped && t.source === 'banco')

  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const incomes = live.filter((t) => t.kind === 'income')
  const fixed = live.filter((t) => t.type === 'fixo')
  const parcels = live.filter((t) => t.type === 'parcela')
  const daily = live.filter((t) => t.type === 'dia').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const days = [...new Set(daily.map((t) => t.date))]

  const row = (t: MonthTx, subtitle?: ReactNode) => (
    <Row
      key={t.id}
      icon={<CategoryIcon category={catOf(t.category_id)} size="sm" />}
      title={`${t.description}${t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}`}
      subtitle={subtitle ?? catOf(t.category_id)?.name}
      trailing={<Money cents={t.amount_cents} className={`text-[1.0625rem] ${t.kind === 'income' ? 'text-primary-strong' : ''}`} />}
      as={t.virtual ? undefined : link(`/lancamento/${t.id}`)}
    />
  )
  const billStatus = (t: MonthTx) =>
    t.virtual ? 'Previsto' : t.paid ? 'Pago' : t.date < today ? <span className="font-medium text-danger-strong">Vencido dia {Number(t.date.slice(8))}</span> : `Vence dia ${Number(t.date.slice(8))}`

  const filterCat = categories.find((c) => c.id === categoryFilter)
  return (
    <div className="flex flex-col gap-6">
      {filterCat && (
        <div className="shadow-soft -mb-2 flex items-center justify-between gap-2 rounded-[1rem] bg-surface px-3 py-2">
          <span className="flex items-center gap-2 font-semibold">
            <CategoryIcon category={filterCat} size="sm" /> {filterCat.name}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearFilter}>
            Ver tudo
          </Button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2.5">

        {[
          ['Entrou', s.income, ''],
          ['Saiu', s.committed + s.daily, ''],
          ['Sobra', s.free, s.free < 0 ? 'text-danger-strong' : 'text-primary-strong'],
        ].map(([label, cents, cls]) => (
          <Card key={label as string} className="px-3 py-3">
            <p className="text-[0.8125rem] text-muted">{label}</p>
            <p className={`num text-[1.0625rem] font-semibold ${cls}`}>{formatBRL(cents as number)}</p>
          </Card>
        ))}
      </div>
      {future && <p className="-mt-3 px-1 text-[0.875rem] text-muted">Mês que ainda não chegou: salário e fixos aparecem como previstos.</p>}

      {incomes.length > 0 && <List header="Rendas">{incomes.map((t) => row(t, t.type === 'salario' ? 'Salário' : 'Renda extra'))}</List>}
      {fixed.length > 0 && (
        <List header="Gastos fixos" footer={<Link to="/voce/fixos" className="font-medium text-primary">Gerenciar gastos fixos</Link>}>
          {fixed.map((t) => row(t, billStatus(t)))}
        </List>
      )}
      {parcels.length > 0 && <List header="Parcelas">{parcels.map((t) => row(t, billStatus(t)))}</List>}

      {days.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 text-center text-muted">
          <MascotArt name="tela-lancamentos" px={130} />
          {future ? 'Nada lançado para este mês ainda.' : 'Nenhum gasto do dia a dia neste mês.'}
        </Card>
      ) : (
        days.map((d) => (
          <List key={d} header={`${relativeDay(d, today)} · ${formatBRL(daily.filter((t) => t.date === d).reduce((a, t) => a + t.amount_cents, 0))}`}>
            {daily.filter((t) => t.date === d).map((t) => row(t))}
          </List>
        ))
      )}
      {!future && (
        <List footer={out.length > 0 ? 'Dinheiro que entrou na conta do banco e transferências entre contas suas aparecem no extrato, mas não entram na conta do mês.' : undefined}>
          <Row title="Extrato completo" subtitle="Busca, filtros e arquivo para baixar" chevron as={link(`/extrato?mes=${monthKey(ym)}`)} />
          {out.length > 0 && <Row title="Não contam no mês" trailing={String(out.length)} chevron as={link(`/extrato?mes=${monthKey(ym)}&ver=fora`)} />}
        </List>
      )}
    </div>
  )
}

function Budget({ ym, data }: { ym: YearMonth; data: ViewData }) {
  const { statuses, txs, categories, summary, history } = data
  const recurrings = useRecurrings()
  const [covering, setCovering] = useState<CategoryStatus | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const r = rule503020(txs, categories, summary.save)
  const subs = subscriptions(recurrings.data ?? [], history)
  const sorted = [...statuses].sort((a, b) => Number(b.limit != null) - Number(a.limit != null) || b.spent - a.spent)
  const limited = statuses.filter((s) => s.limit != null)
  const totalLimit = limited.reduce((a, s) => a + (s.limit ?? 0), 0)
  const totalSpent = statuses.reduce((a, s) => a + s.spent, 0)
  const limitedSpent = limited.reduce((a, s) => a + s.spent, 0)

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[1.125rem] font-bold">Orçamento total</p>
          {limited.length > 0 && (
            <p className={`text-[0.9375rem] font-semibold ${totalLimit - limitedSpent < 0 ? 'text-danger-strong' : 'text-primary-strong'}`}>
              Restante: <AnimatedMoney cents={totalLimit - limitedSpent} />
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar className="flex-1" value={totalLimit ? limitedSpent / totalLimit : 0} tone={limitedSpent > totalLimit ? 'danger' : limitedSpent >= totalLimit * 0.8 ? 'warn' : 'grow'} label="Orçamento total" />
          <span className="num w-11 text-right text-[0.9375rem] font-semibold">{totalLimit ? `${Math.round((limitedSpent / totalLimit) * 100)}%` : '–'}</span>
        </div>
        <div className="mt-2 flex justify-between text-[0.875rem] text-muted">
          <span>Orçamento {limited.length ? formatBRL(totalLimit) : 'não definido'}</span>
          <span>Gasto {formatBRL(totalSpent)}</span>
        </div>
      </Card>

      <section>
        <h2 className="mb-1.5 px-4 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Por categoria</h2>
        <ul className="stagger shadow-soft overflow-hidden rounded-[1.25rem] bg-surface">
          {sorted.map((s, i) => (
            <BudgetRow key={s.category.id} s={s} i={i} onEdit={() => setEditing(s.category)} onCover={() => setCovering(s)} />
          ))}
        </ul>
        <p className="mt-1.5 px-4 text-[0.8125rem] text-muted">Toque numa categoria para definir o limite do mês ou da semana. Alerta em 80% e 100%.</p>
      </section>

      <Card>
        <p className="font-bold">Regra 50/30/20</p>
        <p className="mt-0.5 text-[0.875rem] leading-snug text-muted">Um guia: metade da renda para necessidades, 30% para desejos e 20% para guardar.</p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="bg-ink" style={{ width: `${Math.min(r.pct.needs, 100)}%` }} />
          <div className="bg-coral" style={{ width: `${Math.min(r.pct.wants, Math.max(0, 100 - r.pct.needs))}%` }} />
          <div className="bg-grow" style={{ width: `${Math.min(r.pct.save, Math.max(0, 100 - r.pct.needs - r.pct.wants))}%` }} />
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-[0.8125rem]">
          {[
            ['Necessidades', r.pct.needs, 50, 'bg-ink', r.pct.needs > 50],
            ['Desejos', r.pct.wants, 30, 'bg-coral', r.pct.wants > 30],
            ['Guardar', r.pct.save, 20, 'bg-grow', r.pct.save < 20],
          ].map(([label, pct, goal, dot, off]) => (
            <li key={label as string}>
              <span className="flex items-center gap-1.5 text-muted">
                <span className={`size-2 rounded-full ${dot}`} /> {label}
              </span>
              <span className={`num text-[1.0625rem] font-bold ${off ? 'text-warn-strong' : ''}`}>{pct as number}%</span>
              <span className="text-muted"> / {goal as number}%</span>
            </li>
          ))}
        </ul>
        {r.income === 0 && <p className="mt-2 text-[0.875rem] text-muted">Sem renda lançada neste mês.</p>}
      </Card>

      <List header="O que se repete" footer={subs.items.length ? `Somando tudo, ${formatBRL(subs.yearlyCents)} por ano. Vale cancelar alguma?` : undefined}>
        {subs.items.length === 0 ? (
          <Row title={<span className="text-muted">Nenhuma assinatura encontrada</span>} />
        ) : (
          subs.items.map((i) => (
            <Row
              key={i.key}
              icon={<CategoryIcon category={categories.find((c) => c.id === i.categoryId)} size="sm" />}
              title={i.description}
              subtitle={`${formatBRL(i.monthlyCents)} por mês${i.source === 'detectado' ? ' · parece assinatura' : ''}`}
              trailing={<span className="num text-[0.9375rem] text-muted">{formatBRL(i.yearlyCents)}/ano</span>}
            />
          ))
        )}
      </List>

      <CoverSheet ym={ym} status={covering} statuses={statuses} onClose={() => setCovering(null)} />
      <CategorySheet category={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function BudgetRow({ s, i, onEdit, onCover }: { s: CategoryStatus; i: number; onEdit: () => void; onCover: () => void }) {
  const tone = s.level === 'over' ? 'danger' : s.level === 'warn' ? 'warn' : 'grow'
  const left = s.limit != null ? s.limit - s.spent : null
  return (
    <li className="border-b border-line last:border-0" style={{ '--i': i } as CSSProperties}>
      <button type="button" onClick={onEdit} className="w-full px-4 pt-3.5 pb-3 text-left transition active:bg-surface-2">
        <div className="flex items-center gap-3">
          <CategoryIcon category={s.category} size="sm" />
          <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold">{s.category.name}</p>
          {left != null ? (
            <p className={`text-[0.875rem] font-semibold whitespace-nowrap ${left < 0 ? 'text-danger-strong' : 'text-ink'}`}>
              <span className="font-medium text-muted">Restante: </span>
              {left < 0 ? '−' : ''}
              {formatBRL(Math.abs(left))}
            </p>
          ) : (
            <p className="text-[0.875rem] text-muted">Não definido</p>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar className="flex-1" value={s.limit ? s.spent / s.limit : 0} tone={tone} label={`${s.category.name}: gasto do mês`} />
          <span className="num w-11 text-right text-[0.875rem] font-semibold">{s.limit ? `${Math.round((s.spent / s.limit) * 100)}%` : '–'}</span>
        </div>
        <div className="mt-1.5 flex justify-between text-[0.8125rem] text-muted">
          <span>Orçamento {s.limit != null ? formatBRL(s.limit) : 'não definido'}</span>
          <span>Gasto {formatBRL(s.spent)}</span>
        </div>
        {s.weekLimit != null && (
          <p className={`mt-1 text-[0.8125rem] ${s.weekLevel === 'over' ? 'text-danger-strong' : s.weekLevel === 'warn' ? 'text-warn-strong' : 'text-muted'}`}>
            Semana: {formatBRL(s.weekSpent)} de {formatBRL(s.weekLimit)}
            {s.weekLevel !== 'ok' ? ' ▲' : ''}
          </p>
        )}
      </button>
      {(s.level !== 'ok' || s.weekLevel !== 'ok') && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pl-[3.75rem]">
          {levelText(s)}
          {s.level === 'over' && (
            <Button variant="soft" size="sm" onClick={onCover}>
              Cobrir com outra categoria
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/** Estourou? Em vez de ficar no vermelho, tira de uma categoria que ainda tem sobra (estilo YNAB). */
function CoverSheet({ ym, status, statuses, onClose }: { ym: YearMonth; status: CategoryStatus | null; statuses: CategoryStatus[]; onClose: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const need = status ? status.spent - (status.limit ?? 0) : 0
  const options = status ? coverOptions(statuses, status.category.id) : []

  async function cover(from: Category, available: number) {
    if (!status) return
    const amount = Math.min(need, available)
    try {
      await write.mutateAsync((b) => b.insert('budget_moves', [{ month: monthKey(ym), from_category: from.id, to_category: status.category.id, amount_cents: amount }]))
      toast(`${formatBRL(amount)} de ${from.name} para ${status.category.name}`)
      onClose()
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <Sheet open={Boolean(status)} onClose={onClose} title="Cobrir o que passou">
      {status && (
        <>
          <p className="mb-4 text-center leading-snug text-muted">
            {status.category.name} passou <strong className="text-ink">{formatBRL(need)}</strong>. De onde tirar, só neste mês?
          </p>
          {options.length === 0 ? (
            <Card className="text-center text-muted">Nenhuma categoria com sobra. Tudo bem: no mês que vem a gente ajusta os limites.</Card>
          ) : (
            <List>
              {options.map((o) => (
                <Row
                  key={o.category.id}
                  icon={<CategoryIcon category={o.category} size="sm" />}
                  title={o.category.name}
                  subtitle={`Sobram ${formatBRL(o.available)}`}
                  trailing={<span className="font-medium text-primary">Tirar {formatBRL(Math.min(need, o.available))}</span>}
                  onClick={() => cover(o.category, o.available)}
                />
              ))}
            </List>
          )}
        </>
      )}
    </Sheet>
  )
}

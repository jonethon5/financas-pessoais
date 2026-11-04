import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, ErrorBox, List, Money, NavBar, ProgressBar, Row, Segmented, Spinner } from '../components/ui'
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
  const tab = params.get('aba') === 'orcamento' ? 'orcamento' : 'lancamentos'
  const view = useMonthView(ym)
  const set = (patch: Record<string, string>) => setParams({ mes: monthKey(ym), aba: tab, ...patch }, { replace: true })

  return (
    <>
      <NavBar title="Mês" />
      <div className="mb-4 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => set({ mes: monthKey(addMonths(ym, -1)) })} className="grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
          <ChevronLeft className="size-6" />
        </button>
        <p className="text-[1.0625rem] font-semibold">{monthLabel(ym)}</p>
        <button type="button" aria-label="Próximo mês" onClick={() => set({ mes: monthKey(addMonths(ym, 1)) })} className="grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
          <ChevronRight className="size-6" />
        </button>
      </div>
      <Segmented
        label="Ver"
        value={tab}
        onChange={(aba) => set({ aba })}
        options={[
          { value: 'lancamentos', label: 'Lançamentos' },
          { value: 'orcamento', label: 'Orçamento' },
        ]}
      />
      <div className="mt-5">
        {view.isPending ? (
          <Spinner />
        ) : view.error || !view.data ? (
          <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
        ) : tab === 'lancamentos' ? (
          <Entries ym={ym} data={view.data} />
        ) : (
          <Budget ym={ym} data={view.data} />
        )}
      </div>
    </>
  )
}

type ViewData = NonNullable<ReturnType<typeof useMonthView>['data']>

function Entries({ ym, data }: { ym: YearMonth; data: ViewData }) {
  const { txs, summary: s, categories, today } = data
  const future = compareYearMonth(ym, currentYearMonth()) > 0
  const live = txs.filter((t) => !t.skipped)
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

  return (
    <div className="flex flex-col gap-6">
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
        <Card className="text-center text-muted">{future ? 'Nada lançado para este mês ainda.' : 'Nenhum gasto do dia a dia neste mês.'}</Card>
      ) : (
        days.map((d) => (
          <List key={d} header={`${relativeDay(d, today)} · ${formatBRL(daily.filter((t) => t.date === d).reduce((a, t) => a + t.amount_cents, 0))}`}>
            {daily.filter((t) => t.date === d).map((t) => row(t))}
          </List>
        ))
      )}
    </div>
  )
}

function Budget({ ym, data }: { ym: YearMonth; data: ViewData }) {
  const { statuses, txs, categories, summary, history } = data
  const recurrings = useRecurrings()
  const [covering, setCovering] = useState<CategoryStatus | null>(null)
  const r = rule503020(txs, categories, summary.save)
  const subs = subscriptions(recurrings.data ?? [], history)
  const withLimit = statuses.filter((s) => s.limit != null || s.weekLimit != null)
  const without = statuses.filter((s) => s.limit == null && s.weekLimit == null && s.spent > 0)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="font-semibold">Regra 50/30/20</p>
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
              <span className={`num text-[1.0625rem] font-semibold ${off ? 'text-warn-strong' : ''}`}>{pct as number}%</span>
              <span className="text-muted"> / {goal as number}%</span>
            </li>
          ))}
        </ul>
        {r.income === 0 && <p className="mt-2 text-[0.875rem] text-muted">Sem renda lançada neste mês.</p>}
      </Card>

      <section>
        <List header="Limites por categoria" footer={<Link to="/voce/categorias" className="font-medium text-primary">Definir limites</Link>}>
          {withLimit.length === 0 ? (
            <Row title={<span className="text-muted">Nenhum limite definido ainda</span>} />
          ) : (
            withLimit.map((s) => <BudgetRow key={s.category.id} s={s} onCover={() => setCovering(s)} />)
          )}
        </List>
      </section>

      {without.length > 0 && (
        <List header="Sem limite">
          {without.map((s) => (
            <Row key={s.category.id} icon={<CategoryIcon category={s.category} size="sm" />} title={s.category.name} trailing={<Money cents={s.spent} className="text-muted" />} as={link('/voce/categorias')} />
          ))}
        </List>
      )}

      <section>
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
      </section>

      <CoverSheet ym={ym} status={covering} statuses={statuses} onClose={() => setCovering(null)} />
    </div>
  )
}

function BudgetRow({ s, onCover }: { s: CategoryStatus; onCover: () => void }) {
  const tone = s.level === 'over' ? 'danger' : s.level === 'warn' ? 'warn' : 'grow'
  return (
    <li className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <CategoryIcon category={s.category} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[1.0625rem]">{s.category.name}</p>
            <p className="num text-[0.9375rem] whitespace-nowrap">
              {formatBRL(s.spent)}
              {s.limit != null && <span className="text-muted"> de {formatBRL(s.limit)}</span>}
            </p>
          </div>
          {s.limit != null && <ProgressBar className="mt-1.5" value={s.limit > 0 ? s.spent / s.limit : 1} tone={tone} label={`${s.category.name}: gasto do mês`} />}
          {s.weekLimit != null && (
            <p className={`mt-1 text-[0.8125rem] ${s.weekLevel === 'over' ? 'text-danger-strong' : s.weekLevel === 'warn' ? 'text-warn-strong' : 'text-muted'}`}>
              Semana: {formatBRL(s.weekSpent)} de {formatBRL(s.weekLimit)}
              {s.weekLevel === 'over' ? ' ▲' : ''}
            </p>
          )}
        </div>
      </div>
      {(s.level !== 'ok' || s.weekLevel !== 'ok') && <div className="mt-2 pl-11">{levelText(s)}</div>}
      {s.level === 'over' && (
        <Button variant="soft" size="sm" className="mt-2 ml-11" onClick={onCover}>
          Cobrir com outra categoria
        </Button>
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

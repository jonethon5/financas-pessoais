import { type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { MonthFlow } from '../components/MonthFlow'
import { TxIcon } from '../components/TxIcon'
import { FromAccount } from '../components/FromAccount'
import { useAccounts } from '../data/accounts'
import { isTransfer, movementOf, txTitle } from '../lib/statement'
import { Tour } from '../components/Tour'
import { Badge, Button, Card, ErrorBox, List, Money, NavBar, Row, Segmented, Spinner } from '../components/ui'
import { MascotArt } from '../components/Pig'
import { ChartCard, MonthBars } from './ChartsPage'
import { useHistory } from '../data/finance'
import { monthlySeries } from '../lib/charts'
import { useMonthView } from '../data/monthView'
import type { CategoryStatus } from '../lib/budget'
import { addMonths, compareYearMonth, currentYearMonth, monthKey, monthLabel, parseMonthKey, relativeDay, type YearMonth } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
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
  const tab = tabParam === 'lancamentos' ? tabParam : 'resumo'
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
          { target: 'mes-abas', title: 'Resumo e lançamentos', text: 'No Resumo, a conta do mês e para onde foi o dinheiro. Em Lançamentos, cada gasto e renda.' },
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
        ]}
      />
      </div>
      <div className="mt-5" key={`${monthKey(ym)}-${tab}`}>
        {view.isPending ? (
          <Spinner />
        ) : view.error || !view.data ? (
          <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
        ) : tab === 'resumo' ? (
          <Summary ym={ym} data={view.data} onCategory={(id) => set({ aba: 'lancamentos', cat: id })} />
        ) : (
          <Entries ym={ym} data={view.data} categoryFilter={cat} onClearFilter={() => set({ cat: null })} />
        )}
      </div>
    </>
  )
}

type ViewData = NonNullable<ReturnType<typeof useMonthView>['data']>

/**
 * Resumo: a conta do mês (separada por fixos, parcelas, cartão e Pix), para onde foi o dinheiro por categoria
 * (com o limite, quando tem) e como os gastos andaram nos últimos 6 meses.
 */
function Summary({ ym, data, onCategory }: { ym: YearMonth; data: ViewData; onCategory: (id: string) => void }) {
  const { txs, categories, summary: s, statuses, isCurrent } = data
  const history = useHistory(6)
  const byCat = new Map<string, number>()
  for (const t of txs) if (!t.skipped && t.kind === 'expense') byCat.set(t.category_id ?? 'sem', (byCat.get(t.category_id ?? 'sem') ?? 0) + t.amount_cents)
  const rows = [...byCat.entries()]
    .map(([id, cents]) => ({ id, cents, category: categories.find((c) => c.id === id), status: statuses.find((x) => x.category.id === id) }))
    .sort((a, b) => b.cents - a.cents)
  const total = rows.reduce((a, x) => a + x.cents, 0)
  const all = [...new Map([...(history.data ?? []), ...txs].map((t) => [t.id, t])).values()]
  const series = monthlySeries(all, ym, 6)
  const i = (n: number) => ({ '--i': n }) as CSSProperties

  return (
    <div className="stagger flex flex-col gap-5">
      <div style={i(0)}>
        <Card className="p-4">
          <MonthFlow s={s} txs={txs} current={isCurrent} />
        </Card>
      </div>
      <section style={i(1)}>
        <h2 className="mb-1.5 px-1 text-[1.0625rem] font-bold">Para onde foi o dinheiro</h2>
        {rows.length === 0 ? (
          <Card className="text-center text-muted">Nenhum gasto neste mês.</Card>
        ) : (
          <List footer={<Link to="/voce/categorias" className="font-semibold text-primary-strong">Limites por categoria</Link>}>
            {rows.map((x) => {
              const limit = x.status?.limit ?? null
              return (
                <Row
                  key={x.id}
                  icon={<CategoryIcon category={x.category ?? { icon: 'receipt', color: '#B8C0C8' }} size="sm" />}
                  title={x.category?.name ?? 'Sem categoria'}
                  subtitle={
                    limit ? (
                      <span className={x.status!.level === 'over' ? 'font-medium text-danger-strong' : x.status!.level === 'warn' ? 'font-medium text-warn-strong' : ''}>
                        {Math.round((x.cents / limit) * 100)}% do limite de {formatBRL(limit).replace(/,00$/, '')}
                      </span>
                    ) : (
                      `${total ? Math.round((x.cents / total) * 100) : 0}% dos gastos`
                    )
                  }
                  trailing={<Money cents={x.cents} className="text-[1rem] font-semibold" />}
                  chevron={x.id !== 'sem'}
                  onClick={x.id !== 'sem' ? () => onCategory(x.id) : undefined}
                />
              )
            })}
          </List>
        )}
      </section>
      {series.some((m) => Number(m.expense) > 0) && (
        <div style={i(2)}>
          <ChartCard title="Gastos nos últimos 6 meses">
            <MonthBars data={series} field="expense" selectedKey={monthKey(ym)} label="Gastos" />
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function Entries({ ym, data, categoryFilter, onClearFilter }: { ym: YearMonth; data: ViewData; categoryFilter: string | null; onClearFilter: () => void }) {
  const { txs: allTxs, categories, today } = data
  const txs = categoryFilter ? allTxs.filter((t) => t.category_id === categoryFilter) : allTxs
  const future = compareYearMonth(ym, currentYearMonth()) > 0
  const live = txs.filter((t) => !t.skipped)
  // Veio do banco e não conta (entrada que não é renda, Pix entre contas próprias)
  const out = txs.filter((t) => t.skipped && t.source === 'banco')

  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const accounts = useAccounts()
  const incomes = live.filter((t) => t.kind === 'income')
  const fixed = live.filter((t) => t.type === 'fixo')
  const parcels = live.filter((t) => t.type === 'parcela')
  const daily = live.filter((t) => t.type === 'dia').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const days = [...new Set(daily.map((t) => t.date))]

  const row = (t: MonthTx, subtitle?: ReactNode) => (
    <Row
      key={t.id}
      icon={<TxIcon description={t.description} category={catOf(t.category_id)} flow={isTransfer(t, accounts.raw) ? movementOf(t, accounts.raw).flow : null} />}
      title={`${txTitle(t)}${t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}`}
      subtitle={subtitle ?? (t.bank_account_id ? <FromAccount info={accounts.byId(t.bank_account_id)} extra={[isTransfer(t, accounts.raw) ? movementOf(t, accounts.raw).label : null, catOf(t.category_id)?.name].filter(Boolean).join(' · ') || null} /> : catOf(t.category_id)?.name)}
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
      {future && <p className="px-1 text-[0.875rem] text-muted">Mês que ainda não chegou: salário e fixos aparecem como previstos.</p>}

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

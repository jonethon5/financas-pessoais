import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BankLogo } from '../components/BankLogo'
import { CategoryDonut } from '../components/CategoryDonut'
import { CategoryIcon } from '../components/CategoryIcon'
import { Chip, ErrorBox, NavBar, Segmented, Spinner } from '../components/ui'
import { useHistory, useTable } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { average, balanceProjection, byCategory, byMethod, byRecurrence, dailySpend, monthlySeries, salaryFlow, savedSeries, type CatShare, type Part } from '../lib/charts'
import { addMonths, compareYearMonth, currentYearMonth, monthKey, monthLabel, monthsBetween, parseMonthKey, weekdayOf, firstDayISO } from '../lib/dates'
import { financialHealth } from '../lib/health'
import { findInstitution } from '../lib/institutions'
import { formatBRL } from '../lib/money'
import { useHiddenValues } from '../lib/privacy'
import { friendlyError } from '../lib/supabase'
import { liftForDark, useIsDark } from '../lib/theme'
import { HealthRing, scoreColor } from './HealthPage'
import { Tour } from '../components/Tour'
import { Reveal } from '../components/Reveal'

const SERIES = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)']
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Valor em reais respeitando o "esconder valores" (olho). */
function useMoney() {
  const hidden = useHiddenValues()
  return (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
}
// Eixo: "2,4 mil" com espaço que não quebra (senão o rótulo vira duas linhas)
const short = (c: number) => (Math.abs(c) >= 100000 ? `${(c / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${Math.round(c / 100)}`)

function ChartCard({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Reveal>
    <section className="rounded-[1.25rem] bg-surface p-4">
      <h2 className="text-[1.0625rem] font-extrabold">{title}</h2>
      {hint && <p className="mt-0.5 text-[0.875rem] leading-snug text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
    </Reveal>
  )
}

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-[0.75rem] border border-line bg-bg px-3 py-2 text-[0.8125rem] shadow-lg">
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted">
          {r.color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: r.color, borderTop: r.dashed ? `2px dashed ${r.color}` : undefined, height: r.dashed ? 0 : undefined }} />}
          <span>{r.label}</span>
          <span className="num ml-auto pl-3 font-semibold text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Ranking por categoria: ícone, nome, valor, % e uma barra fina na cor da categoria. */
function Ranking({ items, max = 8 }: { items: CatShare[]; max?: number }) {
  const money = useMoney()
  const dark = useIsDark()
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, max)
  const top = items[0]?.cents || 1
  if (!items.length) return <p className="text-muted">Nada neste mês.</p>
  return (
    <>
      <ol className="flex flex-col gap-3">
        {shown.map((c, i) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="w-4 text-right text-[0.8125rem] font-semibold text-muted">{i + 1}</span>
            <CategoryIcon category={{ icon: c.icon ?? 'receipt', color: c.color }} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold">{c.name}</span>
                <span className="num shrink-0 text-[0.9375rem] font-semibold">{money(c.cents)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full" style={{ width: `${(c.cents / top) * 100}%`, background: liftForDark(c.color, dark) }} />
                </span>
                <span className="num w-9 text-right text-[0.75rem] text-muted">{pct(c.pct)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {items.length > max && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-[0.9375rem] font-semibold text-primary">
          {all ? 'Ver menos' : `Ver todas (${items.length})`}
        </button>
      )}
    </>
  )
}

/** Barra de partes de um todo (fixos/parcelas/dia a dia…) com legenda que diz valor e % (nunca só cor). */
function PartsBar({ parts, colors = SERIES, empty = 'Nada neste mês.' }: { parts: Part[]; colors?: string[]; empty?: string }) {
  const money = useMoney()
  const shown = parts.filter((p) => p.cents > 0)
  if (!shown.length) return <p className="text-muted">{empty}</p>
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={shown.map((p) => `${p.label} ${pct(p.pct)}`).join(', ')}>
        {parts.map((p, i) => (p.cents > 0 ? <span key={p.key} title={`${p.label}: ${money(p.cents)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${p.pct * 100}%`, background: colors[i % colors.length] }} /> : null))}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2.5 text-[0.9375rem]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="flex-1">{p.label}</span>
            <span className="num font-semibold">{money(p.cents)}</span>
            <span className="num w-10 text-right text-[0.8125rem] text-muted">{pct(p.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Evolução de uma série por mês (barras), com a média tracejada e o mês escolhido em destaque. */
function MonthBars({ data, field, selectedKey, label }: { data: { key: string; label: string; [k: string]: number | string }[]; field: string; selectedKey: string; label: string }) {
  const money = useMoney()
  const avg = average(data.map((d) => d[field] as number))
  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 11 }} tickFormatter={short} width={60} />
            <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].payload.label)} rows={[{ label, value: money(payload[0].value as number), color: 'var(--viz-1)' }]} /> : null)} />
            {avg > 0 && <ReferenceLine y={avg} stroke="var(--viz-axis)" strokeDasharray="4 4" />}
            <Bar dataKey={field} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.key} fill="var(--viz-1)" fillOpacity={d.key === selectedKey ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[0.8125rem] text-muted">
        Média dos meses com movimento: <strong className="text-ink">{money(avg)}</strong> (linha tracejada)
      </p>
    </>
  )
}

function IncomeVsExpense({ data }: { data: { key: string; label: string; income: number; expense: number }[] }) {
  const money = useMoney()
  return (
    <>
      <div className="mb-2 flex gap-4 text-[0.8125rem]">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: 'var(--viz-1)' }} />Renda</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: 'var(--viz-2)' }} />Gastos</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 11 }} tickFormatter={short} width={60} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox
                    title={String(payload[0].payload.label)}
                    rows={[
                      { label: 'Renda', value: money(payload[0].payload.income), color: 'var(--viz-1)' },
                      { label: 'Gastos', value: money(payload[0].payload.expense), color: 'var(--viz-2)' },
                      { label: 'Sobrou', value: money(payload[0].payload.income - payload[0].payload.expense) },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="income" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expense" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function BalanceLine({ data }: { data: { day: number; real: number | null; previsto: number | null }[] }) {
  const money = useMoney()
  const last = data.at(-1)
  return (
    <>
      <div className="mb-2 flex gap-4 text-[0.8125rem]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: 'var(--viz-1)' }} />Até hoje</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--viz-1)' }} />Previsão</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 12 }} interval={4} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 11 }} tickFormatter={short} width={60} />
            <ReferenceLine y={0} stroke="var(--viz-axis)" />
            <Tooltip
              cursor={{ stroke: 'var(--viz-axis)', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { day: number; real: number | null; previsto: number | null } | undefined
                if (!active || !p) return null
                return <TipBox title={`Dia ${p.day}`} rows={[p.real != null ? { label: 'Saldo', value: money(p.real), color: 'var(--viz-1)' } : { label: 'Previsto', value: money(p.previsto ?? 0), color: 'var(--viz-1)', dashed: true }]} />
              }}
            />
            <Line type="monotone" dataKey="real" stroke="var(--viz-1)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive animationDuration={700} />
            <Line type="monotone" dataKey="previsto" stroke="var(--viz-1)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last && (
        <p className="mt-2 text-[0.875rem] text-muted">
          Se continuar assim, o mês fecha com <strong className={(last.previsto ?? last.real ?? 0) < 0 ? 'text-danger-strong' : 'text-ink'}>{money(last.previsto ?? last.real ?? 0)}</strong>.
        </p>
      )}
    </>
  )
}

/** Mapa de calor dos gastos do dia a dia por dia do mês (uma cor só, do claro ao escuro). */
function Heatmap({ days, ymFirst }: { days: { day: number; date: string; cents: number }[]; ymFirst: string }) {
  const money = useMoney()
  const [pick, setPick] = useState<number | null>(null)
  const max = Math.max(...days.map((d) => d.cents), 0)
  const step = (c: number) => (c <= 0 || max === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3.999)))
  const lead = (weekdayOf(ymFirst) + 6) % 7 // semana começa na segunda
  const picked = days.find((d) => d.day === pick)
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[0.6875rem] text-muted">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setPick(d.day === pick ? null : d.day)}
            aria-label={`Dia ${d.day}: ${money(d.cents)}`}
            className={`num grid aspect-square place-items-center rounded-[0.5rem] text-[0.75rem] font-semibold ${pick === d.day ? 'ring-2 ring-ink' : ''} ${step(d.cents) >= 3 ? 'text-white' : 'text-ink'}`}
            style={{ background: `var(--viz-seq-${step(d.cents)})` }}
          >
            {d.day}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[0.8125rem] text-muted">
        <span>{picked ? <>Dia {picked.day}: <strong className="text-ink">{money(picked.cents)}</strong></> : 'Toque num dia para ver o valor'}</span>
        <span className="flex items-center gap-1">
          menos {[0, 1, 2, 3, 4].map((s) => <span key={s} className="size-3 rounded-[3px]" style={{ background: `var(--viz-seq-${s})` }} />)} mais
        </span>
      </div>
    </>
  )
}

/** Pizza (partes de um todo) com a legenda dizendo valor e %. */
function PartsPie({ parts, colors = SERIES }: { parts: Part[]; colors?: string[] }) {
  const money = useMoney()
  const shown = parts.map((p, i) => ({ ...p, color: colors[i % colors.length] })).filter((p) => p.cents > 0)
  if (!shown.length) return <p className="text-muted">Nada neste mês.</p>
  return (
    <div className="flex items-center gap-4">
      <div className="size-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="cents" nameKey="label" outerRadius="100%" startAngle={90} endAngle={-270} stroke="var(--surface)" strokeWidth={2} isAnimationActive animationDuration={800}>
              {shown.map((p) => (
                <Cell key={p.key} fill={p.color} />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].name)} rows={[{ label: pct((payload[0].payload as Part).pct), value: money(payload[0].value as number), color: (payload[0].payload as { color: string }).color }]} /> : null)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {shown.map((p) => (
          <li key={p.key} className="text-[0.9375rem]">
            <span className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="flex-1">{p.label}</span>
              <span className="num text-[0.8125rem] text-muted">{pct(p.pct)}</span>
            </span>
            <span className="num block pl-[1.125rem] font-semibold">{money(p.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Área: evolução de um total ao longo dos meses. */
function MonthArea({ data, field, label }: { data: { key: string; label: string; [k: string]: number | string }[]; field: string; label: string }) {
  const money = useMoney()
  const first = (data[0]?.[field] as number) ?? 0
  const last = (data.at(-1)?.[field] as number) ?? 0
  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="viz-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-3)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--viz-3)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 11 }} tickFormatter={short} width={60} />
            <Tooltip cursor={{ stroke: 'var(--viz-axis)', strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].payload.label)} rows={[{ label, value: money(payload[0].value as number), color: 'var(--viz-3)' }]} /> : null)} />
            <Area type="monotone" dataKey={field} stroke="var(--viz-3)" strokeWidth={2} fill="url(#viz-area)" dot={{ r: 3, fill: 'var(--viz-3)', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[0.875rem] text-muted">
        {last >= first ? 'Cresceu' : 'Diminuiu'} <strong className="text-ink">{money(Math.abs(last - first))}</strong> no período.
      </p>
    </>
  )
}

type Tab = 'despesas' | 'receitas' | 'geral'

/** Gráficos: despesas, receitas e visão geral do mês escolhido, com evolução de 6 ou 12 meses. */
export function ChartsPage() {
  const [params, setParams] = useSearchParams()
  const now = currentYearMonth()
  const ym = parseMonthKey(params.get('mes')) ?? now
  const tab = (['despesas', 'receitas', 'geral'] as const).find((t) => t === params.get('aba')) ?? 'despesas'
  const [range, setRange] = useState<6 | 12>(6)
  const back = Math.max(0, monthsBetween(ym, now))
  const view = useMonthView(ym)
  const history = useHistory(range + back)
  const accounts = useTable('bank_accounts')
  const conns = useTable('bank_connections')
  const money = useMoney()
  const set = (patch: Record<string, string>) => setParams({ mes: monthKey(ym), aba: tab, ...patch }, { replace: true })

  const header = (
    <>
      <NavBar title="Gráficos" />
      <div className="mb-3 flex items-center justify-between rounded-[1rem] bg-surface px-1 py-1">
        <button type="button" aria-label="Mês anterior" onClick={() => set({ mes: monthKey(addMonths(ym, -1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
          <ChevronLeft className="size-6" />
        </button>
        <p className="text-[1.0625rem] font-bold">{monthLabel(ym)}</p>
        <button type="button" aria-label="Próximo mês" disabled={compareYearMonth(ym, now) >= 0} onClick={() => set({ mes: monthKey(addMonths(ym, 1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2 disabled:opacity-30">
          <ChevronRight className="size-6" />
        </button>
      </div>
      <div data-tour="graficos-abas">
      <Segmented label="Ver" value={tab} onChange={(aba: Tab) => set({ aba })} options={[{ value: 'despesas', label: 'Despesas' }, { value: 'receitas', label: 'Receitas' }, { value: 'geral', label: 'Visão geral' }]} />
      </div>
      <div data-tour="graficos-periodo" className="mt-3 flex gap-2">
        <Chip selected={range === 6} onClick={() => setRange(6)}>Últimos 6 meses</Chip>
        <Chip selected={range === 12} onClick={() => setRange(12)}>12 meses</Chip>
      </div>
    </>
  )

  if (view.isPending || history.isPending) return (<>{header}<Spinner /></>)
  if (view.error || !view.data) return (<>{header}<ErrorBox message={friendlyError(view.error ?? history.error)} onRetry={view.refetch} /></>)
  const d = view.data
  const all = [...new Map([...(history.data ?? []), ...d.txs].map((t) => [t.id, t])).values()]
  const series = monthlySeries(all, ym, range)
  const key = monthKey(ym)
  const cards = (accounts.data ?? []).filter((a) => a.type === 'CREDIT')
  const labelOf = (connId: string) => (conns.data ?? []).find((c) => c.id === connId)?.label

  return (
    <>
      {header}
      <Tour
        id="graficos"
        steps={[
          { target: 'graficos-abas', title: 'Despesas, receitas e visão geral', text: 'Troque aqui para ver para onde vai o dinheiro, de onde ele vem e o resumo do mês.' },
          { target: 'graficos-periodo', title: '6 ou 12 meses', text: 'Escolha quantos meses aparecem nos gráficos de evolução.' },
        ]}
      />
      <div key={`${key}-${tab}`} className="stagger mt-5 flex flex-col gap-4 pb-4">
        {tab === 'despesas' && (
          <>
            <ChartCard title="Gastos por categoria">
              <CategoryDonut slices={byCategory(d.txs, 'expense', d.categories).map((c) => ({ id: c.id, name: c.name, color: c.color, cents: c.cents }))} label="Gastos do mês" />
            </ChartCard>
            <ChartCard title="Ranking das categorias" hint="Onde o dinheiro mais foi neste mês.">
              <Ranking items={byCategory(d.txs, 'expense', d.categories)} />
            </ChartCard>
            <ChartCard title="Por recorrência" hint="O que se repete todo mês e o que é do dia a dia.">
              <PartsPie parts={byRecurrence(d.txs, 'expense')} />
            </ChartCard>
            <ChartCard title="Débito × crédito" hint="Só os gastos que vieram do banco têm a forma de pagamento.">
              <PartsBar parts={byMethod(d.txs, accounts.data ?? [])} />
            </ChartCard>
            {cards.length > 0 && (
              <ChartCard title="Cartões de crédito">
                <div className="flex flex-col gap-4">
                  {cards.map((c) => {
                    const used = c.credit_limit_cents != null && c.available_cents != null ? c.credit_limit_cents - c.available_cents : (c.balance_cents ?? 0)
                    const limit = c.credit_limit_cents ?? 0
                    const inst = findInstitution(c.name, labelOf(c.connection_id))
                    return (
                      <div key={c.id}>
                        <div className="flex items-center gap-3">
                          <BankLogo inst={inst} credit size="sm" />
                          <div className="flex-1">
                            <p className="font-semibold">{inst?.name ?? c.name}</p>
                            <p className="text-[0.8125rem] text-muted">Fatura atual {money(c.balance_cents ?? 0)}</p>
                          </div>
                        </div>
                        {limit > 0 && (
                          <PartsBar
                            colors={['var(--viz-2)', 'var(--surface-2)']}
                            parts={[
                              { key: 'usado', label: 'Limite usado', cents: used, pct: used / limit },
                              { key: 'livre', label: 'Limite disponível', cents: Math.max(0, limit - used), pct: Math.max(0, limit - used) / limit },
                            ]}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </ChartCard>
            )}
            <ChartCard title={`Evolução dos gastos (${range} meses)`}>
              <MonthBars data={series} field="expense" selectedKey={key} label="Gastos" />
            </ChartCard>
            <ChartCard title="Dias em que você mais gastou" hint="Só o dia a dia (sem contas fixas e parcelas).">
              <Heatmap days={dailySpend(d.txs, ym)} ymFirst={firstDayISO(ym)} />
            </ChartCard>
          </>
        )}

        {tab === 'receitas' && (
          <>
            <ChartCard title="Renda por categoria">
              <CategoryDonut slices={byCategory(d.txs, 'income', d.categories).map((c) => ({ id: c.id, name: c.name, color: c.color, cents: c.cents }))} label="Renda do mês" />
            </ChartCard>
            <ChartCard title="Ranking das rendas">
              <Ranking items={byCategory(d.txs, 'income', d.categories)} />
            </ChartCard>
            <ChartCard title="Por recorrência" hint="Salário (todo mês) e rendas extras (freela, 13º, Pix recebido).">
              <PartsPie parts={byRecurrence(d.txs, 'income')} />
            </ChartCard>
            <ChartCard title={`Evolução da renda (${range} meses)`}>
              <MonthBars data={series} field="income" selectedKey={key} label="Renda" />
            </ChartCard>
          </>
        )}

        {tab === 'geral' && (() => {
          const health = financialHealth({ today: d.today, monthTxs: d.txs, history: d.history, goals: d.goals, goalMoves: d.goalMoves, categories: d.categories, hasSalary: d.profile.salary_cents != null && d.profile.payday != null })
          return (
            <>
              <Link to="/saude" className="press flex items-center gap-4 rounded-[1.25rem] bg-surface p-4">
                <HealthRing score={health.score} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] text-muted">Saúde financeira</p>
                  <p className="text-[1.125rem] font-bold" style={{ color: scoreColor(health.score) }}>{health.label}</p>
                  {health.next[0] && <p className="text-[0.875rem] leading-snug text-muted">{health.next[0].tip}</p>}
                </div>
                <ChevronRight className="size-5 text-faint" />
              </Link>
              <ChartCard title="Para onde vai o dinheiro do mês" hint="A renda do mês dividida: contas, dia a dia, caixinhas e o que sobra (igual à tela inicial).">
                <PartsBar parts={salaryFlow(d.summary)} colors={['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--surface-2)']} empty="Informe o salário ou lance uma renda para ver." />
              </ChartCard>
              <ChartCard title="Saldo do mês dia a dia" hint="Linha cheia: o que já aconteceu. Tracejada: a previsão com as contas que vão vencer e o seu ritmo de gastos.">
                <BalanceLine data={balanceProjection(d.txs, ym, d.today)} />
              </ChartCard>
              <ChartCard title={`Renda × gastos (${range} meses)`}>
                <IncomeVsExpense data={series} />
              </ChartCard>
              <ChartCard title="Evolução do que você guardou" hint="Total nas caixinhas no fim de cada mês.">
                <MonthArea data={savedSeries(d.goalMoves, ym, range)} field="saved" label="Guardado" />
              </ChartCard>
            </>
          )
        })()}
      </div>
    </>
  )
}

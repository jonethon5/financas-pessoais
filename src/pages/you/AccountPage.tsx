import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BankLogo } from '../../components/BankLogo'
import { Pig, mascotName, usePigColor } from '../../components/Pig'
import { BackButton, Card, ErrorBox, Money, NavBar, ProgressBar, Spinner } from '../../components/ui'
import { useCategories, useHistory, useMonthTxs, useTable } from '../../data/finance'
import { byCategory, monthlySeries } from '../../lib/charts'
import { addMonths, currentYearMonth, formatDateShort, monthKey, monthLabel, parseMonthKey } from '../../lib/dates'
import { accountTitle, findInstitution } from '../../lib/institutions'
import { insightTips, insights } from '../../lib/statement'
import { friendlyError } from '../../lib/supabase'
import { ChartCard, MonthBars, Ranking, TipBox, short, useMoney } from '../ChartsPage'
import { EMOTIONS } from '../TxFormPage'

const DAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * /voce/bancos/:id: painel de uma conta ou cartão conectado. Mostra para onde foi o dinheiro que passou por ali,
 * em que dias e lugares, e o que o mascote percebeu. Só leitura: são os lançamentos que já estão no app.
 */
export function AccountPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ym = parseMonthKey(params.get('mes')) ?? currentYearMonth()
  const accounts = useTable('bank_accounts')
  const conns = useTable('bank_connections')
  const categories = useCategories()
  const month = useMonthTxs(ym)
  const history = useHistory(6)
  const money = useMoney()
  const pigName = mascotName(usePigColor())

  const account = accounts.data?.find((a) => a.id === id)
  const mine = useMemo(() => (month.data ?? []).filter((t) => t.bank_account_id === id && !t.virtual), [month.data, id])
  const stats = useMemo(() => insights(mine), [mine])
  const cats = useMemo(() => byCategory(mine, 'expense', categories.data ?? []), [mine, categories.data])
  const series = useMemo(() => monthlySeries((history.data ?? []).filter((t) => t.bank_account_id === id), ym, 6), [history.data, id, ym])

  if (accounts.isPending || categories.isPending || month.isPending) return <Spinner />
  if (month.isError) return <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
  if (!account) return <ErrorBox message="Essa conta não está mais conectada." />

  const credit = account.type === 'CREDIT'
  const inst = findInstitution(account.name, conns.data?.find((c) => c.id === account.connection_id)?.label)
  const title = accountTitle(inst, account.type, account.name)
  const tips = insightTips(stats, cats[0] ? { name: cats[0].name, cents: cats[0].cents, pct: cats[0].pct } : null)
  const outOfCount = mine.filter((t) => t.skipped).length
  const topDay = [...stats.weekdays].sort((a, b) => b.cents - a.cents)[0]
  const emotionLabel = (e: string) => EMOTIONS.find((x) => x.value === e)?.label ?? e
  const used = credit && account.credit_limit_cents ? Math.max(0, account.credit_limit_cents - (account.available_cents ?? 0)) : null
  const setMonth = (delta: number) => setParams({ mes: monthKey(addMonths(ym, delta)) }, { replace: true })

  return (
    <>
      <NavBar title={title} large={false} left={<BackButton label="Bancos" onClick={() => navigate('/voce/bancos')} />} />
      <div className="flex flex-col gap-4 pt-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <BankLogo inst={inst} credit={credit} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.0625rem] font-extrabold">{title}</p>
              <p className="truncate text-[0.875rem] text-muted">{credit ? `Fatura atual${account.due_date ? ` · vence ${formatDateShort(account.due_date)}` : ''}` : 'Saldo na conta'}</p>
            </div>
            <p className="num text-[1.25rem] font-extrabold">{account.balance_cents != null ? <Money cents={account.balance_cents} /> : '—'}</p>
          </div>
          {used != null && account.credit_limit_cents ? (
            <div>
              <ProgressBar label="Limite do cartão usado" value={Math.min(1, used / account.credit_limit_cents)} tone={used / account.credit_limit_cents >= 0.8 ? 'danger' : 'grow'} />
              <p className="mt-1.5 flex justify-between text-[0.8125rem] text-muted">
                <span>
                  Usado {Math.round((used / account.credit_limit_cents) * 100)}% do limite de {money(account.credit_limit_cents)}
                </span>
                {account.available_cents != null && <span>livre {money(account.available_cents)}</span>}
              </p>
            </div>
          ) : null}
        </Card>

        <div className="shadow-soft flex items-center justify-between rounded-[1rem] bg-surface px-1 py-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(-1)} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronLeft className="size-6" />
          </button>
          <p className="text-[1.0625rem] font-bold">{monthLabel(ym)}</p>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(1)} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronRight className="size-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            ['Gasto no mês', money(stats.spent)],
            ['Compras', String(stats.count)],
            ['Compra média', stats.count ? money(stats.ticket) : '—'],
            ['Maior compra', stats.biggest ? money(stats.biggest.cents) : '—'],
          ].map(([label, value]) => (
            <Card key={label} className="px-3.5 py-3">
              <p className="text-[0.8125rem] text-muted">{label}</p>
              <p className="num text-[1.125rem] font-semibold">{value}</p>
            </Card>
          ))}
        </div>
        {stats.biggest && (
          <p className="-mt-2 px-1 text-[0.8125rem] text-muted">
            Maior compra: {stats.biggest.description}, {formatDateShort(stats.biggest.date)}
          </p>
        )}

        {stats.count === 0 ? (
          <Card className="flex flex-col items-center gap-2 text-center text-muted">
            <Pig art="tela-cartoes" px={120} still />
            Nenhum gasto {credit ? 'neste cartão' : 'nesta conta'} em {monthLabel(ym).toLowerCase()}.
          </Card>
        ) : (
          <>
            {tips.length > 0 && (
              <section className="flex items-start gap-3 rounded-[1.25rem] bg-primary-soft p-4">
                <Pig art="rosto-pensativo" px={64} still className="-mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-bold tracking-wide text-primary-strong uppercase">{pigName} reparou</p>
                  <ul className="mt-1.5 flex flex-col gap-2 text-[0.9375rem] leading-snug">
                    {tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <ChartCard title="Para onde foi" hint="Total por categoria, do maior para o menor.">
              <Ranking items={cats} max={6} />
            </ChartCard>

            <ChartCard title="Dias da semana" hint={topDay?.cents ? `O dia em que mais sai dinheiro daqui é ${topDay.label}.` : undefined}>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weekdays.map((w) => ({ ...w, short: DAY_SHORT[w.day] }))} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-axis)', fontSize: 11 }} tickFormatter={short} width={60} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }}
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <TipBox
                            title={String(payload[0].payload.label)}
                            rows={[
                              { label: 'Gasto', value: money(payload[0].value as number), color: 'var(--viz-1)' },
                              { label: 'Compras', value: String(payload[0].payload.count) },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar dataKey="cents" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={700}>
                      {stats.weekdays.map((w) => (
                        <Cell key={w.day} fill="var(--viz-1)" fillOpacity={w.day === topDay?.day ? 1 : 0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[0.8125rem] text-muted">
                Fim de semana (sábado e domingo): <strong className="text-ink">{Math.round(stats.weekendShare * 100)}%</strong> do gasto. O banco manda só o dia de cada compra, não o horário.
              </p>
            </ChartCard>

            <ChartCard title="Onde você mais passou" hint="O mesmo lugar somado, mesmo em compras separadas.">
              <ol className="flex flex-col gap-2.5">
                {stats.topPlaces.map((p, i) => (
                  <li key={p.name} className="flex items-baseline gap-3">
                    <span className="w-4 text-right text-[0.8125rem] font-semibold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 text-[0.8125rem] text-muted">{p.count === 1 ? '1 vez' : `${p.count} vezes`}</span>
                    <span className="num w-24 shrink-0 text-right text-[0.9375rem] font-semibold">{money(p.cents)}</span>
                  </li>
                ))}
              </ol>
            </ChartCard>

            <ChartCard title="Como você estava" hint="O sentimento que você marca ao lançar ou ao abrir um gasto.">
              {stats.topEmotion ? (
                <p className="leading-snug">
                  Você mais gastou quando marcou <strong>{emotionLabel(stats.topEmotion.emotion)}</strong>: {money(stats.topEmotion.cents)} em {stats.topEmotion.count === 1 ? '1 compra' : `${stats.topEmotion.count} compras`}.
                </p>
              ) : (
                <p className="leading-snug text-muted">Ainda não há sentimento marcado nos gastos daqui. Abra um gasto e toque em “Como você estava?”: em poucas semanas dá para ver em que momentos o dinheiro mais escapa.</p>
              )}
            </ChartCard>
          </>
        )}

        <ChartCard title="Últimos 6 meses" hint={`Quanto passou ${credit ? 'pelo cartão' : 'pela conta'} em cada mês.`}>
          <MonthBars data={series} field="expense" selectedKey={monthKey(ym)} label="Gasto" />
        </ChartCard>

        <Link to={`/extrato?mes=${monthKey(ym)}&conta=${account.id}`} className="press flex items-center justify-center gap-1.5 rounded-full bg-primary py-3.5 text-[1rem] font-bold text-on-primary">
          Ver o extrato {credit ? 'deste cartão' : 'desta conta'} <ChevronRight className="size-4" aria-hidden />
        </Link>
        {outOfCount > 0 && (
          <p className="px-1 text-center text-[0.8125rem] leading-snug text-muted">
            {outOfCount === 1 ? '1 movimentação daqui não conta' : `${outOfCount} movimentações daqui não contam`} no mês (entradas e transferências entre contas suas).{' '}
            <Link to={`/extrato?mes=${monthKey(ym)}&conta=${account.id}&ver=fora`} className="font-semibold text-primary">
              Ver
            </Link>
          </p>
        )}
      </div>
    </>
  )
}

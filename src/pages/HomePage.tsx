import { Link, useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { ProfileAvatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { AnimatedMoney, Badge, Button, Card, ErrorBox, List, Money, NavBar, ProgressBar, Row, Spinner } from '../components/ui'
import { useMonthView } from '../data/monthView'
import { currentYearMonth, dayOf, daysBetweenISO, formatDayLong, greeting, relativeDay } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import { levelText } from './MonthPage'

const link = (to: string) => (content: React.ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
)

export function HomePage() {
  const navigate = useNavigate()
  const view = useMonthView(currentYearMonth())
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const { profile: p, summary: s, todayBudget: t, statuses, txs, plan, categories, today } = view.data
  const name = displayName(p)
  const longDay = formatDayLong(today)
  const hasSalary = p.salary_cents != null && p.payday != null
  const catOf = (id: string | null) => categories.find((c) => c.id === id)

  const alerts = statuses.filter((x) => x.level !== 'ok' || x.weekLevel !== 'ok').slice(0, 3)
  const upcoming = txs.filter((x) => !x.skipped && !x.paid && (x.type === 'fixo' || x.type === 'parcela') && daysBetweenISO(today, x.date) >= -3 && daysBetweenISO(today, x.date) <= 7)
  const recent = [...txs].filter((x) => !x.skipped && x.type === 'dia').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5)
  const salaryArrived = hasSalary && dayOf(today) >= Math.min(p.payday!, 28)
  const needsSplit = salaryArrived && !plan?.split_done_at

  return (
    <>
      <NavBar
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle={longDay.charAt(0).toUpperCase() + longDay.slice(1)}
        right={
          <Link to="/voce" aria-label="Você">
            <ProfileAvatar profile={p} size="sm" />
          </Link>
        }
      />
      <div className="stagger flex flex-col gap-6">
        {needsSplit && (
          <Card className="bg-coral-soft shadow-none">
            <p className="text-[1.0625rem] font-semibold">Seu salário caiu</p>
            <p className="mt-1 leading-snug text-ink/80">Antes de gastar, separe o que vai para as caixinhas. Quem guarda primeiro, guarda mais.</p>
            <Button variant="primary" size="md" className="mt-3 w-full" onClick={() => navigate('/separar')}>
              Separar o salário
            </Button>
          </Card>
        )}

        {t && hasSalary ? (
          <Card className="p-5">
            <p className="text-[0.9375rem] font-medium text-muted">Você pode gastar hoje</p>
            {t.leftToday >= 0 ? (
              <AnimatedMoney cents={t.leftToday} className="mt-0.5 block text-[2.75rem] leading-tight font-extrabold tracking-[-0.03em]" />
            ) : (
              <p className="mt-1 text-[1.5rem] leading-tight font-bold text-danger-strong">▲ Passou {formatBRL(-t.leftToday)} do valor de hoje</p>
            )}
            <p className="mt-1 text-[0.9375rem] text-muted">
              {t.dailyAllowance > 0 ? (
                <>
                  <Money cents={t.dailyAllowance} /> por dia · {t.daysLeft === 1 ? 'último dia do mês' : `faltam ${t.daysLeft} dias`}
                </>
              ) : (
                'O dinheiro do dia a dia deste mês acabou. Vamos ajustar: veja o Mês.'
              )}
            </p>
            {t.dailyAllowance > 0 && <ProgressBar className="mt-3" value={t.spentToday / t.dailyAllowance} tone={t.leftToday < 0 ? 'danger' : t.spentToday >= t.dailyAllowance * 0.8 ? 'warn' : 'grow'} label="Gasto de hoje" />}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="md" onClick={() => navigate('/lancar?tipo=dia')}>
                Lançar gasto
              </Button>
              <Button size="md" variant="coral" onClick={() => navigate('/separar')}>
                Guardar
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-[1.125rem] font-semibold">Quanto você pode gastar por dia?</p>
            <p className="mt-1 leading-snug text-muted">Informe seu salário e o dia do pagamento. O app desconta os gastos fixos e o que você quer guardar e divide pelo resto do mês.</p>
            <Button size="md" className="mt-4 w-full" onClick={() => navigate('/voce')}>
              Informar salário
            </Button>
          </Card>
        )}

        <List header="Seu mês">
          <Row title="Entrou" trailing={<Money cents={s.income} className="text-[1.0625rem]" />} as={link('/mes')} />
          <Row title="Fixos e parcelas" trailing={<Money cents={s.committed} className="text-[1.0625rem] text-muted" />} as={link('/mes')} />
          <Row title="Para guardar" trailing={<Money cents={s.save} className="text-[1.0625rem] text-muted" />} as={link('/caixinhas')} />
          <Row title="Dia a dia" trailing={<Money cents={s.daily} className="text-[1.0625rem] text-muted" />} as={link('/mes')} />
          <Row title={<span className="font-semibold">Sobra prevista</span>} trailing={<Money cents={s.free} className={`text-[1.0625rem] font-semibold ${s.free < 0 ? 'text-danger-strong' : ''}`} />} />
        </List>

        {alerts.length > 0 && (
          <List header="Atenção ao orçamento">
            {alerts.map((a) => (
              <Row key={a.category.id} icon={<CategoryIcon category={a.category} size="sm" />} title={a.category.name} trailing={levelText(a)} as={link('/mes?aba=orcamento')} />
            ))}
          </List>
        )}

        {upcoming.length > 0 && (
          <List header="Contas a pagar">
            {upcoming.map((x) => {
              const d = daysBetweenISO(today, x.date)
              return (
                <Row
                  key={x.id}
                  icon={<CategoryIcon category={catOf(x.category_id)} size="sm" />}
                  title={`${x.description}${x.installment_no ? ` ${installmentLabel(x.installment_no, x.installment_total)}` : ''}`}
                  subtitle={d < 0 ? `Venceu ${relativeDay(x.date, today).toLowerCase()}` : d === 0 ? 'Vence hoje' : `Vence ${d === 1 ? 'amanhã' : `em ${d} dias`}`}
                  trailing={
                    <span className="flex items-center gap-2">
                      {d < 0 && <Badge tone="danger">Vencida</Badge>}
                      <Money cents={x.amount_cents} />
                    </span>
                  }
                  as={x.virtual ? undefined : link(`/lancamento/${x.id}`)}
                />
              )
            })}
          </List>
        )}

        <section>
          <div className="mb-1.5 flex items-end justify-between px-4">
            <h2 className="text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Últimos gastos</h2>
            <Link to="/mes" className="flex items-center text-[0.9375rem] font-medium text-primary">
              Ver mês <ChevronRight className="size-4" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <Card className="text-center text-muted">Nenhum gasto do dia a dia neste mês. Toque no + para lançar.</Card>
          ) : (
            <List>
              {recent.map((x) => (
                <Row
                  key={x.id}
                  icon={<CategoryIcon category={catOf(x.category_id)} size="sm" />}
                  title={x.description}
                  subtitle={relativeDay(x.date, today)}
                  trailing={<Money cents={x.amount_cents} className="text-[1.0625rem]" />}
                  as={link(`/lancamento/${x.id}`)}
                />
              ))}
            </List>
          )}
        </section>
      </div>
    </>
  )
}

import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowCircleDown, CalendarCheck, ChartDonut, CreditCard, Eye, EyeSlash, Flame, GearSix, Hourglass, PiggyBank, Receipt,
  SplitHorizontal, Sun, Target, Trophy, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { ChevronRight } from 'lucide-react'
import { ProfileAvatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { AnimatedMoney, Badge, Button, ErrorBox, List, Money, ProgressBar, Row, Spinner } from '../components/ui'
import { useTable } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { currentYearMonth, dayOf, daysBetweenISO, formatDateShort, relativeDay, weekdayOf } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { toggleHidden, useHiddenValues } from '../lib/privacy'
import { freshStart, loggingDayStreak, savingWeekStreak, wishState } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import { levelText } from './MonthPage'

const SHORTCUTS: { to: string; label: string; icon: PhosphorIcon }[] = [
  { to: '/lancar?tipo=dia', label: 'Gasto', icon: Receipt },
  { to: '/lancar?tipo=renda', label: 'Renda', icon: ArrowCircleDown },
  { to: '/caixinhas', label: 'Guardar', icon: PiggyBank },
  { to: '/separar', label: 'Separar', icon: SplitHorizontal },
  { to: '/mes', label: 'Resumo', icon: ChartDonut },
  { to: '/habitos', label: 'Desafios', icon: Trophy },
  { to: '/habitos', label: 'Desejos', icon: Hourglass },
]

/** Seção da tela inicial no estilo de app de banco: título com seta e conteúdo, separada por uma linha fina. */
function Section({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  const head = (
    <span className="flex items-center justify-between">
      <span className="text-[1.1875rem] font-extrabold tracking-tight">{title}</span>
      {to && <ChevronRight className="size-5 text-faint" aria-hidden />}
    </span>
  )
  return (
    <section className="-mx-4 border-t border-line px-4 py-5">
      {to ? (
        <Link to={to} className="block active:opacity-70">
          {head}
          <div className="mt-2.5">{children}</div>
        </Link>
      ) : (
        <>
          {head}
          <div className="mt-2.5">{children}</div>
        </>
      )}
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const view = useMonthView(currentYearMonth())
  const plans = useTable('if_then_plans')
  const wishes = useTable('wishes')
  const challenges = useTable('challenges')
  const bankAccounts = useTable('bank_accounts')
  const hidden = useHiddenValues()
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const { profile: p, summary: s, todayBudget: t, statuses, txs, plan, categories, today, goals } = view.data
  const name = displayName(p)
  const hasSalary = p.salary_cents != null && p.payday != null
  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const banks = (bankAccounts.data ?? []).filter((a) => a.type === 'BANK')
  const cards = (bankAccounts.data ?? []).filter((a) => a.type === 'CREDIT')
  const bankBalance = banks.reduce((a, b) => a + (b.balance_cents ?? 0), 0)

  const alerts = statuses.filter((x) => x.level !== 'ok' || x.weekLevel !== 'ok').slice(0, 3)
  const upcoming = txs.filter((x) => !x.skipped && !x.paid && (x.type === 'fixo' || x.type === 'parcela') && daysBetweenISO(today, x.date) >= -3 && daysBetweenISO(today, x.date) <= 7)
  const recent = [...txs].filter((x) => !x.skipped && x.type === 'dia').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5)
  const needsSplit = hasSalary && dayOf(today) >= Math.min(p.payday!, 28) && !plan?.split_done_at
  const fresh = freshStart(today, p.birthday)
  const weekday = weekdayOf(today)
  const todayPlan = (plans.data ?? []).find((x) => x.active && (x.weekday == null || x.weekday === weekday))
  const readyWish = (wishes.data ?? []).find((w) => wishState(w, today).ready)
  const allTxs = [...new Map([...view.data.history, ...txs].map((x) => [x.id, x])).values()]
  const weeks = savingWeekStreak(view.data.goalMoves, today)
  const days = loggingDayStreak(allTxs, today)
  const activeChallenges = (challenges.data ?? []).filter((c) => c.status === 'ativo').length
  const saved = goals.reduce((a, g) => a + g.status.saved, 0)
  const goalNeed = goals.reduce((a, g) => a + g.status.needThisMonth, 0)

  return (
    <div className="flex flex-col">
      {/* Topo azul, como nos apps de banco: foto, olho para esconder valores e ajustes */}
      <header className="pt-safe -mx-4 bg-[#2F6FEB] px-4 pb-6 text-white">
        <div className="flex items-center justify-between pt-4">
          <Link to="/voce" aria-label="Você" className="rounded-full ring-2 ring-white/25">
            <ProfileAvatar profile={p} size="md" />
          </Link>
          <div className="flex gap-1">
            <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className="grid size-11 place-items-center rounded-full active:bg-white/15">
              {hidden ? <EyeSlash size={24} /> : <Eye size={24} />}
            </button>
            <Link to="/voce" aria-label="Ajustes" className="grid size-11 place-items-center rounded-full active:bg-white/15">
              <GearSix size={24} />
            </Link>
          </div>
        </div>
        <p className="mt-5 text-[1.375rem] font-bold">{name ? `Olá, ${name}` : 'Olá'}</p>
      </header>

      {banks.length > 0 && (
        <Section title="Conta" to="/voce/bancos">
          <AnimatedMoney cents={bankBalance} className="text-[1.75rem] font-extrabold tracking-[-0.02em]" />
        </Section>
      )}

      <section className={`-mx-4 px-4 py-5 ${banks.length ? 'border-t border-line' : ''}`}>
        {t && hasSalary ? (
          <>
            <p className="text-[1.1875rem] font-extrabold tracking-tight">Hoje você pode gastar</p>
            {t.leftToday >= 0 ? (
              <AnimatedMoney cents={t.leftToday} className="mt-1 block text-[2.5rem] leading-tight font-extrabold tracking-[-0.03em]" />
            ) : (
              <p className="mt-1 text-[1.5rem] leading-tight font-extrabold text-danger-strong">▲ Passou {hidden ? 'R$ ••••' : formatBRL(-t.leftToday)} do valor de hoje</p>
            )}
            <p className="mt-0.5 text-[0.9375rem] text-muted">
              {t.dailyAllowance > 0 ? (
                <>
                  <Money cents={t.dailyAllowance} /> por dia · {t.daysLeft === 1 ? 'último dia do mês' : `faltam ${t.daysLeft} dias`}
                </>
              ) : (
                'O dinheiro do dia a dia deste mês acabou. Vamos ajustar: veja o Mês.'
              )}
            </p>
            {t.dailyAllowance > 0 && <ProgressBar className="mt-3" value={t.spentToday / t.dailyAllowance} tone={t.leftToday < 0 ? 'danger' : t.spentToday >= t.dailyAllowance * 0.8 ? 'warn' : 'grow'} label="Gasto de hoje" />}
          </>
        ) : (
          <>
            <p className="text-[1.1875rem] font-extrabold tracking-tight">Quanto você pode gastar por dia?</p>
            <p className="mt-1 leading-snug text-muted">Informe seu salário e o dia do pagamento: o app desconta os fixos e o que você quer guardar e divide pelo resto do mês.</p>
            <Button size="md" className="mt-3" onClick={() => navigate('/voce')}>
              Informar salário
            </Button>
          </>
        )}

        {/* Atalhos redondos (arrasta para o lado) */}
        <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4">
          {SHORTCUTS.map((sc) => (
            <Link key={sc.label} to={sc.to} className="press flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center">
              <span className="grid size-[4.25rem] place-items-center rounded-full bg-surface text-ink">
                <sc.icon size={28} weight="duotone" />
              </span>
              <span className="text-[0.8125rem] leading-tight font-semibold">{sc.label}</span>
            </Link>
          ))}
        </div>

        {/* Lembretes do momento */}
        <div className="mt-6 flex flex-col gap-2.5">
          {needsSplit && (
            <Link to="/separar" className="press flex items-center gap-3 rounded-[1rem] bg-surface p-4">
              <SplitHorizontal size={28} weight="duotone" className="shrink-0 text-primary" />
              <span className="flex-1 leading-snug">
                <strong>Seu salário caiu.</strong> Separe primeiro o das caixinhas.
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          )}
          {fresh && (
            <div className="flex gap-3 rounded-[1rem] bg-surface p-4">
              <Sun size={28} weight="duotone" className="shrink-0 text-coral" />
              <p className="leading-snug">
                <strong>{fresh.title}.</strong> {fresh.text}
              </p>
            </div>
          )}
          {todayPlan && (
            <div className="flex gap-3 rounded-[1rem] bg-surface p-4">
              <Target size={28} weight="duotone" className="shrink-0 text-ai" />
              <p className="leading-snug">
                <strong>Seu plano de hoje:</strong> {todayPlan.trigger_text}, {todayPlan.action_text}.
              </p>
            </div>
          )}
          {readyWish && (
            <Link to="/habitos" className="press flex items-center gap-3 rounded-[1rem] bg-surface p-4">
              <Hourglass size={28} weight="duotone" className="shrink-0 text-warn" />
              <span className="flex-1 leading-snug">
                <strong>Ainda quer o {readyWish.name}?</strong> A espera de 30 dias acabou.
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          )}
          {(weekday === 0 || weekday === 1) && (
            <Link to="/revisao" className="press flex items-center gap-3 rounded-[1rem] bg-gradient-to-br from-[#2F6FEB] to-[#163a8a] p-4 text-white">
              <CalendarCheck size={28} weight="duotone" className="shrink-0" />
              <span className="flex-1 leading-snug">
                <strong>Sua semana em 2 minutos.</strong> Veja como foi.
              </span>
              <ChevronRight className="size-5 opacity-80" />
            </Link>
          )}
        </div>
      </section>

      {cards.map((c) => (
        <Section key={c.id} title="Cartão de crédito" to="/voce/bancos">
          <div className="flex items-start gap-3">
            <CreditCard size={26} weight="duotone" className="mt-0.5 shrink-0 text-muted" />
            <div>
              <p className="text-muted">{c.name}</p>
              <p className="text-[1.25rem] font-bold">
                Fatura atual <Money cents={c.balance_cents ?? 0} />
              </p>
              <p className="text-[0.9375rem] text-muted">
                {c.due_date ? `Vence ${formatDateShort(c.due_date)}` : ''}
                {c.available_cents != null && (
                  <>
                    {c.due_date ? ' · ' : ''}Limite disponível <Money cents={c.available_cents} />
                  </>
                )}
              </p>
            </div>
          </div>
        </Section>
      ))}

      <Section title="Seu mês" to="/mes">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Entrou', s.income, ''],
            ['Saiu', s.committed + s.daily, ''],
            ['Sobra prevista', s.free, s.free < 0 ? 'text-danger-strong' : 'text-primary-strong'],
          ].map(([label, cents, cls]) => (
            <div key={label as string}>
              <p className="text-[0.8125rem] text-muted">{label}</p>
              <Money cents={cents as number} className={`text-[1rem] font-bold ${cls}`} />
            </div>
          ))}
        </div>
        {alerts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {alerts.map((a) => (
              <span key={a.category.id} className="flex items-center gap-1.5 text-[0.875rem]">
                {a.category.name} {levelText(a)}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Caixinhas" to="/caixinhas">
        <AnimatedMoney cents={saved} className="text-[1.375rem] font-bold" />
        <p className="text-[0.9375rem] text-muted">{goals.length === 0 ? 'Crie sua primeira caixinha para guardar com objetivo.' : goalNeed > 0 ? `Falta guardar ${hidden ? 'R$ ••••' : formatBRL(goalNeed)} este mês` : 'Mês em dia nas caixinhas'}</p>
      </Section>

      <Section title="Hábitos" to="/habitos">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <Flame size={24} weight="duotone" className="text-coral" />
            <span className="text-[0.9375rem]">
              <strong className="num">{weeks}</strong> {weeks === 1 ? 'semana guardando' : 'semanas guardando'}
            </span>
          </span>
          <span className="text-[0.9375rem] text-muted">
            <strong className="num text-ink">{days}</strong> {days === 1 ? 'dia lançando' : 'dias lançando'}
            {activeChallenges > 0 ? ` · ${activeChallenges} desafio${activeChallenges > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </Section>

      {upcoming.length > 0 && (
        <Section title="Contas a pagar">
          <List>
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
                  as={x.virtual ? undefined : (c, cls) => <Link to={`/lancamento/${x.id}`} className={cls}>{c}</Link>}
                />
              )
            })}
          </List>
        </Section>
      )}

      <Section title="Últimos gastos">
        {recent.length === 0 ? (
          <p className="text-muted">Nenhum gasto do dia a dia neste mês. Toque no + para lançar.</p>
        ) : (
          <List>
            {recent.map((x) => (
              <Row
                key={x.id}
                icon={<CategoryIcon category={catOf(x.category_id)} size="sm" />}
                title={x.description}
                subtitle={relativeDay(x.date, today)}
                trailing={<Money cents={x.amount_cents} className="text-[1.0625rem]" />}
                as={(c, cls) => <Link to={`/lancamento/${x.id}`} className={cls}>{c}</Link>}
              />
            ))}
          </List>
        )}
      </Section>
    </div>
  )
}

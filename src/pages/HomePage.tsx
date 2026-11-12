import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bank, BookOpenText, ChatCircleDots, CalendarCheck, ChartLineUp, Eye, EyeSlash, Flame, Heart, Heartbeat, Hourglass, Repeat, SplitHorizontal, Sun, Target, Trophy, type Icon as PhosphorIcon, Crown } from '@phosphor-icons/react'
import { HomeCarousel, type Slide } from '../components/HomeCarousel'
import { APP_NAME } from '../brand'
import { MenuButton } from '../components/MenuContext'
import { Tour, type TourStep } from '../components/Tour'
import { Reveal } from '../components/Reveal'
import { BankLogo } from '../components/BankLogo'
import { findInstitution } from '../lib/institutions'
import { lessonOfDay } from '../lib/learn'
import { financialHealth } from '../lib/health'
import { HealthRing, scoreColor } from './HealthPage'
import { Pig, mascotName, usePigColor } from '../components/Pig'
import { useToast } from '../components/Toast'
import { usePig } from '../data/pig'
import { DAILY_KINDS, pigLine } from '../lib/pig'
import { CoinBadge, PigSays } from './PigPage'
import type { BankAccount } from '../types'
import { useRecurrings } from '../data/finance'
import { subscriptions, type TodayBudget } from '../lib/budget'
import { projection } from '../lib/psych'
import { useAuth } from '../auth/AuthProvider'
import { ChevronRight } from 'lucide-react'
import { ProfileAvatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { AnimatedMoney, Badge, ErrorBox, List, Money, Row, Spinner } from '../components/ui'
import { useTable } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { currentYearMonth, dayOf, daysBetweenISO, formatDateShort, relativeDay, weekdayOf } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { toggleHidden, useHiddenValues } from '../lib/privacy'
import { freshStart, loggingDayStreak, savingWeekStreak, wishState } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import { levelText } from './MonthPage'

const HOME_TOUR: TourStep[] = [
  { target: 'hoje', title: 'Quanto você pode gastar hoje', text: 'O número mais importante: já desconta as contas fixas e o que você vai guardar. Gastou menos hoje? Sobra mais amanhã.' },
  { target: 'mais', title: 'Lance em 2 toques', text: 'Toque no + para lançar um gasto, uma renda ou guardar dinheiro numa caixinha.' },
  { target: 'porquinho', title: 'Esse sou eu!', text: 'Cada meta do dia vale moedas para eu ganhar roupinhas. Guardou o que combinou? Eu fico gordinho.' },
  { target: 'atalhos', title: 'Atalhos', text: 'Aprender, Assistente, Saúde financeira e mais, a um toque.' },
  { target: 'menu', title: 'Tudo do app', text: 'No menu você encontra todas as telas: cartões, caixinhas, gráficos e ajustes.' },
  { target: 'aba-graficos', title: 'Seus gráficos', text: 'Veja para onde foi o dinheiro e como o mês deve fechar.' },
]

// Atalhos: o que o "+" não tem (lançar e guardar ficam no "+")
const SHORTCUTS: { to: string; label: string; icon: PhosphorIcon }[] = [
  { to: '/aprender', label: 'Aprender', icon: BookOpenText },
  { to: '/assistente', label: 'Assistente', icon: ChatCircleDots },
  { to: '/saude', label: 'Saúde', icon: Heartbeat },
  { to: '/separar', label: 'Separar', icon: SplitHorizontal },
  { to: '/revisao', label: 'Revisão', icon: CalendarCheck },
  { to: '/habitos', label: 'Desafios', icon: Trophy },
  { to: '/habitos', label: 'Desejos', icon: Hourglass },
]

/** Seção da tela inicial no estilo de app de banco: título com seta e conteúdo, separada por uma linha fina. */
function Section({ title, to, children, tour }: { title: string; to?: string; children: ReactNode; tour?: string }) {
  const head = (
    <span className="flex items-center justify-between">
      <span className="text-[1.1875rem] font-extrabold tracking-tight">{title}</span>
      {to && <ChevronRight className="size-5 text-faint" aria-hidden />}
    </span>
  )
  return (
    <Reveal>
    <section data-tour={tour} className="-mx-4 border-t border-line px-4 py-5">
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
    </Reveal>
  )
}

/**
 * "Hoje você pode gastar" dentro do topo azul (como o saldo nos apps de banco),
 * com o porquinho reagindo: feliz, preocupado perto do limite, aflito quando passa.
 */
function TodayHero({ t, monthFree, hidden, onSetSalary }: { t: TodayBudget | null; monthFree: number; hidden: boolean; onSetSalary: () => void }) {
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  if (!t) {
    return (
      <div className="mt-4 flex items-center gap-3" data-tour="hoje">
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] font-bold">Quanto você pode gastar por dia?</p>
          <p className="mt-1 text-[0.875rem] leading-snug text-white/80">Informe o salário e o dia do pagamento: o app faz a conta para você.</p>
          <button type="button" onClick={onSetSalary} className="press mt-3 rounded-full bg-white px-4 py-2 text-[0.9375rem] font-bold text-[#1D5FD6]">
            Informar salário
          </button>
        </div>
        <Pig art="rosto-pensativo" px={88} still />
      </div>
    )
  }
  const over = t.leftToday < 0
  const ratio = t.dailyAllowance > 0 ? t.spentToday / t.dailyAllowance : 0
  const warn = !over && ratio >= 0.8
  const art = over ? 'tela-alerta' : warn ? 'rosto-preocupado' : 'rosto-feliz'
  return (
    <div className="mt-3" data-tour="hoje">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 pb-1">
          <p className="text-[0.9375rem] font-medium text-white/80">Hoje você pode gastar</p>
          {over ? (
            <p className="mt-0.5 text-[1.875rem] leading-tight font-extrabold tracking-tight text-[#FFD9CF]">Passou {money(-t.leftToday)}</p>
          ) : (
            <AnimatedMoney cents={t.leftToday} className="block text-[2.5rem] leading-tight font-extrabold tracking-[-0.03em]" />
          )}
          <span className="mt-1 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[0.8125rem] font-semibold">
            {t.daysLeft === 1 ? 'Último dia do mês' : `Faltam ${t.daysLeft} dias`}
          </span>
        </div>
        <Pig art={art} px={96} className="-mb-1" />
      </div>

      {t.dailyAllowance > 0 ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Gasto de hoje" aria-valuenow={Math.round(Math.min(1, ratio) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`bar-fill h-full rounded-full ${over ? 'bg-[#FF8A70]' : warn ? 'bg-[#FFC94D]' : 'bg-white'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.8125rem] text-white/80">
            {over ? 'Amanhã o valor do dia se ajusta sozinho. Sem culpa: segue o plano.' : `${money(t.spentToday)} gastos hoje de ${money(t.dailyAllowance)}`}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[0.875rem] leading-snug text-white/85">O dinheiro do dia a dia deste mês acabou. Vamos ajustar: veja o Mês.</p>
      )}

      <div className="mt-4 grid grid-cols-3 divide-x divide-white/20 rounded-[1rem] bg-white/12 py-2.5 backdrop-blur">
        {[
          ['Por dia', money(t.dailyAllowance)],
          ['Gasto hoje', money(t.spentToday)],
          ['Sobra do mês', money(monthFree)],
        ].map(([label, value]) => (
          <div key={label} className="px-2 text-center">
            <p className="text-[0.75rem] text-white/75">{label}</p>
            <p className="num text-[0.9375rem] font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const view = useMonthView(currentYearMonth())
  const plans = useTable('if_then_plans')
  const wishes = useTable('wishes')
  const challenges = useTable('challenges')
  const bankAccounts = useTable('bank_accounts')
  const bankConns = useTable('bank_connections')
  const recurrings = useRecurrings()
  const { mode } = useAuth()
  const hidden = useHiddenValues()
  const toast = useToast()
  const MASCOT_NAME = mascotName(usePigColor())
  const pig = usePig((n) => toast(`+${n} ${n === 1 ? 'moeda ganha' : 'moedas ganhas'} com as metas do dia`))
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const { profile: p, summary: s, todayBudget: t, statuses, txs, plan, categories, today, goals } = view.data
  const name = displayName(p)
  const hasSalary = p.salary_cents != null && p.payday != null
  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const banks = (bankAccounts.data ?? []).filter((a) => a.type === 'BANK')
  const cards = (bankAccounts.data ?? []).filter((a) => a.type === 'CREDIT')
  const bankBalance = banks.reduce((a, b) => a + (b.balance_cents ?? 0), 0)
  const instOf = (a: BankAccount) => findInstitution(a.name, (bankConns.data ?? []).find((c) => c.id === a.connection_id)?.label)
  const bankInsts = [...new Map(banks.map((b) => instOf(b)).filter((i) => i != null).map((i) => [i.key, i])).values()]

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
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  const health = financialHealth({ today, monthTxs: txs, history: view.data.history, goals, goalMoves: view.data.goalMoves, categories, hasSalary })

  // Carrossel: cartões feitos com os dados da pessoa (passam sozinhos)
  const slides: Slide[] = []
  const why = goals.find((g) => g.goal.motivation && !g.status.done)
  if (why) slides.push({ id: 'porque', to: `/caixinhas/${why.goal.id}`, kicker: `Seu porquê · ${why.goal.name}`, title: `“${why.goal.motivation}”`, text: why.status.progress != null ? `Você já está em ${Math.floor(why.status.progress * 100)}%. Continue.` : 'Continue guardando um pouco por vez.', icon: Heart, from: why.goal.color, to2: '#0F2433', art: 'rosto-feliz', cta: 'Ver a caixinha' })
  const proj = projection(view.data.goalMoves, today)
  if (proj.pace > 0) slides.push({ id: 'futuro', to: '/caixinhas', kicker: 'Seu futuro', title: `Em dezembro você terá ${money(proj.projected)}`, text: `Mantendo o ritmo de ${money(proj.pace)} por mês nas caixinhas.`, icon: ChartLineUp, from: '#0F9D6B', to2: '#0B4F3A', art: 'tela-economia', cta: 'Ver caixinhas' })
  const subs = subscriptions(recurrings.data ?? [], view.data.history)
  if (subs.yearlyCents > 0) slides.push({ id: 'assinaturas', to: '/mes?aba=orcamento', kicker: 'O que se repete', title: `${money(subs.yearlyCents)} por ano`, text: `${subs.items.length} ${subs.items.length === 1 ? 'gasto que se repete' : 'gastos que se repetem'}. Vale cancelar algum?`, icon: Repeat, from: '#6E56F0', to2: '#2D2275', art: 'rosto-pensativo', cta: 'Revisar' })
  slides.push(activeChallenges > 0
    ? { id: 'desafio', to: '/habitos', kicker: 'Desafio em andamento', title: activeChallenges === 1 ? 'Você tem 1 desafio ativo' : `Você tem ${activeChallenges} desafios ativos`, text: 'Veja como está indo e não quebre a sequência.', icon: Trophy, from: '#FF6B4A', to2: '#8A2A14', art: 'rosto-animado', cta: 'Acompanhar' }
    : { id: 'desafio', to: '/habitos', kicker: 'Desafio da semana', title: '7 dias sem delivery', text: 'Topa? Em média dá para guardar uns R$ 150 por semana.', icon: Trophy, from: '#FF6B4A', to2: '#8A2A14', art: 'rosto-animado', cta: 'Topar o desafio' })
  const lesson = lessonOfDay(Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000))
  slides.push({ id: 'dica', to: `/aprender/${lesson.id}`, kicker: 'Aprenda em 2 minutos', title: lesson.title, text: lesson.short, icon: BookOpenText, from: '#2F6FEB', to2: '#163A8A', art: 'modo-moderado', cta: 'Ler agora' })
  if ((mode === 'demo' || p.is_admin) && !(bankAccounts.data ?? []).length) slides.push({ id: 'banco', to: '/voce/bancos', kicker: 'Mais fácil', title: 'Conecte seu banco', text: 'Seus gastos entram sozinhos, só leitura.', icon: Bank, from: '#0E9AA7', to2: '#0A4A52', art: 'tela-conexao', cta: 'Conectar' })
  // Prévia do plano pago (ainda não existe cobrança): serve para ver como o cartão fica e medir o interesse
  slides.push({ id: 'premium', to: '/premium', kicker: `${APP_NAME} Premium`, title: 'Tudo no automático', text: 'Banco conectado, assistente sem limite e roupas exclusivas.', icon: Crown, from: '#1B2F5E', to2: '#0E1830', art: 'loja-terno', cta: 'Conhecer', badge: 'Em breve' })
  // Ordem: o porquê da pessoa, a lição do dia (ajuda financeira em primeiro lugar), depois o resto
  const ORDER = ['porque', 'dica', 'futuro', 'assinaturas', 'desafio', 'banco', 'premium']
  slides.sort((x, y) => ORDER.indexOf(x.id) - ORDER.indexOf(y.id))

  return (
    <div className="flex flex-col">
      {/* Topo azul, como nos apps de banco: foto, olho para esconder valores e ajustes */}
      <header className="pt-safe -mx-4 bg-gradient-to-b from-[#2F6FEB] to-[#1D5FD6] px-4 pb-5 text-white">
        <div className="flex items-center justify-between pt-4">
          <Link to="/voce" aria-label="Você" className="rounded-full ring-2 ring-white/25">
            <ProfileAvatar profile={p} size="md" />
          </Link>
          <div className="flex gap-1">
            <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className="grid size-11 place-items-center rounded-full active:bg-white/15">
              {hidden ? <EyeSlash size={24} /> : <Eye size={24} />}
            </button>
            <span data-tour="menu">
              <MenuButton className="size-11 text-white active:bg-white/15" />
            </span>
          </div>
        </div>
        <p className="mt-3 text-[1.125rem] font-semibold">{name ? `Olá, ${name}` : 'Olá'}</p>
        <TodayHero t={t && hasSalary ? t : null} monthFree={s.free} hidden={hidden} onSetSalary={() => navigate('/voce')} />
      </header>

      {banks.length > 0 && (
        <Section title="Conta" to="/voce/bancos">
          <div className="flex items-center gap-3">
            <BankLogo inst={bankInsts[0] ?? null} />
            <div className="min-w-0">
              <AnimatedMoney cents={bankBalance} className="block text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em]" />
              <p className="text-[0.875rem] text-muted">{bankInsts.length ? bankInsts.map((i) => i.name).join(' + ') : 'Saldo na conta'}</p>
            </div>
          </div>
        </Section>
      )}

      <section className="-mx-4 px-4 pt-5 pb-5">
        {/* Atalhos redondos (arrasta para o lado) */}
        <div data-tour="atalhos" className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
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

      {pig.state && (
        <Section title={MASCOT_NAME} to="/porquinho" tour="porquinho">
          <div className="flex items-center gap-3">
            <Pig size={pig.state.size} mood={pig.state.mood} tone={p.ai_tone} wear={pig.wear} px={104} className="-my-2 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <PigSays>{pigLine(p.ai_tone, pig.state.mood, Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000))}</PigSays>
              <span className="flex items-center gap-2 text-[0.875rem] text-muted">
                <CoinBadge n={pig.balance} /> {DAILY_KINDS.filter((k) => pig.state!.today[k]).length} de {DAILY_KINDS.length} metas hoje
              </span>
            </div>
          </div>
        </Section>
      )}

      {cards.map((c) => (
        <Section key={c.id} title="Cartão de crédito" to={`/voce/bancos/${c.id}`}>
          <div className="flex items-start gap-3">
            <BankLogo inst={instOf(c)} credit />
            <div className="min-w-0">
              <p className="text-muted">{instOf(c)?.name ?? c.name}</p>
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
        {/* A conta fecha: renda − gastos − caixinhas = sobra */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {[
            ['Renda do mês', s.income, '', ''],
            ['Gastos do mês', s.committed + s.daily, '', '−'],
            ['Para as caixinhas', s.save, '', '−'],
            ['Sobra prevista', s.free, s.free < 0 ? 'text-danger-strong' : 'text-primary-strong', '='],
          ].map(([label, cents, cls, op]) => (
            <div key={label as string}>
              <p className="text-[0.8125rem] text-muted">{label}</p>
              <p className={`text-[1rem] font-bold ${cls}`}>
                {op && <span className="mr-1 text-muted">{op}</span>}
                <Money cents={cents as number} />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.8125rem] text-muted">Contando as contas do mês que ainda vão vencer.</p>
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

      <Section title="Saúde financeira" to="/saude">
        <div className="flex items-center gap-4">
          <HealthRing score={health.score} size={64} />
          <div className="min-w-0">
            <p className="text-[1.0625rem] font-bold" style={{ color: scoreColor(health.score) }}>{health.label}</p>
            <p className="text-[0.9375rem] leading-snug text-muted">{health.next[0] ? health.next[0].tip : 'Tudo em dia. Continue assim.'}</p>
          </div>
        </div>
      </Section>

      <Section title="Caixinhas" to="/caixinhas">
        <AnimatedMoney cents={saved} className="text-[1.375rem] font-bold" />
        <p className="text-[0.9375rem] text-muted">{goals.length === 0 ? 'Crie sua primeira caixinha para guardar com objetivo.' : goalNeed > 0 ? `Falta guardar ${hidden ? 'R$ ••••' : formatBRL(goalNeed)} este mês` : 'Mês em dia nas caixinhas'}</p>
      </Section>

      <HomeCarousel slides={slides} />

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
        <Link to="/extrato" className="press mt-3 flex items-center justify-center gap-1.5 rounded-full bg-surface py-3 text-[0.9375rem] font-semibold text-primary shadow-soft">
          Ver extrato completo <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Section>
      <Tour id="inicio" steps={HOME_TOUR} />
    </div>
  )
}

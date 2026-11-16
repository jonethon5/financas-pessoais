import { Fragment, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowCircleDown, Eye, EyeSlash, Hourglass, SplitHorizontal } from '@phosphor-icons/react'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { StatementRow } from '../components/StatementRow'
import { IncomeTriage, unclassifiedIncome } from '../components/IncomeTriage'
import { MonthGlance } from '../components/MonthFlow'
import { Wallet } from '../components/Wallet'
import { useAccounts } from '../data/accounts'
import { MenuButton } from '../components/MenuContext'
import { Tour, type TourStep } from '../components/Tour'
import { Reveal } from '../components/Reveal'
import { Pig } from '../components/Pig'
import { useToast } from '../components/Toast'
import { usePig } from '../data/pig'
import { BankLogo } from '../components/BankLogo'
import { useRecurrings, useTable } from '../data/finance'
import { isBillDue, remindWindow } from '../lib/recurring'
import { cardBills, dueText } from '../lib/bills'
import { cardCycles, nextInvoices } from '../lib/cardcycle'
import type { TodayBudget } from '../lib/budget'
import { ProfileAvatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { AnimatedMoney, Badge, ErrorBox, HelpButton, List, Money, Row, Spinner } from '../components/ui'
import { useMonthView } from '../data/monthView'
import { currentYearMonth, dayOf, daysBetweenISO, monthLabel, relativeDay } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { toggleHidden, useHiddenValues } from '../lib/privacy'
import { wishState } from '../lib/psych'
import { friendlyError } from '../lib/supabase'

const HOME_TOUR: TourStep[] = [
  { target: 'hoje', title: 'Quanto você pode gastar hoje', text: 'O número mais importante: já desconta as contas fixas e o que você vai guardar. Gastou menos hoje? Sobra mais amanhã.' },
  { target: 'atencao', title: 'O que precisa da sua atenção', text: 'Contas e faturas perto de vencer aparecem aqui. Quando não tem nada, está tudo em dia.' },
  { target: 'mais', title: 'Lance em 2 toques', text: 'Toque no + para lançar um gasto, uma renda ou guardar dinheiro numa caixinha.' },
  { target: 'menu', title: 'Tudo do app', text: 'No menu ficam as outras telas: saúde financeira, desafios, aprender, porquinho e ajustes.' },
]

/** Seção da tela inicial no estilo de app de banco: título com seta e conteúdo, separada por uma linha fina. */
/** `links`: o conteúdo tem os próprios links (aí só o título leva para `to`, sem link dentro de link). */
function Section({ title, to, children, tour, links }: { title: string; to?: string; children: ReactNode; tour?: string; links?: boolean }) {
  const head = (
    <span className="flex items-center justify-between">
      <span className="text-[1.1875rem] font-extrabold tracking-tight">{title}</span>
      {to && <ChevronRight className="size-5 text-faint" aria-hidden />}
    </span>
  )
  return (
    <Reveal>
    <section data-tour={tour} className="-mx-4 border-t border-line px-4 py-5">
      {to && links ? (
        <>
          <Link to={to} className="block active:opacity-70">
            {head}
          </Link>
          <div className="mt-2.5">{children}</div>
        </>
      ) : to ? (
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
function TodayHero({ t, hidden, onSetSalary }: { t: TodayBudget | null; hidden: boolean; onSetSalary: () => void }) {
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  if (!t) {
    return (
      <div className="mt-4 flex items-center gap-3" data-tour="hoje">
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] font-bold">Quanto você pode gastar por dia?</p>
          <p className="mt-1 text-[0.875rem] leading-snug text-white">Informe o salário e o dia do pagamento: o app faz a conta para você.</p>
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
          <p className="text-[0.9375rem] font-medium text-white">Hoje você pode gastar</p>
          {over ? (
            <p className="mt-0.5 text-[1.875rem] leading-tight font-extrabold tracking-tight text-[#FFD9CF]">Passou {money(-t.leftToday)}</p>
          ) : (
            <AnimatedMoney cents={t.leftToday} className="block text-[2.5rem] leading-tight font-extrabold tracking-[-0.03em]" />
          )}
          <span className="mt-1 inline-flex rounded-full bg-black/15 px-2.5 py-0.5 text-[0.8125rem] font-semibold">
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
          <p className="mt-1.5 text-[0.8125rem] text-white">
            {over ? 'Amanhã o valor do dia se ajusta sozinho. Sem culpa: segue o plano.' : `${money(t.spentToday)} gastos hoje de ${money(t.dailyAllowance)}`}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[0.875rem] leading-snug text-white">O dinheiro do dia a dia deste mês acabou. Vamos ajustar: veja o Mês.</p>
      )}

    </div>
  )
}

/** Item da lista "Precisa da sua atenção". */
type Attention = { key: string; node: ReactNode }

/**
 * Início: só o que a pessoa precisa saber ao abrir o app, do mais urgente ao que pode esperar.
 * 1. quanto pode gastar hoje; 2. o que precisa de atenção (contas, fatura, lembretes); 3. o mês em 3 números;
 * 4. contas e cartões; 5. os últimos gastos. O resto mora nas abas e no menu (menos coisa na tela = decisão mais fácil).
 */
export function HomePage() {
  const navigate = useNavigate()
  const view = useMonthView(currentYearMonth())
  const wishes = useTable('wishes')
  const wallet = useAccounts()
  const recurrings = useRecurrings()
  const hidden = useHiddenValues()
  const toast = useToast()
  const [showAll, setShowAll] = useState(false)
  const [triage, setTriage] = useState(false)
  // As metas do dia do porquinho continuam valendo moedas (a seção dele saiu do Início; ele fica no topo)
  usePig((n) => toast(`+${n} ${n === 1 ? 'moeda ganha' : 'moedas ganhas'} com as metas do dia`))
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const { profile: p, summary: s, todayBudget: t, txs, plan, categories, today, history } = view.data
  const name = displayName(p)
  const hasSalary = p.salary_cents != null && p.payday != null
  const catOf = (id: string | null) => categories.find((c) => c.id === id)

  // Contas a pagar: cada gasto fixo aparece a partir do aviso escolhido nele (parcelas: 3 dias antes)
  const recById = new Map((recurrings.data ?? []).map((r) => [r.id, r]))
  const upcoming = txs.filter((x) => !x.skipped && !x.paid && (x.type === 'fixo' || x.type === 'parcela') && isBillDue(daysBetweenISO(today, x.date), remindWindow(x.recurring_id ? recById.get(x.recurring_id) : null)))
  // Fatura de cartão perto de vencer (até 7 dias) ou vencida (a já paga não aparece)
  const allTxs = [...new Map([...history, ...txs].map((x) => [x.id, x])).values()]
  // Últimos gastos pela data em que aconteceram (o cartão conta na fatura, mas a compra de hoje aparece hoje)
  const recent = allTxs.filter((x) => !x.skipped && x.type === 'dia' && x.kind === 'expense' && x.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 3)
  const nextCard = nextInvoices(allTxs, today, cardCycles(wallet.raw))
  const bills = cardBills(wallet.raw, today, allTxs)
  const urgentBills = bills.filter((b) => b.urgent)
  const needsSplit = hasSalary && dayOf(today) >= Math.min(p.payday!, 28) && !plan?.split_done_at
  const readyWish = (wishes.data ?? []).find((w) => wishState(w, today).ready)

  // "Precisa da sua atenção": primeiro o que custa dinheiro se esquecer (conta vencendo), depois os lembretes
  const attention: Attention[] = []
  for (const b of urgentBills) {
    const info = wallet.byId(b.accountId)
    attention.push({
      key: `fatura-${b.accountId}`,
      node: (
        <Row
          icon={info ? <BankLogo inst={info.inst} credit /> : undefined}
          title={`Fatura ${info ? info.short : 'do cartão'}`}
          subtitle={dueText(b.daysUntil).replace(/^./, (c) => c.toUpperCase())}
          trailing={
            <span className="flex items-center gap-2">
              {b.daysUntil != null && b.daysUntil < 0 && <Badge tone="danger">Vencida</Badge>}
              <Money cents={b.amountCents} />
            </span>
          }
          chevron
          as={(c, cls) => <Link to={`/voce/bancos/${b.accountId}`} className={cls}>{c}</Link>}
        />
      ),
    })
  }
  for (const x of upcoming) {
    const d = daysBetweenISO(today, x.date)
    attention.push({
      key: x.id,
      node: (
        <Row
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
      ),
    })
  }
  // Dinheiro que entrou pelo banco e ninguém disse o que é (ex.: parte do salário que caiu separada)
  const unclassified = unclassifiedIncome(txs)
  if (unclassified.length) {
    const cents = unclassified.reduce((a, t) => a + t.amount_cents, 0)
    attention.push({
      key: 'entradas',
      node: (
        <Row
          icon={<ArrowCircleDown size={26} weight="duotone" className="text-grow" />}
          title="Entrou dinheiro: é salário?"
          subtitle={`${hidden ? 'R$ ••••' : formatBRL(cents)} pelo banco ainda não conta. Toque e diga o que é`}
          chevron
          onClick={() => setTriage(true)}
        />
      ),
    })
  }
  if (needsSplit) {
    attention.push({
      key: 'separar',
      node: (
        <Row
          icon={<SplitHorizontal size={26} weight="duotone" className="text-primary" />}
          title="Seu salário caiu"
          subtitle="Separe primeiro o das caixinhas"
          chevron
          as={(c, cls) => <Link to="/separar" className={cls}>{c}</Link>}
        />
      ),
    })
  }
  if (readyWish) {
    attention.push({
      key: 'desejo',
      node: (
        <Row
          icon={<Hourglass size={26} weight="duotone" className="text-warn" />}
          title={`Ainda quer o ${readyWish.name}?`}
          subtitle="A espera de 30 dias acabou"
          chevron
          as={(c, cls) => <Link to="/habitos" className={cls}>{c}</Link>}
        />
      ),
    })
  }
  const visible = showAll ? attention : attention.slice(0, 3)

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
            <HelpButton className="size-11 text-white active:bg-white/15" />
            <span data-tour="menu">
              <MenuButton className="size-11 text-white active:bg-white/15" />
            </span>
          </div>
        </div>
        <p className="mt-3 text-[1.125rem] font-semibold text-white">{name ? `Olá, ${name}` : 'Olá'}</p>
        <TodayHero t={t && hasSalary ? t : null} hidden={hidden} onSetSalary={() => navigate('/voce')} />
      </header>

      <Section title="Precisa da sua atenção" tour="atencao">
        {attention.length === 0 ? (
          <p className="flex items-center gap-2 text-[0.9375rem] text-muted">
            <CheckCircle2 className="size-5 shrink-0 text-grow" aria-hidden /> Tudo em dia: nada vence nos próximos dias.
          </p>
        ) : (
          <>
            <List>
              {visible.map((a) => (
                <Fragment key={a.key}>{a.node}</Fragment>
              ))}
            </List>
            {attention.length > 3 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 px-1 text-[0.9375rem] font-semibold text-primary-strong">
                {showAll ? 'Mostrar menos' : `Ver mais ${attention.length - 3}`}
              </button>
            )}
          </>
        )}
      </Section>

      <Section title="Seu mês" to="/mes">
        <MonthGlance s={s} pending={unclassified.length > 0} />
        {nextCard && nextCard.cents > 0 && (
          <p className="mt-2 text-[0.875rem] text-muted">
            Já gasto no cartão: <strong className="num text-ink">{hidden ? 'R$ ••••' : formatBRL(nextCard.cents)}</strong> (fatura de {monthLabel(nextCard.month).split(' ')[0].toLowerCase()})
          </p>
        )}
      </Section>

      {wallet.list.length > 0 && (
        <Section title="Contas e cartões" to="/voce/bancos" links>
          <Wallet accounts={wallet.list} dueOf={(id) => bills.find((b) => b.accountId === id)?.dueDate ?? null} />
        </Section>
      )}

      <Section title="Últimos gastos" to="/extrato" links>
        {recent.length === 0 ? (
          <p className="text-muted">Nenhum gasto do dia a dia neste mês. Toque no + para lançar.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((x) => (
              <StatementRow key={x.id} t={x} category={catOf(x.category_id)} accounts={wallet.raw} account={wallet.byId(x.bank_account_id)} />
            ))}
          </ul>
        )}
      </Section>

      {triage && <IncomeTriage txs={txs} onClose={() => setTriage(false)} />}
      <Tour id="inicio-v2" steps={HOME_TOUR} />
    </div>
  )
}

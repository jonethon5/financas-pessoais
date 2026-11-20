import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRight, ChevronLeft, ChevronRight, Info, Search } from 'lucide-react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MascotArt, Pig } from '../components/Pig'
import { AnimatedMoney } from '../components/ui'
import type { CashToday, TodayBudget } from '../lib/budget'
import type { MonthPoint } from '../lib/charts'
import { formatBRL } from '../lib/money'
import { toggleHidden } from '../lib/privacy'
import { liftForDark, useIsDark } from '../lib/theme'

type Banner = { title: string; text: string; cta: string; to: string; art: string; bg: string; ink: string }

function banners(hasBank: boolean): Banner[] {
  return [
    { title: 'Guarde primeiro, gaste depois', text: 'Quando o salário cair, separe o das caixinhas. O que sobra é o do mês.', cta: 'Separar salário', to: '/separar', art: 'tela-economia', bg: 'linear-gradient(135deg,#0B8A5F,#065A3E)', ink: '#065A3E' },
    hasBank
      ? { title: 'Como está sua saúde financeira?', text: 'Um resumo de como anda o seu dinheiro e por onde começar.', cta: 'Ver minha saúde', to: '/saude', art: 'modo-moderado', bg: 'linear-gradient(135deg,#1B4A9C,#0F2B66)', ink: '#0F2B66' }
      : { title: 'Conecte seu banco', text: 'Pelo Open Finance os gastos entram sozinhos, sem digitar nada.', cta: 'Conectar', to: '/voce/bancos', art: 'tela-conexao', bg: 'linear-gradient(135deg,#1B4A9C,#0F2B66)', ink: '#0F2B66' },
    { title: 'Desafios curtos, dinheiro guardado', text: 'Metas de poucos dias para segurar os gastos, como as 52 semanas.', cta: 'Ver desafios', to: '/habitos', art: 'tela-metas', bg: 'linear-gradient(135deg,#5B45D6,#3B2A9E)', ink: '#3B2A9E' },
    { title: 'Quer comprar algo? Espere 30 dias', text: 'Anote na lista de desejos. Se a vontade passar, o dinheiro fica com você.', cta: 'Lista de desejos', to: '/habitos', art: 'rosto-pensativo', bg: 'linear-gradient(135deg,#C2410C,#8F2F08)', ink: '#8F2F08' },
    { title: 'Sair das dívidas, passo a passo', text: 'Lições curtas, com base em estudos e sem economês.', cta: 'Aprender', to: '/aprender', art: 'tela-relatorios', bg: 'linear-gradient(135deg,#0E6E8C,#08475C)', ink: '#08475C' },
    { title: 'Roupinhas novas para o porquinho', text: 'Cumpra as metas do dia, ganhe moedas e troque na loja.', cta: 'Abrir a loja', to: '/porquinho', art: 'loja-oculos-sol', bg: 'linear-gradient(135deg,#C22E5C,#8E1D41)', ink: '#8E1D41' },
  ]
}

/** Um banner por vez, com setas e bolinhas (como os destaques do app do banco). */
function BannerCarousel({ hasBank }: { hasBank: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const list = banners(hasBank)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const on = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])
  const goTo = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  const arrow = 'grid size-9 place-items-center rounded-full bg-surface text-ink transition hover:bg-surface-2 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-primary'

  return (
    <section aria-roledescription="carrossel" aria-label="Para você" className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[1.25rem] font-bold tracking-tight">Para você</h2>
        <div className="flex items-center gap-2">
          <span className="mr-2 flex gap-1.5" aria-hidden>
            {list.map((b, i) => (
              <span key={b.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-surface-2'}`} />
            ))}
          </span>
          <button type="button" aria-label="Anterior" disabled={index === 0} onClick={() => goTo(index - 1)} className={arrow}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label="Próximo" disabled={index === list.length - 1} onClick={() => goTo(index + 1)} className={arrow}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div ref={track} className="mt-4 flex snap-x snap-mandatory overflow-x-auto rounded-[1.25rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((b, i) => (
          <Link
            key={b.title}
            to={b.to}
            aria-label={`${i + 1} de ${list.length}: ${b.title}`}
            className="group relative flex h-[10.5rem] w-full shrink-0 snap-start overflow-hidden rounded-[1.25rem] p-7 text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
            style={{ background: b.bg }}
          >
            <span aria-hidden className="absolute -right-8 -bottom-28 size-80 rounded-full bg-white/[0.08]" />
            <span className="relative z-10 flex max-w-[64%] flex-col">
              <span className="text-[1.3125rem] leading-tight font-extrabold tracking-[-0.01em]">{b.title}</span>
              <span className="mt-1.5 text-[0.9375rem] leading-snug">{b.text}</span>
              <span className="mt-auto inline-flex w-fit rounded-full bg-white px-4 py-1.5 text-[0.875rem] font-bold" style={{ color: b.ink }}>
                {b.cta}
              </span>
            </span>
            <MascotArt name={b.art} px={150} className="absolute right-6 -bottom-3 mx-0 transition-transform duration-300 ease-out group-hover:-translate-y-1" />
          </Link>
        ))}
      </div>
    </section>
  )
}

/** "Hoje você pode gastar" desenhado como um cartão de banco, com o porquinho no lugar da bandeira. */
function TodayCard({ t, hidden, onSetSalary }: { t: TodayBudget | CashToday | null; hidden: boolean; onSetSalary: () => void }) {
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  const shell = 'relative flex h-[13.5rem] w-[24rem] shrink-0 flex-col overflow-hidden rounded-[1.375rem] bg-gradient-to-br from-[#3A7BF2] to-[#1A4FC4] p-6 text-white shadow-[0_26px_50px_-26px_rgb(29_95_214/0.9)]'
  const deco = (
    <>
      <span aria-hidden className="absolute -top-16 -right-12 size-56 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-24 left-24 size-56 rounded-full bg-white/[0.06]" />
    </>
  )
  if (!t) {
    return (
      <div className={shell} data-tour="hoje">
        {deco}
        <p className="relative text-[1.125rem] font-bold">Quanto você pode gastar por dia?</p>
        <p className="relative mt-1 max-w-[15rem] text-[0.875rem] leading-snug">Informe o salário e o dia do pagamento: o app faz a conta.</p>
        <button type="button" onClick={onSetSalary} className="relative mt-auto w-fit rounded-full bg-white px-4 py-2 text-[0.9375rem] font-bold text-[#1D5FD6]">
          Informar salário
        </button>
        <span className="absolute right-4 bottom-2"><Pig art="rosto-pensativo" px={104} still /></span>
      </div>
    )
  }
  const cash = 'payDate' in t ? t : null
  const over = t.leftToday < 0
  const ratio = t.dailyAllowance > 0 ? t.spentToday / t.dailyAllowance : 0
  const warn = !over && ratio >= 0.8
  const art = over ? 'tela-alerta' : warn ? 'rosto-preocupado' : 'rosto-feliz'
  return (
    <div className={shell} data-tour="hoje">
      {deco}
      <p className="relative text-[0.9375rem] font-medium">Hoje você pode gastar</p>
      {over ? (
        <p className="relative mt-1 text-[2rem] leading-tight font-extrabold tracking-tight text-[#FFE1D8]">Passou {money(-t.leftToday)}</p>
      ) : (
        <AnimatedMoney cents={t.leftToday} className="relative mt-0.5 block text-[2.625rem] leading-tight font-extrabold tracking-[-0.03em]" />
      )}
      <span className="relative mt-1 inline-flex w-fit rounded-full bg-black/15 px-2.5 py-0.5 text-[0.8125rem] font-semibold">
        {cash ? (t.daysLeft === 1 ? 'O salário cai amanhã' : `Faltam ${t.daysLeft} dias para o salário`) : t.daysLeft === 1 ? 'Último dia do mês' : `Faltam ${t.daysLeft} dias`}
      </span>
      <div className="relative mt-auto max-w-[14rem]">
        {t.dailyAllowance > 0 ? (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Gasto de hoje" aria-valuenow={Math.round(Math.min(1, ratio) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`bar-fill h-full rounded-full ${over ? 'bg-[#FF8A70]' : warn ? 'bg-[#FFC94D]' : 'bg-white'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-[0.8125rem]">{over ? 'Amanhã o valor se ajusta sozinho.' : `${money(t.spentToday)} de ${money(t.dailyAllowance)} hoje`}</p>
          </>
        ) : (
          <p className="text-[0.8125rem] leading-snug">{cash ? `Evite gastos até o dia ${Number(cash.payDate.slice(8))}.` : 'O dinheiro do dia a dia do mês acabou.'}</p>
        )}
      </div>
      <span className="absolute right-3 bottom-1"><Pig art={art} px={118} /></span>
    </div>
  )
}

type Tab = 'gastos' | 'renda' | 'resultado'
export type Detail = { key: string; label: string; color: string; cents: number; pct: number }

/** Painel cinza da direita: busca, o mês em números, a evolução em linha e para onde foi o dinheiro. */
function SidePanel({ series, details, monthName, hidden }: { series: MonthPoint[]; details: Record<Tab, Detail[]>; monthName: string; hidden: boolean }) {
  const navigate = useNavigate()
  const dark = useIsDark()
  const [tab, setTab] = useState<Tab>('gastos')
  const [q, setQ] = useState('')
  const field = tab === 'gastos' ? 'expense' : tab === 'renda' ? 'income' : 'balance'
  const data = series.map((m) => ({ label: m.label, value: m[field] }))
  const now = data.at(-1)?.value ?? 0
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  const short = (c: number) => (Math.abs(c) >= 100000 ? `${(c / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(c / 100)))
  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/extrato?busca=${encodeURIComponent(q.trim())}` : '/extrato')
  }
  const tabs: [Tab, string][] = [['gastos', 'Gastos'], ['renda', 'Renda'], ['resultado', 'Resultado']]
  // No escuro, as cores escuras de categoria (ex.: Educação) ficam mais claras para aparecer
  const list = details[tab].slice(0, 5).map((d) => ({ ...d, color: liftForDark(d.color, dark) }))

  return (
    <aside className="sticky top-0 flex h-dvh w-[26rem] shrink-0 flex-col overflow-y-auto bg-surface px-8 py-8 [scrollbar-width:thin]">
      <form role="search" onSubmit={search} className="flex h-12 items-center gap-2 rounded-full border-2 border-primary/30 bg-bg pr-2 pl-5 transition-colors focus-within:border-primary">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar um gasto (mercado, Uber…)" aria-label="Buscar no extrato" className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted" />
        <button type="submit" aria-label="Buscar" className="grid size-9 place-items-center rounded-full text-primary-strong hover:bg-primary-soft">
          <Search className="size-[1.125rem]" strokeWidth={2.4} aria-hidden />
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div role="tablist" aria-label="O que ver" className="flex gap-5">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`relative pb-1.5 text-[0.9375rem] transition-colors ${tab === k ? 'font-bold text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary' : 'font-medium text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/mes" className="rounded-full border border-line bg-bg px-3 py-1 text-[0.8125rem] font-semibold capitalize hover:border-primary">
          {monthName}
        </Link>
      </div>

      <p className={`num mt-7 text-center text-[2rem] leading-tight font-extrabold tracking-[-0.02em] ${tab === 'resultado' && now < 0 ? 'text-danger-strong' : ''}`}>{money(Math.abs(now))}</p>
      <p className="text-center text-[0.875rem] text-muted">
        {tab === 'gastos' ? 'gastos' : tab === 'renda' ? 'renda' : now < 0 ? 'faltou' : 'resultado'} em {monthName}
      </p>

      <div className="mt-5 h-44" aria-hidden={hidden}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={58} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v: number) => (hidden ? '' : short(v))} />
            <Tooltip
              cursor={{ stroke: 'var(--line)', strokeWidth: 2 }}
              content={({ active, payload, label }) =>
                active && payload?.[0] ? (
                  <div className="rounded-[0.6rem] bg-ink px-2.5 py-1.5 text-[0.8125rem] font-semibold text-on-ink shadow-lg">
                    {label}: {money(payload[0].value as number)}
                  </div>
                ) : null
              }
            />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--bg)', stroke: 'var(--primary)', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={700} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-7 text-[1rem] font-bold">{tab === 'gastos' ? 'Para onde foi' : tab === 'renda' ? 'De onde veio' : 'Como o mês se dividiu'}</h3>
      {list.length === 0 ? (
        <p className="mt-2 text-[0.875rem] text-muted">Nada neste mês ainda.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {list.map((d) => (
            <li key={d.key}>
              <span className="flex items-center gap-2 text-[0.875rem]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="min-w-0 flex-1 truncate font-medium">{d.label}</span>
                <span className="num font-semibold">{money(d.cents)}</span>
                <span className="num w-10 text-right text-[0.8125rem] text-muted">{Math.round(d.pct * 100)}%</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.round(d.pct * 100))}%`, background: d.color }} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link to="/mes" className="mt-8 self-end rounded-full bg-primary px-5 py-2.5 text-[0.9375rem] font-bold text-on-primary transition hover:brightness-110">
        Ver o mês
      </Link>
    </aside>
  )
}

export type MoneyLine = { label: string; cents: number | null; hint?: string; tone?: 'bad' }

/**
 * Início no computador, como o internet banking: à esquerda o "Olá", o cartão com quanto dá para gastar hoje,
 * o dinheiro de verdade, os atalhos, os destaques e as últimas transações; à direita, o painel do mês.
 */
export function DesktopHome({
  greeting,
  t,
  hidden,
  onSetSalary,
  moneyLines,
  cashInfo,
  hasBank,
  attention,
  attentionCount,
  recent,
  series,
  details,
  monthName,
}: {
  greeting: string
  t: TodayBudget | CashToday | null
  hidden: boolean
  onSetSalary: () => void
  moneyLines: MoneyLine[]
  cashInfo: boolean
  hasBank: boolean
  attention: ReactNode
  attentionCount: number
  recent: ReactNode
  series: MonthPoint[]
  details: Record<Tab, Detail[]>
  monthName: string
}) {
  const money = (c: number) => (hidden ? 'R$ ••••' : formatBRL(c))
  return (
    <div className="flex min-h-dvh">
      <div className="min-w-0 flex-1 px-12 pt-10 pb-12">
        <div className="mx-auto max-w-[52rem]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[2.125rem] leading-tight font-extrabold tracking-[-0.025em]">{greeting}</h1>
              <p className="mt-1 text-[0.9375rem] text-muted">Que bom te ver. Aqui está o seu dinheiro hoje.</p>
            </div>
            <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className="grid size-11 place-items-center rounded-full bg-surface text-ink transition hover:bg-surface-2">
              {hidden ? <EyeSlash size={22} /> : <Eye size={22} />}
            </button>
          </div>

          <h2 className="mt-9 text-[1.25rem] font-bold tracking-tight">Hoje</h2>
          <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-5">
            <TodayCard t={t} hidden={hidden} onSetSalary={onSetSalary} />
            <div className="min-w-[14rem] flex-1 pt-1">
              <p className="flex items-center gap-1.5 text-[0.9375rem] font-bold">
                <Info className="size-[1.125rem] text-primary-strong" aria-hidden /> Seu dinheiro
              </p>
              <dl className="mt-3 flex flex-col gap-3">
                {moneyLines.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[0.8125rem] text-muted">{m.label}</dt>
                    <dd className={`num text-[1.125rem] font-bold ${m.tone === 'bad' ? 'text-danger-strong' : ''}`}>{m.cents == null ? <span className="text-[0.9375rem] font-semibold text-muted">{m.hint}</span> : money(m.cents)}</dd>
                    {m.cents != null && m.hint && <dd className="text-[0.8125rem] text-muted">{m.hint}</dd>}
                  </div>
                ))}
              </dl>
              <Link to="/ajuda" className="mt-3 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-primary-strong hover:underline">
                {cashInfo ? 'Como é feita a conta do dia' : 'Como é feita a conta'} <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link to="/lancar?tipo=dia" className="rounded-full bg-primary px-6 py-2.5 text-[0.9375rem] font-bold text-on-primary shadow-[0_10px_20px_-12px_rgb(47_111_235/0.9)] transition hover:brightness-110">
              Lançar gasto
            </Link>
            <Link to="/separar" className="inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-primary-strong hover:underline">
              Separar salário <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link to="/caixinhas" className="inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-primary-strong hover:underline">
              Guardar numa caixinha <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>

          {attentionCount > 0 && (
            <section data-tour="atencao" className="mt-10">
              <h2 className="mb-3 text-[1.25rem] font-bold tracking-tight">Precisa da sua atenção</h2>
              {attention}
            </section>
          )}

          <BannerCarousel hasBank={hasBank} />

          <section className="mt-10">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[1.25rem] font-bold tracking-tight">Transações recentes</h2>
              <Link to="/extrato" className="inline-flex items-center gap-0.5 text-[0.9375rem] font-semibold text-primary-strong hover:underline">
                Ver extrato <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            {recent}
          </section>
        </div>
      </div>
      <SidePanel series={series} details={details} monthName={monthName} hidden={hidden} />
    </div>
  )
}

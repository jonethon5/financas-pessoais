import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowCircleDown, Bank, CalendarCheck, CalendarDots, CreditCard, PiggyBank, Receipt, SplitHorizontal, Stack, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MascotArt } from '../components/Pig'
import { formatBRL } from '../lib/money'

/** Atalhos redondos do topo (como os do app do banco): o que a pessoa mais faz. */
const ACTIONS: { label: string; to: string; icon: PhosphorIcon }[] = [
  { label: 'Gasto', to: '/lancar?tipo=dia', icon: Receipt },
  { label: 'Renda', to: '/lancar?tipo=renda', icon: ArrowCircleDown },
  { label: 'Gasto fixo', to: '/lancar?tipo=fixo', icon: CalendarCheck },
  { label: 'Parcelado', to: '/lancar?tipo=parcelado', icon: Stack },
  { label: 'Guardar', to: '/caixinhas', icon: PiggyBank },
  { label: 'Separar salário', to: '/separar', icon: SplitHorizontal },
]

function QuickActions() {
  return (
    <nav aria-label="Atalhos" className="flex gap-3">
      {ACTIONS.map((a) => (
        <Link key={a.label} to={a.to} className="group flex w-[5.5rem] flex-col items-center gap-2 rounded-[1rem] text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="grid size-16 place-items-center rounded-full bg-white/15 transition-colors duration-150 group-hover:bg-white/25 group-active:bg-white/30">
            <a.icon size={28} weight="regular" aria-hidden />
          </span>
          <span className="text-[0.875rem] leading-tight font-semibold">{a.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export type ProductCardData = {
  to: string
  title: string
  icon: PhosphorIcon
  /** Rótulo pequeno acima do valor */
  label: string
  cents: number | null
  /** Texto no lugar do valor (quando não tem número, ex.: banco não conectado) */
  empty?: string
  sub?: ReactNode
  tone?: 'ink' | 'good' | 'bad'
  progress?: number | null
}

function ProductCard({ c, hidden }: { c: ProductCardData; hidden: boolean }) {
  const money = (cents: number) => (hidden ? 'R$ ••••' : formatBRL(cents))
  return (
    <Link
      to={c.to}
      className="group flex min-h-[11rem] flex-col rounded-[1.25rem] bg-surface p-5 shadow-soft transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(15_36_51/0.05),0_20px_40px_-20px_rgb(15_36_51/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 text-[1rem] font-bold">
          <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary-strong">
            <c.icon size={20} weight="duotone" aria-hidden />
          </span>
          {c.title}
        </span>
        <ChevronRight className="size-5 text-faint transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="mt-6">
        <span className="block text-[0.875rem] text-muted">{c.label}</span>
        {c.cents != null ? (
          <span className={`num mt-0.5 block text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] ${c.tone === 'good' ? 'text-primary-strong' : c.tone === 'bad' ? 'text-danger-strong' : ''}`}>{money(c.cents)}</span>
        ) : (
          <span className="mt-0.5 block text-[1.125rem] leading-snug font-bold">{c.empty}</span>
        )}
        {c.progress != null && (
          <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-grow" style={{ width: `${Math.round(Math.min(1, Math.max(0, c.progress)) * 100)}%` }} />
          </span>
        )}
        {c.sub && <span className="mt-1.5 block text-[0.8125rem] leading-snug text-muted">{c.sub}</span>}
      </span>
    </Link>
  )
}

type Banner = { title: string; text: string; cta: string; to: string; art: string; bg: string; ink: string }

function banners(hasBank: boolean): Banner[] {
  return [
    { title: 'Guarde primeiro, gaste depois', text: 'Quando o salário cair, separe o das caixinhas. O que sobra é o do mês.', cta: 'Separar salário', to: '/separar', art: 'tela-economia', bg: 'linear-gradient(135deg,#0B8A5F,#065A3E)', ink: '#065A3E' },
    hasBank
      ? { title: 'Como está sua saúde financeira?', text: 'Um resumo de como anda o seu dinheiro e por onde começar.', cta: 'Ver minha saúde', to: '/saude', art: 'tela-resumo', bg: 'linear-gradient(135deg,#1B4A9C,#0F2B66)', ink: '#0F2B66' }
      : { title: 'Conecte seu banco', text: 'Pelo Open Finance os gastos entram sozinhos, sem digitar nada.', cta: 'Conectar', to: '/voce/bancos', art: 'tela-conexao', bg: 'linear-gradient(135deg,#1B4A9C,#0F2B66)', ink: '#0F2B66' },
    { title: 'Desafios curtos, dinheiro guardado', text: 'Metas de poucos dias para segurar os gastos, como as 52 semanas.', cta: 'Ver desafios', to: '/habitos', art: 'tela-metas', bg: 'linear-gradient(135deg,#5B45D6,#3B2A9E)', ink: '#3B2A9E' },
    { title: 'Quer comprar algo? Espere 30 dias', text: 'Anote na lista de desejos. Se a vontade passar, o dinheiro fica com você.', cta: 'Lista de desejos', to: '/habitos', art: 'rosto-pensativo', bg: 'linear-gradient(135deg,#C2410C,#8F2F08)', ink: '#8F2F08' },
    { title: 'Sair das dívidas, passo a passo', text: 'Lições curtas, com base em estudos e sem economês.', cta: 'Aprender', to: '/aprender', art: 'tela-relatorios', bg: 'linear-gradient(135deg,#0E6E8C,#08475C)', ink: '#08475C' },
    { title: 'Roupinhas novas para o porquinho', text: 'Cumpra as metas do dia, ganhe moedas e troque na loja.', cta: 'Abrir a loja', to: '/porquinho', art: 'loja-oculos-sol', bg: 'linear-gradient(135deg,#C22E5C,#8E1D41)', ink: '#8E1D41' },
  ]
}

/** Banners em carrossel (dois por vez), com setas para passar. */
function BannerCarousel({ hasBank }: { hasBank: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const list = banners(hasBank)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const on = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
    on()
    el.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      el.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  const go = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * (track.current.clientWidth / 2 + 8), behavior: 'smooth' })
  const arrow = 'grid size-10 place-items-center rounded-full bg-surface text-ink shadow-soft transition hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary'

  return (
    <section aria-roledescription="carrossel" aria-label="Para você" className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[1.375rem] font-extrabold tracking-tight">Para você</h2>
        <div className="flex gap-2">
          <button type="button" aria-label="Anterior" disabled={edge.start} onClick={() => go(-1)} className={arrow}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label="Próximo" disabled={edge.end} onClick={() => go(1)} className={arrow}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div ref={track} className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((b) => (
          <Link
            key={b.title}
            to={b.to}
            className="group relative flex h-[12rem] w-[calc(50%-0.5rem)] shrink-0 snap-start overflow-hidden rounded-[1.5rem] p-7 text-white shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ background: b.bg }}
          >
            <span aria-hidden className="absolute -right-10 -bottom-24 size-72 rounded-full bg-white/[0.08]" />
            <span className="relative z-10 flex max-w-[62%] flex-col">
              <span className="text-[1.3125rem] leading-tight font-extrabold tracking-[-0.01em] text-balance">{b.title}</span>
              <span className="mt-2 text-[0.9375rem] leading-snug">{b.text}</span>
              <span className="mt-auto inline-flex w-fit rounded-full bg-white px-4 py-2 text-[0.875rem] font-bold transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: b.ink }}>
                {b.cta}
              </span>
            </span>
            <MascotArt name={b.art} px={168} className="absolute right-3 -bottom-2 mx-0 transition-transform duration-300 ease-out group-hover:-translate-y-1" />
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Bloco branco do Início (atenção, últimos gastos), com título e link. */
export function DeskPanel({ title, to, tour, children }: { title: string; to?: string; tour?: string; children: ReactNode }) {
  return (
    <section data-tour={tour} className="rounded-[1.25rem] bg-surface p-6 shadow-soft [&_ul.shadow-soft]:shadow-none">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1.25rem] font-extrabold tracking-tight">{title}</h2>
        {to && (
          <Link to={to} className="flex items-center gap-0.5 rounded-full px-2 py-1 text-[0.9375rem] font-semibold text-primary-strong hover:bg-primary-soft">
            Ver tudo <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * Início no computador, como o internet banking: topo azul com o valor do dia e os atalhos,
 * os cartões (conta, cartão, caixinhas, mês) subindo sobre o azul, banners e, embaixo, atenção e últimos gastos.
 */
export function DesktopHome({
  greeting,
  hero,
  cards,
  hidden,
  hasBank,
  attention,
  recent,
}: {
  greeting: string
  hero: ReactNode
  cards: ProductCardData[]
  hidden: boolean
  hasBank: boolean
  attention: ReactNode
  recent: ReactNode
}) {
  return (
    <div className="flex flex-col pb-4">
      <section className="brand-bleed -mx-4 bg-gradient-to-b from-[#2F6FEB] to-[#1D5FD6] px-4 pt-8 pb-28 text-white">
        <p className="text-[1.625rem] font-extrabold tracking-[-0.02em]">{greeting}</p>
        <div className="mt-1 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between xl:gap-12">
          <div className="w-full max-w-[32rem]">{hero}</div>
          <QuickActions />
        </div>
      </section>

      <div className="relative z-10 -mt-16 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <ProductCard key={c.title} c={c} hidden={hidden} />
        ))}
      </div>

      <BannerCarousel hasBank={hasBank} />

      <div className="mt-10 grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
        <DeskPanel title="Precisa da sua atenção" tour="atencao">
          {attention}
        </DeskPanel>
        <DeskPanel title="Últimos gastos" to="/extrato">
          {recent}
        </DeskPanel>
      </div>
    </div>
  )
}

export const CARD_ICONS = { Bank, CreditCard, PiggyBank, CalendarDots }

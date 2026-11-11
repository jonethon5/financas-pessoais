import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CalendarCheck, ChartPieSlice, Heart, PiggyBank, ShareNetwork, TrendDown, TrendUp, X } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { Spinner } from '../components/ui'
import { useGoalMoves } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { addMonths, currentYearMonth, formatDateShort, monthLabel, parseMonthKey } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { compareText, monthRecap, weekRecap, type Recap } from '../lib/psych'

const EMOTION: Record<string, string> = { comemorando: 'comemorando', estressado: 'estressado', entediado: 'entediado', cansado: 'cansado' }
const SLIDE_MS = 5500

type Slide = { bg: string; icon: ReactNode; kicker: string; title: string; text?: string }

/** Revisão da semana (/revisao) e retrospectiva do mês (/retrospectiva?mes=AAAA-MM), em telas tipo stories. */
export function StoriesPage({ kind }: { kind: 'semana' | 'mes' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const now = currentYearMonth()
  // Retrospectiva: por padrão o mês que passou (nos primeiros dias) ou o atual
  const ym = parseMonthKey(params.get('mes')) ?? (new Date().getDate() <= 7 ? addMonths(now, -1) : now)
  const view = useMonthView(ym)
  const prevView = useMonthView(addMonths(ym, -1))
  const moves = useGoalMoves()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const slides = useMemo<Slide[] | null>(() => {
    if (!view.data || !prevView.data || !moves.data) return null
    const txs = [...new Map([...view.data.history, ...prevView.data.txs, ...view.data.txs].map((t) => [t.id, t])).values()]
    const r: Recap & { from?: string; to?: string } = kind === 'semana' ? weekRecap(txs, moves.data, view.data.categories, view.data.today) : monthRecap(txs, moves.data, view.data.categories, ym, view.data.today)
    const period = kind === 'semana' ? `${formatDateShort(r.from!)} a ${formatDateShort(r.to!)}` : monthLabel(ym)
    const list: Slide[] = [
      { bg: 'from-[#2F6FEB] to-[#163a8a]', icon: <CalendarCheck size={56} weight="duotone" />, kicker: kind === 'semana' ? 'Sua semana em 2 minutos' : 'Sua retrospectiva', title: period, text: kind === 'semana' ? 'Bora ver como foi? Toque para avançar.' : 'Um mês inteiro em poucas telas.' },
      { bg: r.spent <= r.previousSpent ? 'from-[#0F9D6B] to-[#0B4F3A]' : 'from-[#C2410C] to-[#6b2407]', icon: r.spent <= r.previousSpent ? <TrendDown size={56} weight="duotone" /> : <TrendUp size={56} weight="duotone" />, kicker: 'Você gastou', title: formatBRL(r.spent), text: compareText(r.spent, r.previousSpent) },
    ]
    if (r.topCategory) list.push({ bg: 'from-[#6E56F0] to-[#2d2275]', icon: <ChartPieSlice size={56} weight="duotone" />, kicker: 'O que mais pesou', title: r.topCategory.name, text: `${formatBRL(r.topCategory.cents)} no dia a dia${r.biggest ? `. Maior gasto: ${r.biggest.description}, ${formatBRL(r.biggest.cents)}.` : '.'}` })
    list.push({ bg: 'from-[#0E9AA7] to-[#0a4a52]', icon: <CalendarCheck size={56} weight="duotone" />, kicker: 'Dias sem gastar', title: `${r.noSpendDays} ${r.noSpendDays === 1 ? 'dia' : 'dias'}`, text: r.noSpendDays > 0 ? 'Cada dia sem gastar é dinheiro que ficou com você.' : 'Que tal tentar um dia sem gastar na próxima?' })
    if (r.byEmotion) list.push({ bg: 'from-[#D6457A] to-[#6e1f3d]', icon: <Heart size={56} weight="duotone" />, kicker: 'De olho nas emoções', title: `${formatBRL(r.byEmotion.cents)} gastos ${EMOTION[r.byEmotion.emotion] ?? ''}`, text: 'Perceber quando o gasto vem da emoção já é meio caminho para escolher melhor.' })
    list.push({ bg: 'from-[#FF6B4A] to-[#8a2a14]', icon: <PiggyBank size={56} weight="duotone" />, kicker: 'Nas caixinhas', title: formatBRL(Math.max(0, r.saved)), text: r.saved > 0 ? 'Você pagou a si mesmo primeiro. Isso é o que mais importa.' : 'Na próxima, separe primeiro o das caixinhas, nem que seja pouco.' })
    list.push({ bg: 'from-[#0F2433] to-[#05121b]', icon: <Heart size={56} weight="duotone" />, kicker: 'Fechou', title: r.spent <= r.previousSpent || r.saved > 0 ? 'Mandou bem' : 'Vamos ajustar juntos', text: kind === 'semana' ? 'Nova semana, nova chance. Escolha um desafio em Hábitos.' : 'Mês novo, página em branco. Separe o salário primeiro.' })
    return list
  }, [view.data, prevView.data, moves.data, kind, ym])

  useEffect(() => {
    if (!slides || paused) return
    const t = setTimeout(() => (index < slides.length - 1 ? setIndex((i) => i + 1) : undefined), SLIDE_MS)
    return () => clearTimeout(t)
  }, [index, slides, paused])

  if (!slides) return <div className="grid min-h-dvh place-items-center bg-ink"><Spinner /></div>
  const s = slides[index]

  async function share() {
    if (!slides) return
    const blob = await summaryImage(slides, kind === 'semana' ? 'Minha semana' : monthLabel(ym))
    const file = new File([blob], 'resumo.png', { type: 'image/png' })
    const text = `${slides[1].kicker}: ${slides[1].title}. ${slides[1].text ?? ''}`
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'resumo.png'
        a.click()
      }
    } catch {
      /* cancelou */
    }
  }

  return (
    <div className={`fixed inset-0 z-40 flex flex-col bg-gradient-to-b ${s.bg} text-white transition-colors duration-500`}>
      <div className="pt-safe mx-auto flex w-full max-w-[30rem] gap-1 px-3 pt-3">
        {slides.map((_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <span className={`block h-full rounded-full bg-white ${i < index ? 'w-full' : i === index && !paused ? 'animate-story' : 'w-0'}`} style={i === index ? { animationDuration: `${SLIDE_MS}ms` } : undefined} key={`${i}-${index}`} />
          </span>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-[30rem] items-center justify-between px-4 py-3">
        <span className="text-[0.9375rem] font-semibold opacity-90">{APP_NAME}</span>
        <button type="button" aria-label="Fechar" onClick={() => navigate(-1)} className="grid size-10 place-items-center rounded-full bg-white/15">
          <X size={20} weight="bold" />
        </button>
      </div>
      <button
        type="button"
        className="relative mx-auto flex w-full max-w-[30rem] flex-1 flex-col justify-center px-8 text-left"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onClick={(e) => {
          const left = e.clientX < window.innerWidth / 3
          setIndex((i) => (left ? Math.max(0, i - 1) : Math.min(slides.length - 1, i + 1)))
        }}
        aria-label="Avançar"
      >
        <div key={index} className="animate-pop">
          <span className="mb-6 grid size-20 place-items-center rounded-[1.5rem] bg-white/15">{s.icon}</span>
          <p className="text-[1.0625rem] font-semibold opacity-80">{s.kicker}</p>
          <p className="mt-1 text-[2.5rem] leading-[1.05] font-extrabold tracking-tight">{s.title}</p>
          {s.text && <p className="mt-4 max-w-sm text-[1.1875rem] leading-snug opacity-90">{s.text}</p>}
        </div>
      </button>
      <div className="pb-safe mx-auto w-full max-w-[30rem] px-6 pb-6">
        {index === slides.length - 1 ? (
          <button type="button" onClick={share} className="press flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.875rem] bg-white font-semibold text-ink">
            <ShareNetwork size={20} weight="bold" /> Compartilhar resumo
          </button>
        ) : (
          <p className="text-center text-[0.875rem] opacity-70">Toque na direita para avançar, na esquerda para voltar</p>
        )}
      </div>
    </div>
  )
}

/** Imagem 1080×1920 com o resumo (para mandar no WhatsApp ou nos stories). */
async function summaryImage(slides: Slide[], title: string): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1920
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 1920)
  g.addColorStop(0, '#2F6FEB')
  g.addColorStop(1, '#0F2433')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1080, 1920)
  await document.fonts.ready
  const font = (w: number, s: number) => `${w} ${s}px "Manrope Variable", system-ui, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.font = font(700, 44)
  ctx.fillText(APP_NAME, 90, 150)
  ctx.font = font(800, 92)
  ctx.fillText(title, 90, 320)
  let y = 520
  for (const s of slides.slice(1, -1)) {
    ctx.globalAlpha = 0.75
    ctx.font = font(600, 40)
    ctx.fillText(s.kicker, 90, y)
    ctx.globalAlpha = 1
    ctx.font = font(800, 72)
    ctx.fillText(s.title.length > 22 ? `${s.title.slice(0, 21)}…` : s.title, 90, y + 90)
    y += 250
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'))
}

import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUp, Lifebuoy, Scissors, ShoppingCart, Stethoscope, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Sheet } from '../components/Sheet'
import { BackButton, Button, Chip, ErrorBox, Field, NavBar, Spinner } from '../components/ui'
import { useRecurrings } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { subscriptions } from '../lib/budget'
import { buildFacts, cutPlan, localAnswer, purchaseImpact, purchaseLines, type CoachInput, type CoachKind, type Purchase } from '../lib/coach'
import { currentYearMonth } from '../lib/dates'
import { financialHealth } from '../lib/health'
import { LESSONS } from '../lib/learn'
import { formatBRL, parseBRL } from '../lib/money'
import { callFunction, friendlyError } from '../lib/supabase'
import { TONES } from './you/YouPage'
import type { AiTone } from '../types'

type Msg = { id: number; role: 'user' | 'model'; text: string; card?: string[]; auto?: boolean }

const ACTIONS: { kind: CoachKind; label: string; ask: string; icon: PhosphorIcon; color: string }[] = [
  { kind: 'diagnostico', label: 'Diagnóstico do mês', ask: 'Como está o meu mês?', icon: Stethoscope, color: '#2F6FEB' },
  { kind: 'corte', label: 'Plano de corte', ask: 'Onde posso cortar para guardar mais?', icon: Scissors, color: '#0F9D6B' },
  { kind: 'comprar', label: 'Posso comprar isso?', ask: '', icon: ShoppingCart, color: '#FF6B4A' },
  { kind: 'dividas', label: 'Sair das dívidas', ask: 'Como saio das dívidas?', icon: Lifebuoy, color: '#6E56F0' },
]

/** Texto com **negrito**, listas "- " e citações de lições viram links para o Aprender. */
function Rich({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|“[^”]+”|"[^"]+")/g).map((part, i) => {
      if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
      const quoted = /^[“"](.+)[”"]$/.exec(part)?.[1]
      const lesson = quoted && LESSONS.find((l) => l.title.toLowerCase() === quoted.toLowerCase())
      if (lesson) return <Link key={i} to={`/aprender/${lesson.id}`} className="font-semibold text-primary underline decoration-primary/30 underline-offset-2">“{lesson.title}”</Link>
      return <Fragment key={i}>{part}</Fragment>
    })
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="flex list-disc flex-col gap-1 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>)
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (/^[-*•]\s+/.test(line)) list.push(line.replace(/^[-*•]\s+/, ''))
    else {
      flush()
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ''))}</p>)
    }
  }
  flush()
  return <div className="flex flex-col gap-2">{blocks}</div>
}

function useCoachInput(): { input: CoachInput | null; tone: AiTone; isPending: boolean; error: unknown; refetch: () => void } {
  const view = useMonthView(currentYearMonth())
  const recurrings = useRecurrings()
  if (view.isPending || view.error || !view.data) return { input: null, tone: 'equilibrado', isPending: view.isPending, error: view.error, refetch: view.refetch }
  const d = view.data
  const hasSalary = d.profile.salary_cents != null && d.profile.payday != null
  const input: CoachInput = {
    today: d.today, salaryCents: d.profile.salary_cents, payday: d.profile.payday, hoursWeek: d.profile.work_hours_week ?? 44,
    summary: d.summary, todayBudget: d.todayBudget, statuses: d.statuses, history: d.history, monthTxs: d.txs, goals: d.goals,
    subs: subscriptions(recurrings.data ?? [], d.history),
    health: financialHealth({ today: d.today, monthTxs: d.txs, history: d.history, goals: d.goals, goalMoves: d.goalMoves, categories: d.categories, hasSalary }),
  }
  return { input, tone: d.profile.ai_tone, isPending: false, error: null, refetch: view.refetch }
}

/** Assistente: o app faz as contas; a IA (Gemini) explica no tom escolhido. Sem IA ligada, o app responde sozinho. */
export function AssistantPage() {
  const navigate = useNavigate()
  const { mode } = useAuth()
  const { input, tone, isPending, error, refetch } = useCoachInput()
  const usage = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => callFunction<{ used: number; limit: number; configured: boolean }>('ask', { action: 'usage' }),
    enabled: mode === 'supabase',
    retry: false,
  })
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [buying, setBuying] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const ai = mode === 'supabase' && usage.data?.configured === true

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, busy])

  if (isPending) return <Spinner />
  if (error || !input) return <ErrorBox message={friendlyError(error)} onRetry={refetch} />

  async function send(kind: CoachKind, ask: string, extra?: { purchase: Purchase; item: string }) {
    if (busy || !input) return
    const card = extra ? purchaseLines(extra.purchase, extra.item) : undefined
    const userMsg: Msg = { id: Date.now(), role: 'user', text: ask }
    setMsgs((m) => [...m, userMsg])
    setBusy(true)
    const auto = () => localAnswer(kind, input, tone, extra)
    try {
      if (!ai) {
        await new Promise((r) => setTimeout(r, 450))
        setMsgs((m) => [...m, { id: Date.now() + 1, role: 'model', text: auto(), card, auto: true }])
        return
      }
      const plan = kind === 'corte' ? cutPlan(input, tone) : null
      const calc = card?.join('\n') ?? (plan ? [`Plano de corte (tom ${tone}): ${formatBRL(plan.monthlyCents)} por mês, ${formatBRL(plan.yearlyCents)} por ano.`, ...plan.items.map((i) => `- ${i.label}: hoje ${formatBRL(i.nowCents)} por mês; cortar ${formatBRL(i.saveCents)} (${i.how})`)].join('\n') : '')
      const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }))
      const r = await callFunction<{ answer: string; used: number; limit: number }>('ask', { action: 'ask', kind, question: kind === 'pergunta' ? ask : '', facts: buildFacts(input), extra: calc, history })
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'model', text: r.answer, card }])
      void usage.refetch()
    } catch (err) {
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'model', text: `${friendlyError(err)}\n\nEnquanto isso, a resposta do app:\n\n${auto()}`, card, auto: true }])
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    void send('pergunta', q)
  }

  const toneLabel = TONES.find((t) => t.value === tone)?.label ?? 'Equilibrado'

  return (
    <>
      <NavBar title="Assistente" left={<BackButton label="Início" onClick={() => navigate('/')} />} />
      <div className="flex flex-col gap-5 pb-24">
        {msgs.length === 0 && (
          <p className="px-1 text-[1.0625rem] leading-snug text-muted">
            O app faz as contas com os seus números e o assistente explica o que fazer, com métodos do <Link to="/aprender" className="font-semibold text-primary">Aprender</Link>.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {ACTIONS.map((a) => (
            <button
              key={a.kind}
              type="button"
              disabled={busy}
              onClick={() => (a.kind === 'comprar' ? setBuying(true) : void send(a.kind, a.ask))}
              className="press flex min-h-[5.5rem] flex-col items-start justify-between gap-2 rounded-[1.25rem] bg-surface p-3.5 text-left disabled:opacity-60"
            >
              <span className="grid size-10 place-items-center rounded-[0.75rem]" style={{ background: `${a.color}1f`, color: a.color }}>
                <a.icon size={22} weight="duotone" />
              </span>
              <span className="leading-tight font-semibold">{a.label}</span>
            </button>
          ))}
        </div>

        <p className="px-1 text-[0.8125rem] leading-snug text-muted">
          Tom: <strong className="text-ink">{toneLabel}</strong> (mude em <Link to="/voce" className="text-primary">Você</Link>)
          {' · '}
          {mode === 'demo' ? 'na demonstração, quem responde é o próprio app, sem IA' : ai ? `${usage.data!.used} de ${usage.data!.limit} perguntas hoje` : usage.isPending ? 'verificando…' : 'a IA ainda não foi ligada: quem responde é o próprio app'}
        </p>

        {msgs.length > 0 && (
          <div className="flex flex-col gap-3">
            {msgs.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} className="animate-pop ml-10 self-end rounded-[1.25rem] rounded-br-md bg-primary px-4 py-2.5 leading-snug text-on-primary">{m.text}</p>
              ) : (
                <div key={m.id} className="animate-pop mr-4 flex flex-col gap-3 self-start rounded-[1.25rem] rounded-bl-md bg-surface px-4 py-3 leading-snug">
                  {m.card && (
                    <ul className="flex flex-col gap-1 rounded-[0.9rem] bg-bg p-3 text-[0.9375rem]">
                      {m.card.slice(1, -1).map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  )}
                  <Rich text={m.text} />
                  {m.auto && <p className="text-[0.75rem] text-muted">Resposta montada pelo app</p>}
                </div>
              ),
            )}
            {busy && (
              <div className="mr-4 flex items-center gap-1.5 self-start rounded-[1.25rem] rounded-bl-md bg-surface px-4 py-3.5" aria-label="Escrevendo">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
        <p className="px-1 text-center text-[0.75rem] leading-snug text-faint">Dicas de orçamento e hábitos. Não é recomendação de investimento.</p>
      </div>

      <form onSubmit={submit} className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-line bg-bg/95 px-4 pt-2.5 backdrop-blur-xl">
        <div className="mb-2.5 flex items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={ai ? 'Pergunte sobre o seu dinheiro' : 'Disponível com a IA ligada'}
            disabled={!ai || busy}
            aria-label="Sua pergunta"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[1.0625rem] outline-none placeholder:text-muted disabled:opacity-70"
          />
          <button type="submit" disabled={!ai || busy || !text.trim()} aria-label="Enviar" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary transition disabled:opacity-40">
            <ArrowUp size={20} weight="bold" />
          </button>
        </div>
      </form>

      <Sheet open={buying} onClose={() => setBuying(false)} title="Posso comprar isso?">
        {buying && (
          <BuyForm
            onDone={(item, cents, n) => {
              setBuying(false)
              const p = purchaseImpact(input, cents, n)
              void send('comprar', `Posso comprar ${item || 'isso'} de ${formatBRL(cents)}${n > 1 ? ` em ${n}x` : ' à vista'}?`, { purchase: p, item })
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function BuyForm({ onDone }: { onDone: (item: string, cents: number, installments: number) => void }) {
  const [item, setItem] = useState('')
  const [price, setPrice] = useState('')
  const [n, setN] = useState(1)
  const cents = parseBRL(price)
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (cents && cents > 0) onDone(item.trim().slice(0, 60), cents, n)
      }}
    >
      <Field label="O que você quer comprar?" value={item} onChange={(e) => setItem(e.target.value)} maxLength={60} placeholder="ex.: tênis, celular, geladeira" />
      <Field label="Preço" prefix="R$" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="[&_input]:text-[1.375rem] [&_input]:font-semibold" />
      <div>
        <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Como vai pagar</p>
        <div className="flex flex-wrap gap-2">
          {[1, 3, 6, 10, 12].map((x) => (
            <Chip key={x} selected={n === x} onClick={() => setN(x)}>
              {x === 1 ? 'À vista' : `${x}x`}
            </Chip>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={!cents || cents <= 0}>
        Ver se cabe
      </Button>
    </form>
  )
}

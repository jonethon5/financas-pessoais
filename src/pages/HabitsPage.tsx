import { useState, type FormEvent, type ReactNode } from 'react'
import {  useNavigate } from 'react-router'
import { ArrowsClockwise, Hourglass, Plus, Trophy, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useCelebrate } from '../components/Celebration'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { BackButton, Badge, Button, Card, ErrorBox, Field, List, Money, NavBar, ProgressBar, Row, Spinner } from '../components/ui'
import { useTable, useWrite } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { addDaysISO, currentYearMonth, formatDateShort } from '../lib/dates'
import { formatBRL, parseBRL } from '../lib/money'
import { CHALLENGES, WISH_WAIT_DAYS, challengeProgress, savedByGivingUp, wishState, workTime } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import type { Challenge, ChallengeKind, Goal, Transaction } from '../types'


function SectionHead({ icon: Icon, title, action }: { icon: PhosphorIcon; title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 text-[1.1875rem] font-extrabold tracking-tight">
        <Icon size={22} weight="duotone" className="text-primary" /> {title}
      </h2>
      {action}
    </div>
  )
}

/**
 * Desafios e desejos: as duas ferramentas que mais ajudam quem está com o dinheiro curto.
 * A lista de desejos aplica a regra dos 30 dias (a vontade de comprar passa); os desafios dão uma meta curta.
 */
export function HabitsPage() {
  const navigate = useNavigate()
  const view = useMonthView(currentYearMonth())
  const challenges = useTable('challenges')
  const wishes = useTable('wishes')
  if (view.isPending || challenges.isPending || wishes.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const d = view.data
  const allTxs = [...new Map([...d.history, ...d.txs].map((t) => [t.id, t])).values()]

  return (
    <>
      <NavBar title="Desafios e desejos" left={<BackButton label="Início" onClick={() => navigate('/')} />} />
      <div className="stagger flex flex-col gap-8">
        <Wishes salary={d.profile.salary_cents} hoursWeek={d.profile.work_hours_week} today={d.today} wishes={wishes.data ?? []} />
        <Challenges challenges={challenges.data ?? []} goals={d.goals.map((g) => g.goal)} data={d} allTxs={allTxs} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Desafios
// ---------------------------------------------------------------------------

function Challenges({ challenges, goals, data, allTxs }: { challenges: Challenge[]; goals: Goal[]; data: NonNullable<ReturnType<typeof useMonthView>['data']>; allTxs: Transaction[] }) {
  const write = useWrite()
  const toast = useToast()
  const celebrate = useCelebrate()
  const [picking, setPicking] = useState(false)
  const active = challenges.filter((c) => c.status === 'ativo')
  const done = challenges.filter((c) => c.status === 'concluido').length

  async function start(kind: ChallengeKind) {
    const def = CHALLENGES.find((c) => c.kind === kind)!
    const goal = goals.find((g) => !g.archived) ?? null
    if (kind === '52_semanas' && !goal) return toast('Crie uma caixinha antes: o desafio das 52 semanas guarda nela.')
    setPicking(false)
    try {
      await write.mutateAsync((b) =>
        b.insert('challenges', [{ kind, title: def.title, params: kind === '52_semanas' ? { base_cents: 500 } : {}, goal_id: kind === '52_semanas' ? goal!.id : null, started_on: data.today, ends_on: addDaysISO(data.today, def.days - 1), status: 'ativo' }]),
      )
      toast(`Desafio começou: ${def.title}`)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  async function setStatus(c: Challenge, status: Challenge['status'], restart = false) {
    try {
      await write.mutateAsync(async (b) => {
        await b.update('challenges', c.id, { status })
        if (restart) {
          const def = CHALLENGES.find((x) => x.kind === c.kind)!
          await b.insert('challenges', [{ kind: c.kind, title: c.title, params: c.params, goal_id: c.goal_id, started_on: data.today, ends_on: addDaysISO(data.today, def.days - 1), status: 'ativo' }])
        }
      })
      if (status === 'concluido') celebrate('Desafio concluído!', `${c.title}: você conseguiu. Isso é disciplina de verdade.`)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  async function depositWeek(c: Challenge, cents: number) {
    try {
      await write.mutateAsync((b) => b.insert('goal_moves', [{ goal_id: c.goal_id!, kind: 'deposito', amount_cents: cents, date: data.today, note: '52 semanas' }]))
      toast(`${formatBRL(cents)} guardados (52 semanas)`)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <section>
      <SectionHead
        icon={Trophy}
        title="Desafios"
        action={
          <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setPicking(true)}>
            <Plus size={16} weight="bold" /> Novo
          </Button>
        }
      />
      {active.length === 0 ? (
        <Card className="text-center text-muted">Nenhum desafio ativo. Um desafio curto é o jeito mais fácil de criar um hábito novo.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((c) => {
            const p = challengeProgress(c, allTxs, data.categories, data.goalMoves, data.today)
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[1.0625rem] font-bold">{c.title}</p>
                  {p.failed ? <Badge tone="warn">Escorregou</Badge> : p.finished ? <Badge tone="ok">Completo</Badge> : <Badge tone="primary">Dia {Math.min(p.days, p.daysDone + 1)} de {p.days}</Badge>}
                </div>
                {c.kind === '52_semanas' ? (
                  <>
                    <p className="mt-1 text-[0.9375rem] text-muted">
                      Semana {p.week}: guarde {formatBRL(p.weekTarget ?? 0)} · {formatBRL(p.savedTotal ?? 0)} de {formatBRL(p.target ?? 0)}
                    </p>
                    <ProgressBar className="mt-2.5" value={p.pct} tone="coral" label={c.title} />
                    <Button size="sm" variant="coral" className="mt-3" onClick={() => depositWeek(c, p.weekTarget ?? 0)}>
                      Guardar {formatBRL(p.weekTarget ?? 0)} desta semana
                    </Button>
                  </>
                ) : (
                  <>
                    <ProgressBar className="mt-2.5" value={p.pct} tone={p.failed ? 'warn' : 'grow'} label={c.title} />
                    {p.failed ? (
                      <div className="mt-3">
                        <p className="text-[0.9375rem] leading-snug text-muted">
                          “{p.broken[0].description}” em {formatDateShort(p.broken[0].date)}. Tudo bem, acontece: o importante é recomeçar.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => setStatus(c, 'desistiu', true)}>
                            <ArrowsClockwise size={16} weight="bold" /> Recomeçar hoje
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setStatus(c, 'desistiu')}>
                            Encerrar
                          </Button>
                        </div>
                      </div>
                    ) : p.finished ? (
                      <Button size="sm" className="mt-3" onClick={() => setStatus(c, 'concluido')}>
                        Comemorar
                      </Button>
                    ) : (
                      <p className="mt-2 text-[0.875rem] text-muted">Termina em {formatDateShort(c.ends_on)}. Você consegue!</p>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {done > 0 && <p className="mt-2 px-1 text-[0.875rem] text-muted">{done === 1 ? '1 desafio concluído' : `${done} desafios concluídos`} até agora.</p>}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Escolha um desafio">
        <List>
          {CHALLENGES.map((c) => (
            <Row key={c.kind} title={c.title} subtitle={<span className="whitespace-normal">{c.hint}</span>} trailing={<span className="font-semibold text-primary">Começar</span>} onClick={() => start(c.kind)} />
          ))}
        </List>
      </Sheet>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Regras automáticas
// ---------------------------------------------------------------------------


function Wishes({ wishes, salary, hoursWeek, today }: { wishes: import('../types').Wish[]; salary: number | null; hoursWeek: number; today: string }) {
  const write = useWrite()
  const toast = useToast()
  const celebrate = useCelebrate()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const waiting = wishes.filter((w) => w.status === 'esperando').sort((a, b) => a.decide_on.localeCompare(b.decide_on))
  const saved = savedByGivingUp(wishes)

  async function add(e: FormEvent) {
    e.preventDefault()
    const cents = parseBRL(price)
    if (!name.trim() || !cents) return setError('Diga o que é e quanto custa.')
    try {
      await write.mutateAsync((b) => b.insert('wishes', [{ name: name.trim(), price_cents: cents, link: null, decide_on: addDaysISO(today, WISH_WAIT_DAYS), status: 'esperando', decided_at: null }]))
      toast(`Combinado: daqui a ${WISH_WAIT_DAYS} dias a gente pergunta se você ainda quer`)
      setName('')
      setPrice('')
      setAdding(false)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function decide(id: string, status: 'comprei' | 'desisti', cents: number) {
    try {
      await write.mutateAsync((b) => b.update('wishes', id, { status, decided_at: new Date().toISOString() }))
      if (status === 'desisti') celebrate('Dinheiro que ficou com você', `${formatBRL(cents)} a menos de gasto por impulso. Que tal mandar para uma caixinha?`)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <section>
      <SectionHead
        icon={Hourglass}
        title="Lista de desejos"
        action={
          <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setAdding(true)}>
            <Plus size={16} weight="bold" /> Desejo
          </Button>
        }
      />
      {saved > 0 && (
        <p className="mb-2 px-1 text-[0.9375rem]">
          Você já deixou de gastar <strong className="text-primary-strong">{formatBRL(saved)}</strong> desistindo de desejos.
        </p>
      )}
      {waiting.length === 0 ? (
        <Card className="text-center text-muted">Deu vontade de comprar? Coloque aqui e espere {WISH_WAIT_DAYS} dias. Se ainda quiser, compre sem culpa.</Card>
      ) : (
        <List>
          {waiting.map((w) => {
            const st = wishState(w, today)
            const hours = workTime(w.price_cents, salary, hoursWeek)
            return (
              <li key={w.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[1.0625rem] font-semibold">{w.name}</p>
                  <Money cents={w.price_cents} className="font-semibold" />
                </div>
                <p className="text-[0.875rem] text-muted">
                  {st.ready ? 'A espera acabou. Ainda quer?' : `Faltam ${st.daysLeft} ${st.daysLeft === 1 ? 'dia' : 'dias'}`}
                  {hours ? ` · ${hours} do seu trabalho` : ''}
                </p>
                {st.ready && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => decide(w.id, 'comprei', w.price_cents)}>
                      Ainda quero, comprei
                    </Button>
                    <Button size="sm" onClick={() => decide(w.id, 'desisti', w.price_cents)}>
                      Desisti
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </List>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Novo desejo">
        <form onSubmit={add} noValidate className="flex flex-col gap-4">
          {error && <ErrorBox message={error} />}
          <Field label="O que você quer comprar" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="ex.: Tênis de corrida" />
          <Field label="Quanto custa" prefix="R$" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" hint={parseBRL(price) && salary ? `${workTime(parseBRL(price)!, salary, hoursWeek)} do seu trabalho` : undefined} />
          <Button type="submit" loading={write.isPending}>
            Esperar {WISH_WAIT_DAYS} dias
          </Button>
        </form>
      </Sheet>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Planos "se… então"
// ---------------------------------------------------------------------------

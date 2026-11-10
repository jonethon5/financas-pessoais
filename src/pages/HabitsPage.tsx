import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowsClockwise, CalendarCheck, CheckCircle, ClockCounterClockwise, Flame, Hourglass, Lightbulb, PencilSimpleLine, Plus, Target, Trash, Trophy, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useCelebrate } from '../components/Celebration'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { BackButton, Badge, Button, Card, Chip, ErrorBox, Field, List, Money, NavBar, ProgressBar, Row, Segmented, Spinner, Switch } from '../components/ui'
import { useTable, useWrite } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { addDaysISO, currentYearMonth, formatDateShort } from '../lib/dates'
import { formatBRL, parseBRL } from '../lib/money'
import { CHALLENGES, WISH_WAIT_DAYS, challengeProgress, loggingDayStreak, noSpendCalendar, savedByGivingUp, savingWeekStreak, weeklyLeftover, wishState, workTime } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import type { Challenge, ChallengeKind, Goal, Rule, RuleKind, Transaction } from '../types'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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

export function HabitsPage() {
  const navigate = useNavigate()
  const ym = currentYearMonth()
  const view = useMonthView(ym)
  const challenges = useTable('challenges')
  const rules = useTable('rules')
  const wishes = useTable('wishes')
  const plans = useTable('if_then_plans')
  if (view.isPending || challenges.isPending || rules.isPending || wishes.isPending || plans.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const d = view.data
  const allTxs = [...new Map([...d.history, ...d.txs].map((t) => [t.id, t])).values()]
  const weeks = savingWeekStreak(d.goalMoves, d.today)
  const days = loggingDayStreak(allTxs, d.today)
  const cal = noSpendCalendar(allTxs, ym, d.today)

  return (
    <>
      <NavBar title="Hábitos" left={<BackButton label="Início" onClick={() => navigate('/')} />} />
      <div className="stagger flex flex-col gap-8">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Flame, value: weeks, label: weeks === 1 ? 'semana guardando' : 'semanas guardando', color: '#FF6B4A' },
            { icon: PencilSimpleLine, value: days, label: days === 1 ? 'dia lançando' : 'dias lançando', color: '#6E56F0' },
            { icon: CalendarCheck, value: cal.count, label: cal.count === 1 ? 'dia sem gastar' : 'dias sem gastar', color: '#0F9D6B' },
          ].map((s) => (
            <Card key={s.label} className="px-3 py-3.5 text-center">
              <s.icon size={26} weight="duotone" style={{ color: s.color }} className="mx-auto" />
              <p className="num mt-1 text-[1.625rem] leading-none font-extrabold">{s.value}</p>
              <p className="mt-1 text-[0.75rem] leading-tight font-medium text-muted">{s.label}</p>
            </Card>
          ))}
        </div>

        <section>
          <SectionHead icon={CalendarCheck} title="Dias sem gastar" />
          <Card>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[0.75rem] font-semibold text-muted">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((w, i) => (
                <span key={i}>{w}</span>
              ))}
              {Array.from({ length: cal.leadingBlanks }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {cal.days.map((day) => (
                <span
                  key={day.date}
                  aria-label={`Dia ${day.day}: ${day.state === 'sem-gasto' ? 'sem gastos' : day.state === 'gastou' ? 'com gastos' : day.state === 'hoje' ? 'hoje' : 'ainda não chegou'}`}
                  className={`num grid aspect-square place-items-center rounded-full text-[0.875rem] ${
                    day.state === 'sem-gasto' ? 'bg-grow font-bold text-on-primary' : day.state === 'gastou' ? 'bg-surface-2 text-ink' : day.state === 'hoje' ? 'border-2 border-primary text-ink' : 'text-faint'
                  }`}
                >
                  {day.day}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[0.875rem] text-muted">Verde é dia sem nenhum gasto do dia a dia. Cada um deles é dinheiro que ficou com você.</p>
          </Card>
        </section>

        <Challenges challenges={challenges.data ?? []} goals={d.goals.map((g) => g.goal)} data={d} allTxs={allTxs} />
        <Rules rules={rules.data ?? []} goals={d.goals.map((g) => g.goal)} categories={d.categories} leftovers={weeklyLeftover(d.categories, allTxs, d.today)} />
        <Wishes salary={d.profile.salary_cents} hoursWeek={d.profile.work_hours_week} today={d.today} wishes={wishes.data ?? []} />
        <Plans plans={plans.data ?? []} />

        <section>
          <SectionHead icon={ClockCounterClockwise} title="Revisões" />
          <List>
            <Row title="Revisão da semana" subtitle="Leva 2 minutos, melhor no domingo" chevron as={(c, cls) => <Link to="/revisao" className={cls}>{c}</Link>} />
            <Row title="Retrospectiva do mês" subtitle="Seu mês em telas, para guardar ou compartilhar" chevron as={(c, cls) => <Link to="/retrospectiva" className={cls}>{c}</Link>} />
          </List>
        </section>
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

const RULES: { kind: RuleKind; title: string; hint: string }[] = [
  { kind: 'arredondar', title: 'Arredondar e guardar o troco', hint: 'Gasto de R$ 18,40 com arredondamento de R$ 5: guarda R$ 1,60.' },
  { kind: 'sobra_limite', title: 'Gastei menos que o limite, guardo a diferença', hint: 'No começo da semana, o que sobrou do limite semanal vira sugestão para guardar.' },
  { kind: 'renda_extra', title: 'Parte de todo dinheiro extra', hint: 'Freela, 13º, restituição: uma porcentagem vai direto para a caixinha.' },
  { kind: 'prazer_culpado', title: 'Prazer culpado', hint: 'A cada gasto numa categoria (ex.: Delivery), guarda um valor fixo.' },
]

function ruleText(r: Rule, goals: Goal[], categoryName: (id?: string) => string) {
  const goal = goals.find((g) => g.id === r.goal_id)?.name ?? 'caixinha'
  if (r.kind === 'arredondar') return `Arredonda para ${formatBRL(r.params.step_cents ?? 500)} → ${goal}`
  if (r.kind === 'renda_extra') return `${r.params.pct ?? 10}% de cada renda extra → ${goal}`
  if (r.kind === 'prazer_culpado') return `${formatBRL(r.params.amount_cents ?? 1000)} a cada gasto em ${categoryName(r.params.category_id)} → ${goal}`
  return `Sobra do limite semanal → ${goal}`
}

function Rules({ rules, goals, categories, leftovers }: { rules: Rule[]; goals: Goal[]; categories: NonNullable<ReturnType<typeof useMonthView>['data']>['categories']; leftovers: ReturnType<typeof weeklyLeftover> }) {
  const write = useWrite()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? 'uma categoria'
  const leftoverRule = rules.find((r) => r.kind === 'sobra_limite' && r.active)
  const totalLeftover = leftovers.reduce((a, l) => a + l.leftover, 0)

  async function saveLeftover() {
    if (!leftoverRule) return
    try {
      await write.mutateAsync((b) => b.insert('goal_moves', [{ goal_id: leftoverRule.goal_id, kind: 'deposito', amount_cents: totalLeftover, date: addDaysISO(leftovers[0].weekStart, 7), note: 'Regra: sobra do limite' }]))
      toast(`${formatBRL(totalLeftover)} guardados da sobra da semana`)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <section>
      <SectionHead
        icon={Lightbulb}
        title="Regras automáticas"
        action={
          <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setAdding(true)} disabled={!goals.length}>
            <Plus size={16} weight="bold" /> Nova
          </Button>
        }
      />
      {leftoverRule && totalLeftover > 0 && (
        <Card className="mb-3 bg-primary-soft shadow-none">
          <p className="font-semibold">Semana passada sobrou {formatBRL(totalLeftover)} nos limites</p>
          <p className="mt-0.5 text-[0.9375rem] text-muted">{leftovers.map((l) => `${l.category.name}: ${formatBRL(l.leftover)}`).join(' · ')}</p>
          <Button size="sm" className="mt-3" onClick={saveLeftover}>
            Guardar a sobra
          </Button>
        </Card>
      )}
      {!goals.length ? (
        <Card className="text-center text-muted">Crie uma caixinha primeiro: as regras guardam dinheiro nela.</Card>
      ) : rules.length === 0 ? (
        <Card className="text-center text-muted">Guarde sem perceber: as regras separam pequenos valores a cada gasto.</Card>
      ) : (
        <List footer="O app registra o valor na caixinha. Transfira de vez em quando para a poupança do banco.">
          {rules.map((r) => (
            <Row
              key={r.id}
              title={RULES.find((x) => x.kind === r.kind)?.title}
              subtitle={<span className="whitespace-normal">{ruleText(r, goals, catName)}</span>}
              trailing={<Switch label="Regra ativa" checked={r.active} onChange={(active) => write.mutate((b) => b.update('rules', r.id, { active }))} />}
            />
          ))}
        </List>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Nova regra">
        {adding && <RuleForm goals={goals} categories={categories} onDone={() => setAdding(false)} />}
      </Sheet>
    </section>
  )
}

function RuleForm({ goals, categories, onDone }: { goals: Goal[]; categories: { id: string; name: string; kind: string; archived: boolean }[]; onDone: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const [kind, setKind] = useState<RuleKind>('arredondar')
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '')
  const [step, setStep] = useState(500)
  const [pct, setPct] = useState('10')
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.name === 'Delivery')?.id ?? '')
  const [amount, setAmount] = useState('10,00')
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const params = kind === 'arredondar' ? { step_cents: step } : kind === 'renda_extra' ? { pct: Number(pct) } : kind === 'prazer_culpado' ? { category_id: categoryId, amount_cents: parseBRL(amount) ?? 0 } : {}
    if (kind === 'renda_extra' && !(Number(pct) >= 1 && Number(pct) <= 100)) return setError('Porcentagem de 1 a 100.')
    if (kind === 'prazer_culpado' && (!categoryId || !parseBRL(amount))) return setError('Escolha a categoria e o valor.')
    try {
      await write.mutateAsync((b) => b.insert('rules', [{ kind, goal_id: goalId, params, active: true }]))
      toast('Regra criada')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      {error && <ErrorBox message={error} />}
      <List>
        {RULES.map((r) => (
          <Row key={r.kind} title={r.title} subtitle={<span className="whitespace-normal">{r.hint}</span>} onClick={() => setKind(r.kind)} trailing={kind === r.kind ? <CheckCircle size={22} weight="fill" className="text-primary" /> : null} />
        ))}
      </List>
      {kind === 'arredondar' && <Segmented label="Arredondar para" value={String(step)} onChange={(v) => setStep(Number(v))} options={[{ value: '100', label: 'R$ 1' }, { value: '500', label: 'R$ 5' }, { value: '1000', label: 'R$ 10' }]} />}
      {kind === 'renda_extra' && <Field label="Porcentagem" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} hint="Ex.: 20 = 20% de cada renda extra." />}
      {kind === 'prazer_culpado' && (
        <>
          <div className="flex flex-wrap gap-2">
            {categories.filter((c) => c.kind === 'expense' && !c.archived).map((c) => (
              <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
          <Field label="Guardar a cada gasto" prefix="R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </>
      )}
      <div>
        <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Guardar na caixinha</p>
        <div className="flex flex-wrap gap-2">
          {goals.filter((g) => !g.archived).map((g) => (
            <Chip key={g.id} selected={goalId === g.id} onClick={() => setGoalId(g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>
      </div>
      <Button type="submit" loading={write.isPending}>
        Criar regra
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Lista de desejos
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

function Plans({ plans }: { plans: import('../types').IfThenPlan[] }) {
  const write = useWrite()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [trigger, setTrigger] = useState('Se der vontade de pedir delivery')
  const [action, setAction] = useState('então faço algo em casa e guardo o valor')
  const [weekday, setWeekday] = useState<number | null>(5)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!trigger.trim() || !action.trim()) return
    try {
      await write.mutateAsync((b) => b.insert('if_then_plans', [{ trigger_text: trigger.trim(), action_text: action.trim(), weekday, active: true }]))
      toast('Plano criado. No dia, ele aparece na tela inicial.')
      setAdding(false)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <section>
      <SectionHead
        icon={Target}
        title="Planos “se… então”"
        action={
          <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setAdding(true)}>
            <Plus size={16} weight="bold" /> Plano
          </Button>
        }
      />
      {plans.length === 0 ? (
        <Card className="text-center text-muted">Decidir antes ajuda a resistir na hora. Ex.: “Se der vontade de pedir iFood na sexta, então faço um lanche em casa”.</Card>
      ) : (
        <List footer="O plano aparece na tela inicial no dia escolhido.">
          {plans.map((p) => (
            <Row
              key={p.id}
              title={<span className="whitespace-normal">{p.trigger_text},</span>}
              subtitle={<span className="whitespace-normal">{p.action_text} · {p.weekday == null ? 'todo dia' : WEEKDAYS[p.weekday]}</span>}
              trailing={
                <span className="flex items-center gap-1.5">
                  <button type="button" aria-label="Apagar plano" onClick={() => setRemoving(p.id)} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2">
                    <Trash size={18} weight="duotone" />
                  </button>
                  <Switch label="Plano ativo" checked={p.active} onChange={(active) => write.mutate((b) => b.update('if_then_plans', p.id, { active }))} />
                </span>
              }
            />
          ))}
        </List>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Novo plano">
        <form onSubmit={add} noValidate className="flex flex-col gap-4">
          <Field label="Se…" value={trigger} onChange={(e) => setTrigger(e.target.value)} maxLength={120} />
          <Field label="Então…" value={action} onChange={(e) => setAction(e.target.value)} maxLength={120} />
          <div>
            <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Lembrar em</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={weekday == null} onClick={() => setWeekday(null)}>
                Todo dia
              </Chip>
              {WEEKDAYS.map((w, i) => (
                <Chip key={w} selected={weekday === i} onClick={() => setWeekday(i)}>
                  {w}
                </Chip>
              ))}
            </div>
          </div>
          <Button type="submit" loading={write.isPending}>
            Criar plano
          </Button>
        </form>
      </Sheet>
      <ConfirmSheet
        open={Boolean(removing)}
        title="Apagar este plano?"
        confirmLabel="Apagar"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const id = removing
          setRemoving(null)
          if (id) write.mutate((b) => b.remove('if_then_plans', [id]))
        }}
      />
    </section>
  )
}


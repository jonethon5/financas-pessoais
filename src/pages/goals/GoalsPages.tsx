import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, CheckCircle, Plus } from '@phosphor-icons/react'
import { useCelebrate } from '../../components/Celebration'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { COVER_ASPECT, GOAL_COLORS, GOAL_ICON_KEYS, GoalBadgeIcon, GoalCover, goalIcon } from '../../components/GoalCover'
import { Reveal } from '../../components/Reveal'
import { PhotoCropper } from '../../components/PhotoCropper'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { AnimatedMoney, BackButton, Button, EmptyState, ErrorBox, Field, List, Money, NavBar, NavButton, Notice, ProgressBar, Row, Segmented, Spinner, TextArea } from '../../components/ui'
import { useBackend } from '../../data/backend'
import { useWrite } from '../../data/finance'
import { useMonthView } from '../../data/monthView'
import { addMonths, currentYearMonth, formatDateShort, monthKey, monthLabel, parseMonthKey, todayISO, type YearMonth } from '../../lib/dates'
import { projection } from '../../lib/psych'
import { GOAL_TEMPLATES, MILESTONES, crossedMilestones, distribute, emergencySuggestion, goalStatus, withdrawImpact, type GoalStatus } from '../../lib/goals'
import { centsToInput, formatBRL, parseBRL } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import type { Goal, GoalMode, GoalMove } from '../../types'
import { MascotArt } from '../../components/Pig'
import { Tour } from '../../components/Tour'

const month = (ym: YearMonth | null) => (ym ? monthLabel(ym).toLowerCase() : '')

/** Texto do plano: "R$ 500/mês até julho de 2027", "chega em março de 2028"… */
export function planText(goal: Goal, s: GoalStatus): string {
  if (s.done) return 'Meta batida'
  if (goal.mode === 'data') {
    if (s.late) return `Passou de ${month(parseMonthKey(goal.target_month))} · faltam ${formatBRL((s.target ?? 0) - s.saved)}`
    return `${formatBRL(s.perMonth ?? 0)}/mês (${formatBRL(s.perWeek ?? 0)}/semana) até ${month(parseMonthKey(goal.target_month))}`
  }
  if (goal.mode === 'mensal' || (s.target != null && s.perMonth)) return `${formatBRL(s.perMonth ?? 0)}/mês · chega em ${month(s.eta)}`
  if (s.target != null) return `Meta de ${formatBRL(s.target)} · sem valor por mês`
  return s.perMonth ? `${formatBRL(s.perMonth)}/mês · sem valor final` : 'Sem valor final'
}

function useGoalsData() {
  const ym = currentYearMonth()
  const view = useMonthView(ym)
  return { ym, view }
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export function GoalsPage() {
  const navigate = useNavigate()
  const { ym, view } = useGoalsData()
  const write = useWrite()
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [leftover, setLeftover] = useState(false)
  const [ordering, setOrdering] = useState(false)
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const items = [...view.data.goals].sort((a, b) => a.goal.priority - b.goal.priority || a.goal.created_at.localeCompare(b.goal.created_at))
  const open = items.filter((g) => !g.status.done)
  const done = items.filter((g) => g.status.done)
  const total = items.reduce((a, g) => a + g.status.saved, 0)
  const planned = open.reduce((a, g) => a + (g.status.perMonth ?? 0), 0)
  const thisMonth = items.reduce((a, g) => a + Math.max(0, g.status.savedThisMonth), 0)
  const proj = projection(view.data.goalMoves, view.data.today)

  async function move(index: number, dir: -1 | 1) {
    const list = [...open]
    const j = index + dir
    if (j < 0 || j >= list.length) return
    ;[list[index], list[j]] = [list[j], list[index]]
    try {
      await write.mutateAsync(async (b) => {
        for (const [i, g] of list.entries()) if (g.goal.priority !== i + 1) await b.update('goals', g.goal.id, { priority: i + 1 })
      })
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <>
      <Tour id="caixinhas" steps={[{ target: 'nova-caixinha', title: 'Crie uma caixinha', text: 'Dinheiro com nome e objetivo é mais difícil de gastar. Comece pela reserva para imprevistos.' }]} />
      <NavBar
        title="Caixinhas"
        right={
          <button type="button" data-tour="nova-caixinha" aria-label="Nova caixinha" onClick={() => setPicking(true)} className="press grid size-9 place-items-center rounded-full bg-primary text-on-primary shadow-soft">
            <Plus size={20} weight="bold" />
          </button>
        }
      />
      {items.length === 0 ? (
        <EmptyState art={<MascotArt name="tela-metas" px={170} />} title="Sua primeira caixinha">
          Separe o dinheiro de cada objetivo: viagem, reserva, aquela compra. Toque no + lá em cima para criar. Dica: comece pela reserva de emergência.
        </EmptyState>
      ) : (
        <div className="stagger flex flex-col gap-5">
          <Reveal>
          <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#12A876] to-[#0A6E4E] p-5 text-white shadow-[0_18px_40px_-20px_rgb(10_110_78/0.8)]">
            <span aria-hidden className="absolute -top-14 -right-10 size-44 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -bottom-16 left-16 size-32 rounded-full bg-white/[0.06]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-medium text-white/80">Guardado nas caixinhas</p>
                <AnimatedMoney cents={total} className="block text-[2.375rem] leading-tight font-extrabold tracking-[-0.03em]" />
              </div>
              <MascotArt name="rosto-feliz" px={72} className="-mt-1 -mr-1 shrink-0" />
            </div>
            {planned > 0 && (
              <div className="relative mt-3">
                <div className="flex items-baseline justify-between text-[0.875rem]">
                  <span className="text-white/80">Este mês</span>
                  <span className="num font-semibold">
                    {formatBRL(thisMonth)} <span className="font-medium text-white/75">de {formatBRL(planned)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Guardado este mês" aria-valuenow={Math.round(Math.min(1, thisMonth / planned) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="bar-fill h-full rounded-full bg-white" style={{ width: `${Math.min(100, (thisMonth / planned) * 100)}%` }} />
                </div>
              </div>
            )}
            {proj.pace > 0 && (
              <p className="relative mt-3 rounded-[0.9rem] bg-white/12 px-3 py-2 text-[0.9375rem] leading-snug">
                Mantendo esse ritmo, em dezembro você terá <strong>{formatBRL(proj.projected)}</strong>.
              </p>
            )}
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => navigate('/separar')} className="press rounded-full bg-white py-3 text-[0.9375rem] font-bold text-[#0A6E4E]">
                Separar salário
              </button>
              <button type="button" onClick={() => setLeftover(true)} className="press rounded-full bg-white/18 py-3 text-[0.9375rem] font-bold text-white ring-1 ring-white/30">
                Guardar sobra
              </button>
            </div>
          </section>
          </Reveal>

          {open.map((g, i) => (
            <Reveal key={g.goal.id} delay={Math.min(i, 3) * 70} className="relative">
              <GoalCard goal={g.goal} status={g.status} />
              {ordering && (
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink shadow-soft disabled:opacity-40">
                    <ArrowUp size={18} weight="bold" />
                  </button>
                  <button type="button" aria-label="Descer" disabled={i === open.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink shadow-soft disabled:opacity-40">
                    <ArrowDown size={18} weight="bold" />
                  </button>
                </div>
              )}
            </Reveal>
          ))}
          {open.length > 1 && (
            <Button variant="ghost" size="sm" className="self-center" onClick={() => setOrdering((o) => !o)}>
              {ordering ? 'Pronto' : 'Mudar a ordem de prioridade'}
            </Button>
          )}

          {done.length > 0 && (
            <List header="Concluídas">
              {done.map((g) => (
                <Row key={g.goal.id} icon={<GoalBadgeIcon goal={g.goal} size={36} />} title={g.goal.name} subtitle="Meta batida" trailing={<Money cents={g.status.saved} />} as={(c, cls) => <Link to={`/caixinhas/${g.goal.id}`} className={cls}>{c}</Link>} />
              ))}
            </List>
          )}
          <p className="px-1 text-center text-[0.8125rem] leading-snug text-muted">O dinheiro continua no seu banco. Aqui você controla quanto é de cada objetivo. A primeira da lista recebe a sobra primeiro.</p>
        </div>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Nova caixinha">
        <List>
          {GOAL_TEMPLATES.map((t) => (
            <Row
              key={t.key}
              icon={<GoalBadgeIcon goal={t} size={40} />}
              title={t.name}
              subtitle={<span className="whitespace-normal">{t.hint}</span>}
              chevron
              onClick={() => {
                setPicking(false)
                navigate(`/caixinhas/nova?modelo=${t.key}`)
              }}
            />
          ))}
        </List>
      </Sheet>
      <LeftoverSheet open={leftover} ym={ym} goals={items} suggested={Math.max(0, view.data.summary.free)} onClose={() => setLeftover(false)} />
    </>
  )
}

function GoalCard({ goal, status: s }: { goal: Goal; status: GoalStatus }) {
  const pct = s.progress != null ? Math.floor(Math.min(s.progress, 1) * 100) : null
  return (
    <Link to={`/caixinhas/${goal.id}`} className="press shadow-soft block overflow-hidden rounded-[1.5rem] bg-surface">
      <GoalCover goal={goal} iconSize={52}>
        {pct != null && (
          <span className="absolute top-3 left-3 rounded-full bg-black/25 px-2.5 py-1 text-[0.8125rem] font-bold backdrop-blur-md">{pct}%</span>
        )}
        <p className="text-[1.3125rem] leading-tight font-extrabold drop-shadow-[0_1px_8px_rgb(0_0_0/0.3)]">{goal.name}</p>
        {goal.motivation && <p className="mt-0.5 line-clamp-1 text-[0.875rem] text-white/85 italic">“{goal.motivation}”</p>}
      </GoalCover>
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.75rem] font-semibold tracking-wide text-muted uppercase">Guardado</p>
            <AnimatedMoney cents={s.saved} className="block text-[1.375rem] leading-tight font-extrabold tracking-tight" />
          </div>
          {s.target != null && (
            <div className="text-right">
              <p className="text-[0.75rem] font-semibold tracking-wide text-muted uppercase">Meta</p>
              <p className="num text-[1rem] font-bold">{formatBRL(s.target)}</p>
            </div>
          )}
        </div>
        {s.progress != null && <ProgressBar className="h-2.5" value={s.progress} milestones={[0.25, 0.5, 0.75]} label={`Progresso de ${goal.name}`} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.875rem] text-muted">{planText(goal, s)}</p>
          {s.perMonth ? (
            s.needThisMonth > 0 ? (
              <span className="rounded-full bg-coral-soft px-2.5 py-1 text-[0.8125rem] font-semibold text-coral-strong">Faltam {formatBRL(s.needThisMonth)} este mês</span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[0.8125rem] font-semibold text-primary-strong">
                <CheckCircle size={15} weight="fill" /> Mês em dia
              </span>
            )
          ) : null}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Detalhe: guardar, retirar (com freio) e histórico
// ---------------------------------------------------------------------------

export function GoalDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ym, view } = useGoalsData()
  const [sheet, setSheet] = useState<'deposito' | 'retirada' | null>(null)
  const [removing, setRemoving] = useState<GoalMove | null>(null)
  const [deleting, setDeleting] = useState(false)
  const write = useWrite()
  const toast = useToast()
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const item = view.data.goals.find((g) => g.goal.id === id)
  if (!item) return <ErrorBox message="Caixinha não encontrada." />
  const { goal, status: s } = item
  const moves = view.data.goalMoves.filter((m) => m.goal_id === goal.id).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const kindLabel = { deposito: 'Guardou', retirada: 'Retirou', inicial: 'Já tinha guardado' }

  async function removeGoal() {
    try {
      await write.mutateAsync(async (b) => {
        if (goal.photo_path) await b.removeFile('fotos', goal.photo_path)
        await b.remove('goals', [goal.id])
      })
      toast('Caixinha apagada')
      navigate('/caixinhas')
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <>
      <NavBar title={goal.name} large={false} left={<BackButton label="Voltar" onClick={() => navigate("/caixinhas")} />} right={<NavButton onClick={() => navigate(`/caixinhas/${goal.id}/editar`)}>Editar</NavButton>} />
      <div className="stagger flex flex-col gap-5 pt-3">
        <div className="shadow-soft overflow-hidden rounded-[1.5rem] bg-surface">
          <GoalCover goal={goal} iconSize={64}>
            <p className="text-[1.5rem] leading-tight font-extrabold drop-shadow-[0_1px_8px_rgb(0_0_0/0.3)]">{goal.name}</p>
          </GoalCover>
          <div className="p-5">
            {goal.motivation && (
              <div className="mb-4 rounded-[1rem] border-l-4 bg-surface-2 px-4 py-3" style={{ borderColor: goal.color }}>
                <p className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Seu porquê</p>
                <p className="mt-0.5 text-[1.0625rem] leading-snug font-semibold">{goal.motivation}</p>
              </div>
            )}
            <AnimatedMoney cents={s.saved} className="block text-[2.25rem] leading-tight font-extrabold tracking-[-0.03em]" />
            {s.target != null && <p className="text-muted">de {formatBRL(s.target)} · faltam {formatBRL(Math.max(0, s.target - s.saved))}</p>}
            {s.progress != null && (
              <>
                <ProgressBar className="mt-4 h-3" value={s.progress} milestones={[0.25, 0.5, 0.75]} label={`Progresso de ${goal.name}`} />
                <div className="relative mt-1.5 h-4 text-[0.75rem] font-semibold text-muted">
                  {MILESTONES.map((m) => (
                    <span key={m} className={`absolute -translate-x-1/2 ${s.progress! >= m ? 'text-primary-strong' : ''}`} style={{ left: `${Math.min(m * 100, 96)}%` }}>
                      {m * 100}%
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button onClick={() => setSheet('deposito')}>Guardar</Button>
              <Button variant="secondary" onClick={() => setSheet('retirada')} disabled={s.saved <= 0}>
                Retirar
              </Button>
            </div>
          </div>
        </div>

        <List header="Plano" footer="O plano se ajusta sozinho todo mês: se um mês não deu, o valor dos próximos é recalculado, sem bronca.">
          {s.done ? (
            <Row title="Meta batida" trailing={<CheckCircle size={22} weight="fill" className="text-primary" />} />
          ) : (
            <Row title="Quanto guardar" trailing={s.perMonth ? `${formatBRL(s.perMonth)}/mês` : 'Livre'} />
          )}
          {s.perWeek ? <Row title="Por semana" trailing={formatBRL(s.perWeek)} /> : null}
          {s.perMonth ? <Row title="Este mês" trailing={s.needThisMonth > 0 ? <span className="font-semibold text-coral-strong">faltam {formatBRL(s.needThisMonth)}</span> : <span className="font-semibold text-primary-strong">em dia</span>} /> : null}
          {s.eta && !s.done && <Row title={goal.mode === 'data' ? 'Data combinada' : 'Chega em'} trailing={month(s.eta)} />}
        </List>

        <List header="Histórico">
          {moves.length === 0 ? (
            <Row title={<span className="text-muted">Nada guardado ainda</span>} />
          ) : (
            moves.map((m) => (
              <Row
                key={m.id}
                title={kindLabel[m.kind]}
                subtitle={`${formatDateShort(m.date)}${m.note ? ` · ${m.note}` : ''}`}
                trailing={<span className={`num font-semibold ${m.amount_cents < 0 ? 'text-ink' : 'text-primary-strong'}`}>{m.amount_cents < 0 ? '−' : '+'}{formatBRL(Math.abs(m.amount_cents))}</span>}
                onClick={() => setRemoving(m)}
              />
            ))
          )}
        </List>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          Apagar caixinha
        </Button>
      </div>

      <MoveSheet kind={sheet} goal={goal} moves={view.data.goalMoves} ym={ym} onClose={() => setSheet(null)} />
      <ConfirmSheet
        open={Boolean(removing)}
        title="Apagar este registro?"
        confirmLabel="Apagar"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const m = removing
          setRemoving(null)
          if (m) await write.mutateAsync((b) => b.remove('goal_moves', [m.id])).catch((err) => toast(friendlyError(err)))
        }}
      >
        {removing && `${kindLabel[removing.kind]} ${formatBRL(Math.abs(removing.amount_cents))} em ${formatDateShort(removing.date)}`}
      </ConfirmSheet>
      <ConfirmSheet open={deleting} title="Apagar a caixinha?" confirmLabel="Apagar caixinha" destructive onClose={() => setDeleting(false)} onConfirm={removeGoal}>
        O histórico dela some do app. O dinheiro no seu banco não é mexido.
      </ConfirmSheet>
    </>
  )
}

function MoveSheet({ kind, goal, moves, ym, onClose }: { kind: 'deposito' | 'retirada' | null; goal: Goal; moves: GoalMove[]; ym: YearMonth; onClose: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const celebrate = useCelebrate()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cents = parseBRL(text)
  const s = goalStatus(goal, moves, ym)
  const impact = kind === 'retirada' && cents ? withdrawImpact(goal, moves, cents, ym) : null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!cents) return setError('Digite o valor.')
    if (kind === 'retirada' && cents > s.saved) return setError(`A caixinha tem ${formatBRL(s.saved)}.`)
    setError(null)
    const amount = kind === 'retirada' ? -cents : cents
    try {
      await write.mutateAsync(async (b) => {
        await b.insert('goal_moves', [{ goal_id: goal.id, kind: kind!, amount_cents: amount, date: todayISO(), note: note.trim() || null }])
        if (s.target && s.saved + amount >= s.target && !goal.completed_at) await b.update('goals', goal.id, { completed_at: new Date().toISOString() })
      })
      const crossed = kind === 'deposito' ? crossedMilestones(s.saved, s.saved + amount, s.target) : []
      const top = crossed[crossed.length - 1]
      if (top === 1) celebrate('Meta batida!', `${goal.name}: você chegou nos ${formatBRL(s.target!)}. Que orgulho.`)
      else if (top) celebrate(`${top * 100}% da caixinha`, top === 0.5 ? `Metade do caminho para ${goal.name}. Continue assim!` : `${goal.name} está cada vez mais perto.`)
      else toast(kind === 'deposito' ? `${formatBRL(cents)} guardados` : `${formatBRL(cents)} retirados`)
      setText('')
      setNote('')
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <Sheet open={kind != null} onClose={onClose} title={kind === 'retirada' ? 'Retirar da caixinha' : 'Guardar na caixinha'}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field label="Valor" prefix="R$" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0,00" className="[&_input]:text-[1.375rem] [&_input]:font-semibold" />
        {kind === 'deposito' && s.needThisMonth > 0 && (
          <Button variant="soft" size="sm" className="self-start" onClick={() => setText(centsToInput(s.needThisMonth))}>
            Completar o mês: {formatBRL(s.needThisMonth)}
          </Button>
        )}
        {kind === 'retirada' && cents ? (
          <Notice tone="warn">
            {impact?.delayMonths ? (
              <>
                Tirar <strong>{formatBRL(cents)}</strong> atrasa {goal.name} em <strong>{impact.delayMonths} {impact.delayMonths === 1 ? 'mês' : 'meses'}</strong>
                {impact.extraPerMonth ? <> (ou guarde {formatBRL(impact.extraPerMonth)} a mais por mês para manter a data)</> : null}.
              </>
            ) : (
              <>A caixinha fica com {formatBRL(Math.max(0, s.saved - cents))}.</>
            )}{' '}
            Tem certeza? Às vezes vale esperar uns dias.
            {goal.motivation && (
              <span className="mt-2 block">
                Lembre por que você começou: <strong>“{goal.motivation}”</strong>
              </span>
            )}
          </Notice>
        ) : null}
        <Field label="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        <p className="px-1 text-[0.8125rem] leading-snug text-muted">
          {kind === 'retirada' ? 'Lembre de tirar também da poupança ou caixinha do seu banco.' : 'Lembre de transferir também para a poupança ou caixinha do seu banco.'}
        </p>
        <Button type="submit" variant={kind === 'retirada' ? 'secondary' : 'primary'} loading={write.isPending}>
          {kind === 'retirada' ? 'Retirar mesmo assim' : 'Guardar'}
        </Button>
      </form>
    </Sheet>
  )
}

/** Sobrou dinheiro? Divide entre as caixinhas na ordem de prioridade. */
function LeftoverSheet({ open, ym, goals, suggested, onClose }: { open: boolean; ym: YearMonth; goals: { goal: Goal; status: GoalStatus }[]; suggested: number; onClose: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const [text, setText] = useState('')
  const cents = parseBRL(text) ?? 0
  const plan = useMemo(() => (cents > 0 ? distribute(cents, goals) : []), [cents, goals])

  async function confirm() {
    try {
      await write.mutateAsync((b) => b.insert('goal_moves', plan.map((p) => ({ goal_id: p.goalId, kind: 'deposito' as const, amount_cents: p.cents, date: todayISO(), note: 'Sobra do mês' }))))
      toast(`${formatBRL(cents)} guardados nas caixinhas`)
      setText('')
      onClose()
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Guardar a sobra">
      <div className="flex flex-col gap-4">
        <p className="text-center leading-snug text-muted">Quanto sobrou? O app completa primeiro o mês de cada caixinha, na ordem de prioridade.</p>
        <Field label="Valor" prefix="R$" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0,00" />
        {suggested > 0 && (
          <Button variant="soft" size="sm" className="self-start" onClick={() => setText(centsToInput(suggested))}>
            Sobra prevista de {monthLabel(ym).split(' ')[0].toLowerCase()}: {formatBRL(suggested)}
          </Button>
        )}
        {plan.length > 0 && (
          <List>
            {plan.map((p) => {
              const g = goals.find((x) => x.goal.id === p.goalId)!.goal
              return <Row key={p.goalId} icon={<GoalBadgeIcon goal={g} size={34} />} title={g.name} trailing={<Money cents={p.cents} className="font-semibold text-primary-strong" />} />
            })}
          </List>
        )}
        <Button onClick={confirm} disabled={plan.length === 0} loading={write.isPending}>
          Guardar
        </Button>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Criar e editar
// ---------------------------------------------------------------------------

export function GoalFormPage() {
  const { id } = useParams()
  const { view } = useGoalsData()
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  const existing = id ? view.data.goals.find((g) => g.goal.id === id)?.goal : undefined
  if (id && !existing) return <ErrorBox message="Caixinha não encontrada." />
  const monthlyExpenses = view.data.summary.committed + view.data.summary.daily
  return <GoalForm key={id ?? 'nova'} goal={existing ?? null} nextPriority={view.data.goals.length + 1} monthlyExpenses={monthlyExpenses} />
}

function GoalForm({ goal, nextPriority, monthlyExpenses }: { goal: Goal | null; nextPriority: number; monthlyExpenses: number }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const backend = useBackend()
  const write = useWrite()
  const toast = useToast()
  const template = GOAL_TEMPLATES.find((t) => t.key === (goal?.template ?? params.get('modelo'))) ?? GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1]
  const ym = currentYearMonth()
  const [name, setName] = useState(goal?.name ?? (template.key === 'livre' ? '' : template.name))
  const [icon, setIcon] = useState(goal?.icon ?? template.icon)
  const [color, setColor] = useState(goal?.color ?? template.color)
  const [mode, setMode] = useState<GoalMode>(goal?.mode ?? template.mode)
  const [target, setTarget] = useState(centsToInput(goal?.target_cents))
  const [until, setUntil] = useState(goal?.target_month ?? monthKey(addMonths(ym, 6)))
  const [monthly, setMonthly] = useState(centsToInput(goal?.monthly_cents))
  const [initial, setInitial] = useState('')
  const [motivation, setMotivation] = useState(goal?.motivation ?? '')
  const [concreteName, setConcreteName] = useState(goal?.concrete_name ?? '')
  const [concretePrice, setConcretePrice] = useState(centsToInput(goal?.concrete_cents))
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const draft: Goal = {
    id: goal?.id ?? 'novo', user_id: '', name: name || (template.key === 'livre' ? 'Minha caixinha' : template.name), template: template.key, icon, color, photo_path: removePhoto ? null : (goal?.photo_path ?? null), motivation: motivation.trim() || null, concrete_name: concreteName.trim() || null, concrete_cents: parseBRL(concretePrice),
    mode, target_cents: parseBRL(target), target_month: mode === 'data' ? until : null, monthly_cents: parseBRL(monthly), priority: goal?.priority ?? nextPriority,
    archived: false, completed_at: goal?.completed_at ?? null, created_at: goal?.created_at ?? '',
  }
  const initialCents = parseBRL(initial) ?? 0
  const preview = !goal && ((mode === 'data' && draft.target_cents) || (mode === 'mensal' && draft.target_cents && draft.monthly_cents) || mode === 'livre')
    ? goalStatus(draft, initialCents ? [{ id: 'x', user_id: '', goal_id: draft.id, kind: 'inicial', amount_cents: initialCents, date: '2000-01-01', note: null, created_at: '' }] : [], ym)
    : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um nome para a caixinha.')
    if (mode !== 'livre' && !draft.target_cents) return setError('Quanto você quer juntar?')
    if (mode === 'data' && until < monthKey(ym)) return setError('Escolha um mês daqui para frente.')
    if (mode === 'mensal' && !draft.monthly_cents) return setError('Quanto vai guardar por mês?')
    if (initial.trim() && !initialCents) return setError('Valor já guardado inválido.')
    setError(null)
    const id = goal?.id ?? crypto.randomUUID()
    const row = { name: name.trim(), motivation: motivation.trim() || null, concrete_name: concreteName.trim() || null, concrete_cents: concreteName.trim() ? parseBRL(concretePrice) : null, template: template.key, icon, color, mode, target_cents: draft.target_cents, target_month: draft.target_month, monthly_cents: mode === 'data' ? null : draft.monthly_cents }
    try {
      await write.mutateAsync(async (b) => {
        if (goal) await b.update('goals', id, row)
        else {
          await b.insert('goals', [{ ...row, id, photo_path: null, priority: nextPriority, archived: false, completed_at: null }])
          if (initialCents) await b.insert('goal_moves', [{ goal_id: id, kind: 'inicial', amount_cents: initialCents, date: todayISO(), note: null }])
        }
        if (photo) {
          const path = await backend.uploadImage('fotos', `caixinhas/${id}-${Date.now()}.jpg`, photo)
          if (goal?.photo_path) await backend.removeFile('fotos', goal.photo_path)
          await b.update('goals', id, { photo_path: path })
        } else if (removePhoto && goal?.photo_path) {
          await backend.removeFile('fotos', goal.photo_path)
          await b.update('goals', id, { photo_path: null })
        }
      })
      toast(goal ? 'Caixinha salva' : 'Caixinha criada')
      navigate(`/caixinhas/${id}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const coverGoal = { ...draft, photo_path: photo || removePhoto ? null : draft.photo_path }

  return (
    <>
      <NavBar title={goal ? 'Editar caixinha' : 'Nova caixinha'} large={false} left={<NavButton onClick={() => navigate(-1)}>Cancelar</NavButton>} right={<NavButton type="submit" form="caixinha" strong disabled={write.isPending}>Salvar</NavButton>} />
      <form id="caixinha" onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-3">
        {error && <ErrorBox message={error} />}
        <div className="shadow-soft overflow-hidden rounded-[1.375rem]">
          <GoalCover goal={coverGoal} photoUrl={photoPreview} iconSize={56}>
            <p className="text-[1.25rem] leading-tight font-extrabold drop-shadow-[0_1px_8px_rgb(0_0_0/0.3)]">{name || (template.key === 'livre' ? 'Minha caixinha' : template.name)}</p>
          </GoalCover>
          <div className="flex gap-2 bg-surface p-3">
            <Button variant="soft" size="sm" onClick={() => fileInput.current?.click()}>
              {photoPreview || goal?.photo_path ? 'Trocar foto' : 'Usar uma foto'}
            </Button>
            {(photoPreview || (goal?.photo_path && !removePhoto)) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPhoto(null)
                  setPhotoPreview(null)
                  setRemovePhoto(true)
                }}
              >
                Sem foto
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setPicked(f)
            }}
          />
        </div>

        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="ex.: Viagem para a praia" />
        <TextArea
          label="Por que essa caixinha importa para você?"
          rows={2}
          maxLength={200}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder={template.why}
          hint="Uma frase para você lembrar do porquê quando der vontade de desistir. Aparece na caixinha e na hora de retirar."
        />

        <div>
          <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Ícone e cor</p>
          <div className="grid grid-cols-7 gap-1.5">
            {GOAL_ICON_KEYS.map((k) => {
              const Icon = goalIcon(k)
              return (
                <button key={k} type="button" aria-label={k} aria-pressed={icon === k} onClick={() => setIcon(k)} className={`grid aspect-square place-items-center rounded-[0.75rem] border-2 bg-surface transition ${icon === k ? 'border-ink' : 'border-transparent'}`}>
                  <Icon size={22} weight="duotone" color={color} />
                </button>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {GOAL_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`size-8 rounded-full ring-offset-2 ring-offset-bg transition ${color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Como quer guardar</p>
          <Segmented label="Tipo de meta" value={mode} onChange={setMode} options={[{ value: 'data', label: 'Até uma data' }, { value: 'mensal', label: 'Por mês' }, { value: 'livre', label: 'Sem valor final' }]} />
        </div>

        {mode !== 'livre' || target ? (
          <Field label={mode === 'livre' ? 'Valor da meta (opcional)' : 'Quanto quer juntar'} prefix="R$" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" />
        ) : null}
        {template.key === 'reserva' && monthlyExpenses > 0 && !goal && (
          <Button variant="soft" size="sm" className="-mt-2 self-start" onClick={() => setTarget(centsToInput(emergencySuggestion(monthlyExpenses)))}>
            Sugestão: {formatBRL(emergencySuggestion(monthlyExpenses))} (6 meses dos seus gastos)
          </Button>
        )}
        {mode === 'data' && <Field label="Até quando" type="month" value={until} min={monthKey(ym)} onChange={(e) => setUntil(e.target.value)} />}
        {mode !== 'data' && <Field label={mode === 'livre' ? 'Quanto por mês (opcional)' : 'Quanto vai guardar por mês'} prefix="R$" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0,00" />}
        <div className="grid grid-cols-[1fr_8.5rem] gap-2">
          <Field label="Um item da meta (opcional)" value={concreteName} onChange={(e) => setConcreteName(e.target.value)} maxLength={40} placeholder="ex.: diária do hotel" />
          <Field label="Quanto custa" prefix="R$" inputMode="decimal" value={concretePrice} onChange={(e) => setConcretePrice(e.target.value)} placeholder="0,00" />
        </div>
        <p className="-mt-3 px-1 text-[0.8125rem] leading-snug text-muted">Para o app traduzir seus gastos: “esse iFood = meia diária do hotel”.</p>
        {!goal && <Field label="Já tem algo guardado para isso? (opcional)" prefix="R$" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" hint="A caixinha já começa com esse progresso." />}

        {preview && (
          <Notice tone="primary">
            {mode === 'data' && preview.perMonth != null && (
              <>
                Guardando <strong>{formatBRL(preview.perMonth)} por mês</strong> ({formatBRL(preview.perWeek ?? 0)} por semana) você chega lá em {month(parseMonthKey(until))}.
              </>
            )}
            {mode === 'mensal' && preview.eta && (
              <>
                Nesse ritmo você chega lá em <strong>{month(preview.eta)}</strong>.
              </>
            )}
            {mode === 'livre' && <>Sem pressão: guarde quando der e acompanhe o total.</>}
          </Notice>
        )}
        <p className="px-1 text-[0.8125rem] leading-snug text-muted">{template.hint} O dinheiro fica no seu banco; o app só controla.</p>
        <Button type="submit" loading={write.isPending}>
          {goal ? 'Salvar' : 'Criar caixinha'}
        </Button>
      </form>
      <PhotoCropper
        aspect={COVER_ASPECT}
        round={false}
        file={picked}
        onCancel={() => setPicked(null)}
        onDone={(img) => {
          setPicked(null)
          setPhoto(img)
          setRemovePhoto(false)
          setPhotoPreview(URL.createObjectURL(img))
        }}
      />
    </>
  )
}


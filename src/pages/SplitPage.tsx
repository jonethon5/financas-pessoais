import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { GoalBadgeIcon } from '../components/GoalCover'
import { useToast } from '../components/Toast'
import { Button, Card, Chip, ErrorBox, Field, List, Money, NavBar, NavButton, Notice, Row, Spinner } from '../components/ui'
import { useBackend } from '../data/backend'
import { savePlan, useWrite } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { currentYearMonth, daysInMonth, monthLabel, todayISO } from '../lib/dates'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'

/**
 * Separar o salário (estilo Monzo), "pague-se primeiro": no dia do pagamento, antes de gastar,
 * divide o que entrou em fixos e parcelas, caixinhas e o que fica livre.
 */
export function SplitPage() {
  const view = useMonthView(currentYearMonth())
  const navigate = useNavigate()
  if (view.isPending) return <Spinner />
  if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
  return <SplitForm key={view.data.plan?.id ?? 'novo'} data={view.data} onDone={() => navigate('/')} />
}

function SplitForm({ data, onDone }: { data: NonNullable<ReturnType<typeof useMonthView>['data']>; onDone: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const backend = useBackend()
  const write = useWrite()
  const ym = currentYearMonth()
  const { summary: s, plan, goals } = data
  const open = goals.filter((g) => !g.status.done).sort((a, b) => a.goal.priority - b.goal.priority)
  const withGoals = goals.length > 0
  const needs = open.filter((g) => g.status.needThisMonth > 0)
  const goalsTotal = needs.reduce((a, g) => a + g.status.needThisMonth, 0)
  const [text, setText] = useState(centsToInput(plan?.save_cents ?? Math.round((s.income * 0.2) / 100) * 100))
  const [error, setError] = useState<string | null>(null)
  const save = withGoals ? s.save : (parseBRL(text) ?? 0)
  const free = s.income - s.committed - save
  const perDay = Math.max(0, Math.floor(free / daysInMonth(ym)))
  const pct = (v: number) => (s.income > 0 ? Math.round((v / s.income) * 100) : 0)

  async function confirm() {
    if (!withGoals && parseBRL(text) == null) return setError('Digite um valor, como 400,00 (ou 0).')
    setError(null)
    try {
      await write.mutateAsync(async (b) => {
        if (needs.length) {
          await b.insert('goal_moves', needs.map((g) => ({ goal_id: g.goal.id, kind: 'deposito' as const, amount_cents: g.status.needThisMonth, date: todayISO(), note: 'Separado do salário' })))
        }
        await savePlan(backend, ym, { save_cents: withGoals ? s.save : save, split_done_at: new Date().toISOString() }, plan)
      })
      toast(goalsTotal > 0 ? `${formatBRL(goalsTotal)} guardados nas caixinhas` : 'Plano do mês salvo')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const parts = [
    { label: 'Fixos e parcelas', cents: s.committed, cls: 'bg-ink' },
    { label: 'Caixinhas', cents: save, cls: 'bg-grow' },
    { label: 'Livre para o mês', cents: Math.max(0, free), cls: 'bg-coral' },
  ]

  return (
    <>
      <NavBar title="Separar o salário" large={false} left={<NavButton onClick={() => navigate(-1)}>Fechar</NavButton>} />
      <div className="stagger flex flex-col gap-5 pt-3">
        <div className="px-1">
          <p className="text-muted">{monthLabel(ym)} · entrou</p>
          <p className="num text-[2.25rem] leading-tight font-extrabold">{formatBRL(s.income)}</p>
        </div>

        {s.income > 0 && (
          <Card>
            <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              {parts.map((p) => (
                <div key={p.label} className={`${p.cls} transition-all duration-500`} style={{ width: `${Math.max(0, pct(p.cents))}%` }} />
              ))}
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {parts.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${p.cls}`} /> {p.label}
                  </span>
                  <span className="num font-semibold">
                    {formatBRL(p.cents)} <span className="font-medium text-muted">· {pct(p.cents)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {withGoals ? (
          <List header="Primeiro, as caixinhas" footer={<Link to="/caixinhas" className="font-semibold text-primary">Ajustar caixinhas</Link>}>
            {open.map((g) => (
              <Row
                key={g.goal.id}
                icon={<GoalBadgeIcon goal={g.goal} size={36} />}
                title={g.goal.name}
                subtitle={g.status.needThisMonth > 0 ? `Plano do mês ${formatBRL(g.status.perMonth ?? 0)}` : 'Mês em dia'}
                trailing={<Money cents={g.status.needThisMonth} className={g.status.needThisMonth > 0 ? 'font-semibold' : 'text-muted'} />}
              />
            ))}
          </List>
        ) : (
          <div>
            <Field label="Quanto guardar este mês" prefix="R$" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} error={error} hint="Separe primeiro, gaste depois: o que sobra no fim do mês costuma ser bem menos." />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[10, 15, 20, 30].map((p) => (
                <Chip key={p} selected={save === Math.round((s.income * p) / 10000) * 100} onClick={() => setText(centsToInput(Math.round((s.income * p) / 10000) * 100))}>
                  {p}%
                </Chip>
              ))}
            </div>
            <p className="mt-3 px-1 text-[0.875rem] text-muted">
              Dica: <Link to="/caixinhas" className="font-semibold text-primary">crie caixinhas</Link> e o app calcula quanto guardar para cada objetivo.
            </p>
          </div>
        )}

        {error && withGoals && <ErrorBox message={error} />}
        {free < 0 ? (
          <Notice tone="warn">Assim faltam {formatBRL(-free)} para os fixos. Vamos ajustar: guarde um pouco menos este mês, sem culpa.</Notice>
        ) : (
          <Notice tone="primary">
            Fica livre <strong>{formatBRL(free)}</strong> para o dia a dia, cerca de <strong>{formatBRL(perDay)} por dia</strong>.
          </Notice>
        )}

        <p className="px-1 text-[0.875rem] leading-snug text-muted">O dinheiro continua no seu banco: o app só registra. Para guardar de verdade, transfira esse valor para a sua poupança ou caixinha do banco.</p>
        <Button loading={write.isPending} onClick={confirm} disabled={s.income === 0}>
          {goalsTotal > 0 ? `Guardar ${formatBRL(goalsTotal)} agora` : 'Pronto, separei'}
        </Button>
        {s.income === 0 && <p className="px-1 text-center text-[0.875rem] text-muted">Informe o salário em Você para separar.</p>}
      </div>
    </>
  )
}

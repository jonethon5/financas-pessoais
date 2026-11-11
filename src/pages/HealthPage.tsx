import { Link, useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { BackButton, ErrorBox, NavBar, ProgressBar, Spinner } from '../components/ui'
import { useMonthView } from '../data/monthView'
import { currentYearMonth } from '../lib/dates'
import { financialHealth, type Health, type Pillar } from '../lib/health'
import { lessonById } from '../lib/learn'
import { friendlyError } from '../lib/supabase'
import { LessonIconTile } from './LearnPages'

export const scoreColor = (s: number | null) => (s == null ? 'var(--muted)' : s >= 80 ? 'var(--grow)' : s >= 60 ? 'var(--primary)' : s >= 40 ? 'var(--warn)' : 'var(--coral)')

/** Anel com a nota (0 a 100). */
export function HealthRing({ score, size = 132 }: { score: number | null; size?: number }) {
  const stroke = size / 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span className="absolute text-center">
        <span className="num block leading-none font-extrabold tracking-tight" style={{ fontSize: size / 3.3 }}>{score ?? '—'}</span>
        {size >= 100 && <span className="text-[0.75rem] text-muted">de 100</span>}
      </span>
    </span>
  )
}

/** Hook: a nota do mês atual (para a tela inicial e a página). */
export function useHealth(): { health: Health | null; isPending: boolean; error: unknown; refetch: () => void } {
  const view = useMonthView(currentYearMonth())
  if (view.isPending || view.error || !view.data) return { health: null, isPending: view.isPending, error: view.error, refetch: view.refetch }
  const d = view.data
  const health = financialHealth({
    today: d.today, monthTxs: d.txs, history: d.history, goals: d.goals, goalMoves: d.goalMoves, categories: d.categories,
    hasSalary: d.profile.salary_cents != null && d.profile.payday != null,
  })
  return { health, isPending: false, error: null, refetch: view.refetch }
}

function PillarRow({ p }: { p: Pillar }) {
  const v = p.score == null ? 0 : p.score / p.max
  return (
    <li className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{p.title}</span>
        <span className="num shrink-0 text-[0.9375rem] text-muted">{p.score == null ? 'sem dados' : `${p.score} de ${p.max}`}</span>
      </div>
      <ProgressBar className="mt-2" value={v} tone={v >= 0.8 ? 'grow' : v >= 0.4 ? 'warn' : 'danger'} label={p.title} />
      <p className="mt-1.5 text-[0.9375rem] leading-snug text-muted">{p.status}</p>
    </li>
  )
}

export function HealthPage() {
  const navigate = useNavigate()
  const { health: h, isPending, error, refetch } = useHealth()
  if (isPending) return <Spinner />
  if (error || !h) return <ErrorBox message={friendlyError(error)} onRetry={refetch} />
  return (
    <>
      <NavBar title="Saúde financeira" left={<BackButton label="Início" onClick={() => navigate('/')} />} />
      <div className="stagger flex flex-col gap-6 pb-4">
        <section className="flex items-center gap-5 rounded-[1.25rem] bg-surface p-5">
          <HealthRing score={h.score} />
          <div className="min-w-0">
            <p className="text-[1.375rem] leading-tight font-extrabold" style={{ color: scoreColor(h.score) }}>{h.label}</p>
            <p className="mt-1 text-[0.9375rem] leading-snug text-muted">A nota olha o seu dinheiro como um todo, não só este mês. Ela sobe a cada passo.</p>
          </div>
        </section>

        {h.next.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">O que fazer agora</h2>
            <div className="flex flex-col gap-2.5">
              {h.next.map((p) => {
                const lesson = lessonById(p.lesson)
                return (
                  <div key={p.id} className="rounded-[1.25rem] bg-primary-soft p-4">
                    <p className="text-[0.8125rem] font-semibold text-primary-strong">+{p.max - (p.score ?? 0)} pontos possíveis · {p.title}</p>
                    <p className="mt-1 text-[1.0625rem] leading-snug font-semibold">{p.tip}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.to && (
                        <Link to={p.to} className="press rounded-full bg-primary px-4 py-2 text-[0.9375rem] font-semibold text-on-primary">
                          Fazer agora
                        </Link>
                      )}
                      {lesson && (
                        <Link to={`/aprender/${lesson.id}`} className="press rounded-full bg-bg px-4 py-2 text-[0.9375rem] font-semibold text-primary">
                          Entender por quê
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Os 5 pilares</h2>
          <ul className="overflow-hidden rounded-[1.25rem] bg-surface">
            {h.pillars.map((p) => (
              <PillarRow key={p.id} p={p} />
            ))}
          </ul>
          <p className="mt-1.5 px-4 text-[0.8125rem] leading-snug text-muted">Baseado nos indicadores de saúde financeira da Financial Health Network: gastar menos do que ganha, pagar em dia, ter reserva, guardar sempre e planejar.</p>
        </section>

        {(() => {
          const l = lessonById(h.next[0]?.lesson ?? 'pague-se-primeiro')!
          return (
            <Link to={`/aprender/${l.id}`} className="press flex items-center gap-3 rounded-[1.25rem] bg-surface p-4">
              <LessonIconTile lesson={l} />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] text-muted">Aprenda em 2 minutos</span>
                <span className="block font-semibold">{l.title}</span>
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          )
        })()}
      </div>
    </>
  )
}

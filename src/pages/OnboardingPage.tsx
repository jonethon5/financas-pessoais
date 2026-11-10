import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { CalendarCheck, ChartLineUp, Compass, HandHeart, Lifebuoy, PiggyBank, UserCircle, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { useCelebrate } from '../components/Celebration'
import { useToast } from '../components/Toast'
import { Button, Chip, ErrorBox, Field, Spinner } from '../components/ui'
import { useCategories, useWrite } from '../data/finance'
import { useProfile, useUpdateProfile } from '../data/hooks'
import { currentYearMonth, monthKey } from '../lib/dates'
import { emergencySuggestion } from '../lib/goals'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { PROFILE_INFO, QUIZ, profileFromAnswers } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import type { About, Category } from '../types'

const AGES = ['18 a 24', '25 a 34', '35 a 44', '45 a 59', '60 ou mais']
const WORK = ['Carteira assinada', 'Autônomo ou freela', 'Servidor público', 'Estudante', 'Empresário', 'Aposentado', 'Outro']
const HOME = ['Sozinho', 'Com a família', 'Com parceiro(a)', 'Divido com amigos']
const GOALS = ['Sair das dívidas', 'Juntar uma reserva', 'Realizar um sonho', 'Organizar o mês', 'Parar de gastar por impulso', 'Me preparar para o futuro']

/** Gastos fixos mais comuns, com a categoria padrão de cada um. */
const FIXED = [
  ['Aluguel', 'Casa'],
  ['Condomínio', 'Casa'],
  ['Luz', 'Casa'],
  ['Água', 'Casa'],
  ['Internet', 'Telefone e internet'],
  ['Celular', 'Telefone e internet'],
  ['Streaming', 'Assinaturas'],
  ['Academia', 'Saúde'],
  ['Plano de saúde', 'Saúde'],
  ['Faculdade', 'Educação'],
  ['Transporte', 'Transporte'],
] as const

/** Ilustração do passo: ícone grande sobre círculos em degradê (sem emoji). */
function Art({ icon: Icon, color = '#0B7F5A' }: { icon: PhosphorIcon; color?: string }) {
  return (
    <div className="relative mx-auto mb-7 grid size-36 place-items-center">
      <span className="absolute inset-0 rounded-full opacity-15" style={{ background: color }} />
      <span className="absolute inset-5 rounded-full opacity-20" style={{ background: color }} />
      <span className="relative grid size-20 place-items-center rounded-[1.6rem] text-white shadow-[0_18px_40px_-14px_rgb(15_36_51/0.45)]" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
        <Icon size={44} weight="duotone" />
      </span>
    </div>
  )
}

function Step({ art, title, text, children }: { art: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="animate-page flex flex-1 flex-col">
      {art}
      <h1 className="text-center text-[1.75rem] leading-tight font-extrabold tracking-tight text-balance">{title}</h1>
      {text && <p className="mx-auto mt-2 max-w-sm text-center text-[1.0625rem] leading-snug text-muted text-balance">{text}</p>}
      <div className="mt-7 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Options({ value, options, onPick }: { value: string | undefined; options: readonly string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((o) => (
        <Chip key={o} selected={value === o} onClick={() => onPick(o)}>
          {o}
        </Chip>
      ))}
    </div>
  )
}

/** Primeiro acesso (também dá para refazer em Você). */
export function OnboardingPage({ onFinish }: { onFinish?: () => void }) {
  const profile = useProfile()
  const categories = useCategories()
  if (profile.isPending || categories.isPending) return <Spinner />
  if (profile.isError || categories.isError) return <ErrorBox message="Não foi possível carregar. Tente de novo." />
  return <Flow categories={categories.data} initialAbout={profile.data.about ?? {}} salary={profile.data.salary_cents} payday={profile.data.payday} onFinish={onFinish} />
}

function Flow({ categories, initialAbout, salary, payday, onFinish }: { categories: Category[]; initialAbout: About; salary: number | null; payday: number | null; onFinish?: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const celebrate = useCelebrate()
  const update = useUpdateProfile()
  const write = useWrite()
  const [step, setStep] = useState(0)
  const [about, setAbout] = useState<About>({ ...initialAbout, answers: { ...initialAbout.answers } })
  const [salaryText, setSalaryText] = useState(centsToInput(salary))
  const [paydayText, setPaydayText] = useState(payday ? String(payday) : '5')
  const [fixed, setFixed] = useState<Record<string, string>>({})
  const [wantsReserve, setWantsReserve] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const profileKey = profileFromAnswers(about.answers ?? {})
  const info = PROFILE_INFO[profileKey]
  const salaryCents = parseBRL(salaryText)
  const fixedTotal = Object.values(fixed).reduce((a, v) => a + (parseBRL(v) ?? 0), 0)
  const reserveTarget = emergencySuggestion(Math.max(fixedTotal, salaryCents ? Math.round(salaryCents * 0.6) : 0))
  const reserveMonthly = salaryCents ? Math.max(5000, Math.round((salaryCents * 0.1) / 1000) * 1000) : 10000

  const quizSteps = QUIZ.length
  // 0 boas-vindas · 1 sobre você · 2 objetivo · 3..(3+quiz-1) teste · resultado · salário · fixos · caixinha
  const RESULT = 3 + quizSteps
  const SALARY = RESULT + 1
  const FIXED_STEP = SALARY + 1
  const GOAL_STEP = FIXED_STEP + 1
  const TOTAL = GOAL_STEP + 1

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(about.age && about.work && about.home)
    if (step === 2) return Boolean(about.goal)
    if (step >= 3 && step < RESULT) return Boolean(about.answers?.[QUIZ[step - 3].id])
    if (step === SALARY) return salaryCents != null && Number(paydayText) >= 1 && Number(paydayText) <= 31
    return true
  }, [step, about, RESULT, SALARY, salaryCents, paydayText])

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      const catId = (name: string) => categories.find((c) => c.name === name)?.id ?? null
      const ym = currentYearMonth()
      await update.mutateAsync({
        about,
        money_profile: profileKey,
        ai_tone: info.tone,
        salary_cents: salaryCents,
        payday: Number(paydayText),
        onboarded_at: new Date().toISOString(),
      })
      await write.mutateAsync(async (b) => {
        const rows = FIXED.filter(([name]) => parseBRL(fixed[name] ?? '')).map(([name, cat]) => ({
          description: name, category_id: catId(cat), amount_cents: parseBRL(fixed[name])!, day: 10, remind: true, start_month: monthKey(ym), end_month: null, active: true,
        }))
        if (rows.length) await b.insert('recurrings', rows)
        if (wantsReserve) {
          const existing = await b.list('goals')
          if (!existing.some((g) => g.template === 'reserva')) {
            await b.insert('goals', [{
              name: 'Reserva de emergência', template: 'reserva', icon: 'lifebuoy', color: '#0B7F5A', photo_path: null, motivation: 'Dormir tranquilo sabendo que um imprevisto não vira dívida.',
              concrete_name: null, concrete_cents: null, mode: 'mensal', target_cents: reserveTarget, target_month: null, monthly_cents: reserveMonthly, priority: 1, archived: false, completed_at: null,
            }])
          }
        }
      })
      celebrate('Seu plano está pronto', 'Agora é só lançar os gastos do dia a dia. O app faz as contas.')
      if (onFinish) onFinish()
      else navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
      toast(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  /** Pular: só marca que o primeiro acesso foi visto (dá para refazer em Você). */
  async function skip() {
    try {
      await update.mutateAsync({ onboarded_at: new Date().toISOString() })
      if (onFinish) onFinish()
      else navigate('/', { replace: true })
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  const next = () => (step === GOAL_STEP ? finish() : setStep((s) => s + 1))
  const setAnswer = (id: string, v: string) => {
    setAbout((a) => ({ ...a, answers: { ...a.answers, [id]: v } }))
    setTimeout(() => setStep((s) => s + 1), 220)
  }

  let content: ReactNode
  if (step === 0) {
    content = <Step art={<Art icon={PiggyBank} />} title={`Bem-vindo ao ${APP_NAME}`} text="Em 2 minutos a gente monta o seu plano: quanto dá para gastar por dia e quanto guardar para o que importa." />
  } else if (step === 1) {
    content = (
      <Step art={<Art icon={UserCircle} color="#2F6F8F" />} title="Conta um pouco sobre você" text="Assim o app fala a sua língua e sugere metas do seu tamanho.">
        <p className="text-center text-[0.9375rem] font-semibold text-muted">Sua idade</p>
        <Options value={about.age} options={AGES} onPick={(age) => setAbout((a) => ({ ...a, age }))} />
        <p className="mt-2 text-center text-[0.9375rem] font-semibold text-muted">Seu trabalho</p>
        <Options value={about.work} options={WORK} onPick={(work) => setAbout((a) => ({ ...a, work }))} />
        <p className="mt-2 text-center text-[0.9375rem] font-semibold text-muted">Você mora</p>
        <Options value={about.home} options={HOME} onPick={(home) => setAbout((a) => ({ ...a, home }))} />
      </Step>
    )
  } else if (step === 2) {
    content = (
      <Step art={<Art icon={Compass} color="#6E56F0" />} title="Qual é o seu principal objetivo agora?">
        <Options value={about.goal} options={GOALS} onPick={(goal) => setAbout((a) => ({ ...a, goal }))} />
      </Step>
    )
  } else if (step < RESULT) {
    const q = QUIZ[step - 3]
    content = (
      <Step art={<Art icon={HandHeart} color="#C2410C" />} title={q.question} text={`Pergunta ${step - 2} de ${quizSteps} · sem resposta certa`}>
        <div className="flex flex-col gap-2.5">
          {q.options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setAnswer(q.id, o.label)}
              className={`press shadow-soft rounded-[1.1rem] border-2 bg-surface px-4 py-3.5 text-left text-[1.0625rem] font-semibold transition ${about.answers?.[q.id] === o.label ? 'border-primary' : 'border-transparent'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Step>
    )
  } else if (step === RESULT) {
    content = (
      <Step art={<Art icon={ChartLineUp} color="#0F9D6B" />} title={`Seu perfil: ${info.name}`} text={info.text}>
        <p className="text-center text-[0.9375rem] text-muted">
          As dicas vão chegar no tom <strong className="text-ink">{info.tone === 'suave' ? 'Suave' : info.tone === 'agressivo' ? 'Agressivo' : 'Equilibrado'}</strong>. Dá para mudar em Você.
        </p>
      </Step>
    )
  } else if (step === SALARY) {
    content = (
      <Step art={<Art icon={CalendarCheck} color="#0B7F5A" />} title="Quanto entra e quando?" text="O salário entra sozinho todo mês nesse dia. Rendas extras você lança à parte.">
        <Field label="Salário líquido (o que cai na conta)" prefix="R$" inputMode="decimal" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} placeholder="0,00" />
        <Field label="Dia do pagamento" inputMode="numeric" value={paydayText} onChange={(e) => setPaydayText(e.target.value)} />
      </Step>
    )
  } else if (step === FIXED_STEP) {
    content = (
      <Step art={<Art icon={CalendarCheck} color="#2F6F8F" />} title="Seus gastos fixos" text="Toque nos que você tem e informe o valor. Eles entram sozinhos todo mês (dá para ajustar o dia depois).">
        <div className="flex flex-wrap justify-center gap-2">
          {FIXED.map(([name]) => (
            <Chip
              key={name}
              selected={name in fixed}
              onClick={() =>
                setFixed((f) => {
                  const copy = { ...f }
                  if (name in copy) delete copy[name]
                  else copy[name] = ''
                  return copy
                })
              }
            >
              {name}
            </Chip>
          ))}
        </div>
        {Object.keys(fixed).map((name) => (
          <Field key={name} label={name} prefix="R$" inputMode="decimal" value={fixed[name]} onChange={(e) => setFixed((f) => ({ ...f, [name]: e.target.value }))} placeholder="0,00" />
        ))}
        {fixedTotal > 0 && <p className="text-center font-semibold">Total: {formatBRL(fixedTotal)} por mês</p>}
      </Step>
    )
  } else {
    content = (
      <Step art={<Art icon={Lifebuoy} color="#0B7F5A" />} title="Sua primeira caixinha" text="Antes de qualquer sonho, uma reserva para imprevistos. Ela evita que um susto vire dívida.">
        <button type="button" onClick={() => setWantsReserve(true)} className={`press shadow-soft rounded-[1.25rem] border-2 bg-surface p-4 text-left ${wantsReserve ? 'border-primary' : 'border-transparent'}`}>
          <p className="text-[1.125rem] font-bold">Reserva de emergência</p>
          <p className="mt-1 leading-snug text-muted">
            Meta de <strong className="text-ink">{formatBRL(reserveTarget)}</strong> (6 meses de gastos), guardando <strong className="text-ink">{formatBRL(reserveMonthly)} por mês</strong>. Dá para ajustar depois.
          </p>
        </button>
        <button type="button" onClick={() => setWantsReserve(false)} className={`press shadow-soft rounded-[1.25rem] border-2 bg-surface p-4 text-left ${!wantsReserve ? 'border-primary' : 'border-transparent'}`}>
          <p className="text-[1.0625rem] font-semibold">Quero escolher depois</p>
        </button>
        {error && <ErrorBox message={error} />}
      </Step>
    )
  }

  const isQuiz = step >= 3 && step < RESULT

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-5">
      <div className="flex items-center gap-1.5 pt-4 pb-6" aria-label={`Passo ${step + 1} de ${TOTAL}`}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-surface-2'}`} />
        ))}
      </div>
      <div key={step} className="flex flex-1 flex-col">
        {content}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 bg-bg/90 py-4 backdrop-blur">
        {!isQuiz && (
          <Button onClick={next} disabled={!canNext} loading={saving}>
            {step === 0 ? 'Começar' : step === GOAL_STEP ? 'Terminar' : 'Continuar'}
          </Button>
        )}
        {step > 0 && (
          <Button variant="ghost" size="md" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
        {step === 0 && (
          <Button variant="ghost" size="md" onClick={skip}>
            Pular por agora
          </Button>
        )}
      </div>
    </div>
  )
}

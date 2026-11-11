import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { CalendarCheck, Compass, HandHeart, Lifebuoy, UserCircle, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { Pig, mascotName, type PigColor } from '../components/Pig'
import { normalizeText } from '../lib/budget'
import { UFS, referenceIncome, starterSaving } from '../lib/regions'
import { TONES } from './you/YouPage'
import { useAuth } from '../auth/AuthProvider'
import { useCelebrate } from '../components/Celebration'
import { useToast } from '../components/Toast'
import { Button, Chip, ErrorBox, Field, Select, Spinner } from '../components/ui'
import { useCategories, useWrite } from '../data/finance'
import { useProfile, useUpdateProfile } from '../data/hooks'
import { currentYearMonth, monthKey } from '../lib/dates'
import { emergencySuggestion } from '../lib/goals'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { PROFILE_INFO, QUIZ, profileFromAnswers } from '../lib/psych'
import { friendlyError } from '../lib/supabase'
import type { About, AiTone, Category, Prefs } from '../types'

const AGES = ['18 a 24', '25 a 34', '35 a 44', '45 a 59', '60 ou mais']
const WORK = ['Carteira assinada', 'Autônomo ou freela', 'Servidor público', 'Estudante', 'Empresário', 'Aposentado', 'Outro']
const HOME = ['Sozinho', 'Com a família', 'Com parceiro(a)', 'Divido com amigos']
const GOALS = ['Sair das dívidas', 'Juntar uma reserva', 'Realizar um sonho', 'Organizar o mês', 'Parar de gastar por impulso', 'Me preparar para o futuro']
/** Sonhos (viram a caixinha do sonho e os "ganchos" das dicas: "seu iFood do mês = X% da viagem") */
const DREAMS = [
  { kind: 'viagem', label: 'Viagem', template: 'viagem', icon: 'airplane', color: '#2F6F8F' },
  { kind: 'casa', label: 'Casa própria', template: 'livre', icon: 'house', color: '#0B7F5A' },
  { kind: 'carro', label: 'Carro ou moto', template: 'carro', icon: 'car', color: '#C2410C' },
  { kind: 'estudos', label: 'Estudos', template: 'estudos', icon: 'graduation', color: '#0F2433' },
  { kind: 'casamento', label: 'Casamento', template: 'livre', icon: 'heart', color: '#D6457A' },
  { kind: 'compra', label: 'Comprar algo', template: 'compra', icon: 'bag', color: '#6E56F0' },
] as const

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
function Art({ icon: Icon, color = '#2F6FEB' }: { icon: PhosphorIcon; color?: string }) {
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
  return <Flow categories={categories.data} initialAbout={profile.data.about ?? {}} salary={profile.data.salary_cents} payday={profile.data.payday} nickname={profile.data.nickname ?? ''} prefs={profile.data.prefs} onFinish={onFinish} />
}

function Flow({ categories, initialAbout, salary, payday, nickname, prefs, onFinish }: { categories: Category[]; initialAbout: About; salary: number | null; payday: number | null; nickname: string; prefs: Prefs; onFinish?: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const celebrate = useCelebrate()
  const update = useUpdateProfile()
  const { mode } = useAuth()
  const write = useWrite()
  const [step, setStep] = useState(0)
  const [about, setAbout] = useState<About>({ ...initialAbout, answers: { ...initialAbout.answers } })
  const [salaryText, setSalaryText] = useState(centsToInput(salary))
  const [paydayText, setPaydayText] = useState(payday ? String(payday) : '5')
  const [fixed, setFixed] = useState<Record<string, string>>({})
  const [wantsReserve, setWantsReserve] = useState(true)
  const [wantsDream, setWantsDream] = useState(true)
  const [name, setName] = useState(nickname)
  const [dreamText, setDreamText] = useState(initialAbout.dream?.cents ? centsToInput(initialAbout.dream.cents) : '')
  const [tone, setTone] = useState<AiTone | null>(null)
  const [pigColor, setPigColor] = useState<PigColor>(prefs.pig?.color ?? 'azul')
  const pigPrefs = { ...prefs, pig: { ...prefs.pig, color: pigColor } }
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const profileKey = profileFromAnswers(about.answers ?? {})
  const info = PROFILE_INFO[profileKey]
  const chosenTone: AiTone = tone ?? info.tone
  const dream = DREAMS.find((x) => x.kind === about.dream?.kind)
  const dreamCents = parseBRL(dreamText)
  const salaryCents = parseBRL(salaryText)
  const fixedTotal = Object.values(fixed).reduce((a, v) => a + (parseBRL(v) ?? 0), 0)
  const reserveTarget = emergencySuggestion(Math.max(fixedTotal, salaryCents ? Math.round(salaryCents * 0.6) : 0))
  // Começo leve (5% da renda; sem salário, a média do estado): o porquinho segue essa meta
  const reserveMonthly = starterSaving(referenceIncome(salaryCents, about.uf))

  const quizSteps = QUIZ.length
  // 0 boas-vindas · 1 sobre você · 2 objetivo · 3..(3+quiz-1) teste · resultado · salário · fixos · caixinha
  const RESULT = 3 + quizSteps
  const SALARY = RESULT + 1
  const FIXED_STEP = SALARY + 1
  const GOAL_STEP = FIXED_STEP + 1
  const TOTAL = GOAL_STEP + 1

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(about.age && about.work && about.home)
    if (step === 2) return Boolean(about.goal) && (about.goal !== 'Realizar um sonho' || Boolean(about.dream))
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
      const aboutToSave: About = { ...about, dream: about.dream ? { ...about.dream, cents: dreamCents ?? null } : undefined }
      await update.mutateAsync({
        about: aboutToSave,
        nickname: name.trim().slice(0, 40) || null,
        // Na demonstração, o nome digitado substitui o da pessoa de exemplo (foto com as iniciais certas)
        ...(mode === 'demo' && name.trim() ? { name: name.trim().slice(0, 80) } : {}),
        money_profile: profileKey,
        ai_tone: chosenTone,
        prefs: pigPrefs,
        salary_cents: salaryCents,
        payday: Number(paydayText),
        onboarded_at: new Date().toISOString(),
      })
      await write.mutateAsync(async (b) => {
        // Não repete um fixo que já existe (refazer o primeiro acesso, ou a demonstração)
        const have = new Set((await b.list('recurrings')).map((r) => normalizeText(r.description)))
        const rows = FIXED.filter(([name]) => parseBRL(fixed[name] ?? '') && !have.has(normalizeText(name))).map(([name, cat]) => ({
          description: name, category_id: catId(cat), amount_cents: parseBRL(fixed[name])!, day: 10, remind: true, start_month: monthKey(ym), end_month: null, active: true,
        }))
        if (rows.length) await b.insert('recurrings', rows)
        const existing = await b.list('goals')
        if (wantsDream && dream && dreamCents && !existing.some((g) => g.name === dream.label)) {
          await b.insert('goals', [{
            name: dream.label, template: dream.template, icon: dream.icon, color: dream.color, photo_path: null, motivation: null,
            concrete_name: null, concrete_cents: null, mode: 'mensal', target_cents: dreamCents, target_month: null, monthly_cents: reserveMonthly, priority: 2, archived: false, completed_at: null,
          }])
        }
        if (wantsReserve) {
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
      await update.mutateAsync({ onboarded_at: new Date().toISOString(), prefs: pigPrefs })
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
    content = (
      <Step art={<div className="mx-auto mb-2"><Pig art="principal" color={pigColor} px={180} /></div>} title={`Oi! Eu sou ${pigColor === 'rosa' ? 'a' : 'o'} ${mascotName(pigColor)}`} text={`Vou te ajudar a gastar com consciência e guardar para o que importa. Em 2 minutos a gente monta o seu plano no ${APP_NAME}.`}>
        <p className="text-center text-[0.9375rem] font-semibold text-muted">Escolha o seu mascote</p>
        <div className="grid grid-cols-2 gap-3">
          {(['azul', 'rosa'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setPigColor(c)} aria-pressed={pigColor === c} className={`press flex flex-col items-center gap-1 rounded-[1.25rem] border-2 bg-surface px-2 pt-2 pb-3 ${pigColor === c ? 'border-primary' : 'border-transparent'}`}>
              <Pig art="rosto-feliz" color={c} px={84} still />
              <span className="font-bold">{c === 'rosa' ? 'Porquinha' : 'Porquinho'}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-[0.875rem] leading-snug text-muted">Quanto mais você guarda o que combinou, mais gordinho eu fico. Cada meta do dia vale moedas para roupinhas novas.</p>
      </Step>
    )
  } else if (step === 1) {
    content = (
      <Step art={<Art icon={UserCircle} color="#2F6F8F" />} title="Conta um pouco sobre você" text="Assim o app fala a sua língua e sugere metas do seu tamanho.">
        <Field label="Como quer ser chamado?" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Seu nome ou apelido" autoComplete="given-name" />
        <Select label="Seu estado (opcional)" value={about.uf ?? ''} onChange={(e) => setAbout((a) => ({ ...a, uf: e.target.value || undefined }))}>
          <option value="">Prefiro não dizer</option>
          {UFS.map((u) => (
            <option key={u.uf} value={u.uf}>
              {u.name}
            </option>
          ))}
        </Select>
        <p className="-mt-2 px-1 text-[0.8125rem] leading-snug text-muted">Para adaptar os exemplos e as metas ao custo de vida da sua região.</p>
        <p className="mt-2 text-center text-[0.9375rem] font-semibold text-muted">Sua idade</p>
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
        {about.goal === 'Realizar um sonho' && (
          <>
            <p className="mt-3 text-center text-[0.9375rem] font-semibold text-muted">Qual sonho?</p>
            <Options value={dream?.label} options={DREAMS.map((x) => x.label)} onPick={(label) => setAbout((a) => ({ ...a, dream: { kind: DREAMS.find((x) => x.label === label)!.kind, label } }))} />
            {dream && <Field label="Quanto custa, mais ou menos? (opcional)" prefix="R$" inputMode="decimal" value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder="0,00" />}
          </>
        )}
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
      <Step art={<div className="mx-auto mb-2"><Pig mood="normal" tone={chosenTone} color={pigColor} px={150} /></div>} title="Como eu falo com você?" text={`Seu perfil: ${info.name}. ${info.text}`}>
        <div className="flex flex-col gap-2.5">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTone(t.value)}
              className={`press shadow-soft flex items-center gap-3 rounded-[1.1rem] border-2 bg-surface px-3 py-2 text-left ${chosenTone === t.value ? 'border-primary' : 'border-transparent'}`}
            >
              <Pig tone={t.value} mood="normal" color={pigColor} px={64} still />
              <span>
                <span className="block text-[1.0625rem] font-bold">
                  {t.label}
                  {t.value === info.tone && <span className="ml-2 text-[0.8125rem] font-semibold text-primary">sugerido para você</span>}
                </span>
                <span className="block text-[0.9375rem] leading-snug text-muted">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
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
        {dream && dreamCents ? (
          <button type="button" onClick={() => setWantsDream((v) => !v)} aria-pressed={wantsDream} className={`press shadow-soft rounded-[1.25rem] border-2 bg-surface p-4 text-left ${wantsDream ? 'border-primary' : 'border-transparent'}`}>
            <p className="text-[1.125rem] font-bold">E a caixinha do sonho: {dream.label}</p>
            <p className="mt-1 leading-snug text-muted">
              Meta de <strong className="text-ink">{formatBRL(dreamCents)}</strong>. {wantsDream ? 'Vou criar junto.' : 'Toque para criar junto.'}
            </p>
          </button>
        ) : null}
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

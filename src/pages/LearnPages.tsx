import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Bell, Brain, ChartPie, CheckCircle, Clock, CreditCard, Hourglass, LockKey, NotePencil, PiggyBank, Repeat, ShieldCheck, Snowflake, SunHorizon,
  Tag, Target, WarningCircle, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { ChevronRight } from 'lucide-react'
import { BackButton, Badge, Button, List, NavBar, Notice } from '../components/ui'
import { liftForDark, useIsDark } from '../lib/theme'
import { GROUPS, LESSONS, SOURCE_LABEL, lessonById, type Lesson, type LessonIcon } from '../lib/learn'

const ICONS: Record<LessonIcon, PhosphorIcon> = {
  piggy: PiggyBank, tag: Tag, shield: ShieldCheck, hourglass: Hourglass, clock: Clock, target: Target, card: CreditCard, warning: WarningCircle,
  snowball: Snowflake, brain: Brain, sunrise: SunHorizon, bell: Bell, lock: LockKey, pie: ChartPie, repeat: Repeat, note: NotePencil,
}

const READ_KEY = 'poupei:lidas'
function readSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markRead(id: string) {
  try {
    const s = readSet()
    s.add(id)
    localStorage.setItem(READ_KEY, JSON.stringify([...s]))
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export function LessonIconTile({ lesson, size = 'md' }: { lesson: Lesson; size?: 'md' | 'lg' }) {
  const dark = useIsDark()
  const color = liftForDark(lesson.color, dark)
  const Icon = ICONS[lesson.icon]
  const box = size === 'lg' ? 'size-16 rounded-[1.25rem]' : 'size-10 rounded-[0.75rem]'
  return (
    <span className={`grid shrink-0 place-items-center ${box}`} style={{ background: `${color}1f`, color }}>
      <Icon size={size === 'lg' ? 34 : 22} weight="duotone" />
    </span>
  )
}

/** Aprender: métodos de livros e de estudos, em linguagem simples. */
export function LearnPage() {
  const navigate = useNavigate()
  const [read] = useState(readSet)
  const done = LESSONS.filter((l) => read.has(l.id)).length
  return (
    <>
      <NavBar title="Aprender" left={<BackButton label="Início" onClick={() => navigate('/')} />} />
      <div className="stagger flex flex-col gap-6">
        <Notice tone="primary">
          Métodos de <strong>livros conhecidos</strong> e de <strong>pesquisas científicas</strong>, explicados de um jeito simples e com exemplos para quem ganha por volta de R$ 3.000. Leva uns 2 minutos cada.
          {done > 0 && <span className="mt-1.5 block font-semibold text-primary-strong">Você já leu {done} de {LESSONS.length}.</span>}
        </Notice>
        {GROUPS.map((g) => (
          <List key={g.id} header={g.title}>
            {LESSONS.filter((l) => l.group === g.id).map((l) => (
              <li key={l.id} className="border-b border-line last:border-b-0">
                <Link to={`/aprender/${l.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-surface-2">
                  <LessonIconTile lesson={l} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-semibold">{l.title}</span>
                    <span className="mt-0.5 block text-[0.9375rem] leading-snug text-muted">{l.short}</span>
                  </span>
                  {read.has(l.id) ? (
                    <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-grow" aria-label="Lida" />
                  ) : (
                    <ChevronRight className="mt-0.5 size-5 shrink-0 text-faint" aria-hidden />
                  )}
                </Link>
              </li>
            ))}
          </List>
        ))}
      </div>
    </>
  )
}

export function LessonPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const lesson = lessonById(id)
  useEffect(() => {
    if (lesson) markRead(lesson.id)
  }, [lesson])
  if (!lesson) return <Notice>Essa lição não existe mais.</Notice>
  const i = LESSONS.indexOf(lesson)
  const next = LESSONS[(i + 1) % LESSONS.length]
  return (
    <>
      <NavBar title="" large={false} left={<BackButton label="Aprender" onClick={() => navigate('/aprender')} />} />
      <article className="stagger flex flex-col gap-5 pb-4">
        <header className="flex flex-col gap-3 pt-3">
          <LessonIconTile lesson={lesson} size="lg" />
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{lesson.title}</h1>
          <p className="text-[1.0625rem] leading-snug text-muted">{lesson.short}</p>
        </header>

        <div className="flex flex-col gap-3 text-[1.0625rem] leading-relaxed">
          {lesson.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        <section className="rounded-[1.25rem] bg-surface p-4">
          <h2 className="text-[1.0625rem] font-extrabold">Como fazer</h2>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {lesson.steps.map((s, n) => (
              <li key={s} className="flex gap-3 leading-snug">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[0.875rem] font-bold text-on-primary">{n + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[1.25rem] bg-primary-soft p-4">
          <h2 className="text-[0.8125rem] font-semibold tracking-wide text-primary-strong uppercase">Na prática, com R$ 3.000</h2>
          <p className="mt-1 text-[1.0625rem] leading-snug">{lesson.example}</p>
        </section>

        {lesson.cta && (
          <Button onClick={() => navigate(lesson.cta!.to)}>{lesson.cta.label}</Button>
        )}

        <section>
          <h2 className="mb-2 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">De onde vem</h2>
          <ul className="flex flex-col gap-2">
            {lesson.sources.map((s) => (
              <li key={s.text} className="flex flex-col items-start gap-1 text-[0.9375rem] leading-snug">
                <Badge tone={s.kind === 'estudo' ? 'ai' : s.kind === 'oficial' ? 'primary' : 'neutral'}>{SOURCE_LABEL[s.kind]}</Badge>
                <span className="text-muted">{s.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] leading-snug text-faint">Resumo com palavras nossas, para educação financeira. Não é recomendação de investimento.</p>
        </section>

        <Link to={`/aprender/${next.id}`} className="press flex items-center gap-3 rounded-[1.25rem] bg-surface p-4">
          <LessonIconTile lesson={next} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] text-muted">Próxima</span>
            <span className="block font-semibold">{next.title}</span>
          </span>
          <ChevronRight className="size-5 text-faint" />
        </Link>
      </article>
    </>
  )
}

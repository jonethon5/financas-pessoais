import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle, Circle, Coin } from '@phosphor-icons/react'
import { MASCOT_NAME } from '../brand'
import { Pig } from '../components/Pig'
import { useToast } from '../components/Toast'
import { BackButton, ErrorBox, NavBar, ProgressBar, Spinner } from '../components/ui'
import { usePig } from '../data/pig'
import { formatBRL } from '../lib/money'
import { COINS, DAILY_KINDS, GOAL_LABEL, SHOP, pigLine } from '../lib/pig'
import { friendlyError } from '../lib/supabase'
import { TONES } from './you/YouPage'

const dayIndex = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000)

/** Balão de fala do porquinho. */
export function PigSays({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[1.1rem] bg-surface px-3.5 py-2.5 text-[0.9375rem] leading-snug ${className}`}>
      <span aria-hidden className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 bg-surface" />
      <span className="relative">{children}</span>
    </div>
  )
}

export function CoinBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[0.875rem] font-bold text-warn-strong">
      <Coin size={16} weight="fill" className="text-[#F2A516]" /> {n}
    </span>
  )
}

export function PigPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const pig = usePig((n) => toast(`+${n} ${n === 1 ? 'moeda' : 'moedas'} para o ${MASCOT_NAME}`))
  const [busy, setBusy] = useState<string | null>(null)
  if (pig.isPending) return <Spinner />
  if (pig.error || !pig.view || !pig.state || !pig.input) return <ErrorBox message={friendlyError(pig.error)} onRetry={pig.refetch} />
  const { state: s, view: d, input } = pig
  const tone = d.profile.ai_tone
  const toneInfo = TONES.find((t) => t.value === tone)
  const savedPct = s.savedRatio == null ? null : Math.min(100, Math.round(s.savedRatio * 100))

  async function act(item: string) {
    setBusy(item)
    try {
      if (pig.owned.has(item)) await pig.setWear(pig.wear === item ? null : item)
      else {
        await pig.buy(item)
        toast('Comprado! Ele já está usando.')
      }
    } catch (err) {
      toast(/insuficiente/i.test(String((err as Error).message)) ? 'Moedas insuficientes. Bata as metas do dia para ganhar mais.' : friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <NavBar title={MASCOT_NAME} left={<BackButton label="Início" onClick={() => navigate('/')} />} right={<CoinBadge n={pig.balance} />} />
      <div className="stagger flex flex-col gap-6 pb-6">
        <section className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-gradient-to-b from-primary-soft to-transparent px-4 pt-4 pb-2">
          <Pig size={s.size} mood={s.mood} tone={tone} wear={pig.wear} px={210} />
          <PigSays className="self-stretch">{pigLine(tone, s.mood, dayIndex(input.today))}</PigSays>
        </section>

        <section>
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[1.0625rem] font-extrabold">Barriguinha</h2>
            <span className="text-[0.875rem] text-muted">{s.size === 'gordo' ? 'cheinho' : s.size === 'normal' ? 'satisfeito' : 'com fome'}</span>
          </div>
          <ProgressBar className="mt-2" value={s.fullness} tone={s.fullness >= 0.7 ? 'grow' : s.fullness >= 0.35 ? 'warn' : 'danger'} label="Barriguinha do porquinho" />
          <p className="mt-2 px-1 text-[0.9375rem] leading-snug text-muted">
            {input.saveTarget > 0 ? (
              <>
                Ele come o que <strong className="text-ink">você combinou guardar</strong>: {formatBRL(input.saveTarget)} por mês{savedPct != null ? ` (${savedPct}% feito)` : ''}, e os seus hábitos da semana ({s.habitDays} de 7 dias).
              </>
            ) : (
              <>
                Combine quanto quer guardar por mês (pode ser pouco) e ele cresce junto. <Link to="/caixinhas" className="font-semibold text-primary">Criar caixinha</Link>
              </>
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[1.0625rem] font-extrabold">Metas de hoje</h2>
          <ul className="overflow-hidden rounded-[1.25rem] bg-surface">
            {DAILY_KINDS.map((k) => {
              const done = s.today[k]
              const later = k === 'no_limite' || k === 'sem_gastar'
              return (
                <li key={k} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  {done ? <CheckCircle size={24} weight="fill" className="shrink-0 text-grow" /> : <Circle size={24} className="shrink-0 text-faint" />}
                  <span className="flex-1">
                    <span className="block font-semibold">{GOAL_LABEL[k]}</span>
                    {later && <span className="block text-[0.8125rem] text-muted">conta quando o dia acabar</span>}
                  </span>
                  <span className="text-[0.875rem] font-semibold text-muted">+{COINS[k]}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 px-1 text-[0.8125rem] leading-snug text-muted">Bônus: semana inteira com metas +{COINS.semana}; cada marco de caixinha (25%, 50%, 75%, 100%) +{COINS.marco}.</p>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-[1.0625rem] font-extrabold">Lojinha</h2>
            <CoinBadge n={pig.balance} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {SHOP.map((it) => {
              const owned = pig.owned.has(it.key)
              const wearing = pig.wear === it.key
              const afford = pig.balance >= it.price
              return (
                <button
                  key={it.key}
                  type="button"
                  disabled={busy != null || (!owned && !afford)}
                  onClick={() => void act(it.key)}
                  className={`press flex flex-col items-center gap-1 rounded-[1.1rem] border-2 bg-surface px-1.5 pt-1 pb-2.5 disabled:opacity-55 ${wearing ? 'border-primary' : 'border-transparent'}`}
                >
                  <Pig size="normal" mood="normal" tone={tone} wear={it.key} px={84} className="!animate-none" />
                  <span className="text-center text-[0.8125rem] leading-tight font-semibold">{it.name}</span>
                  <span className="text-[0.75rem] font-bold text-muted">{wearing ? 'Usando' : owned ? 'Usar' : `${it.price} moedas`}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 px-1 text-[0.8125rem] leading-snug text-muted">As moedas só valem aqui dentro. As dicas são sempre de graça.</p>
        </section>

        <Link to="/voce" className="press flex items-center justify-between rounded-[1.25rem] bg-surface p-4">
          <span>
            <span className="block text-[0.8125rem] text-muted">Modo do {MASCOT_NAME}</span>
            <span className="block font-semibold">{toneInfo?.label}: {toneInfo?.hint}</span>
          </span>
        </Link>
      </div>
    </>
  )
}

import { useState } from 'react'
import { Heart } from '@phosphor-icons/react'
import { APP_VERSION } from '../brand'
import { useRateScreen } from '../data/hooks'
import { PROBLEM_OPTIONS, RATING_OPTIONS, type ScreenInfo } from '../lib/ratings'
import { friendlyError } from '../lib/supabase'
import { mascotSrc, usePigColor } from './Pig'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button, Chip, ErrorBox, TextArea } from './ui'

type Step = 'intro' | 'nota' | 'melhorar'

/** Dados que ajudam a entender a nota (sem nada pessoal). */
function ratingContext(search: string): Record<string, string> {
  const ctx: Record<string, string> = {
    versao: APP_VERSION,
    tela: `${window.innerWidth}x${window.innerHeight}`,
    instalado: window.matchMedia('(display-mode: standalone)').matches ? 'sim' : 'não',
  }
  const aba = new URLSearchParams(search).get('aba')
  if (aba) ctx.aba = aba.slice(0, 30)
  return ctx
}

/**
 * "Avalie esta tela" (como no app do Nubank): um botão discreto no fim de cada tela.
 * Abre uma folha com 2 perguntas: a nota (5 níveis) e o que melhorar (opções prontas + comentário opcional).
 */
export function RateScreen({ screen, search }: { screen: ScreenInfo; search: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-10 flex justify-center print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold text-muted transition active:scale-[0.97] active:bg-surface-2"
      >
        <Heart weight="fill" className="size-[1.1rem] text-coral" aria-hidden />
        Avalie esta tela
      </button>
      {open && <RateSheet screen={screen} search={search} onClose={() => setOpen(false)} />}
    </div>
  )
}

function RateSheet({ screen, search, onClose }: { screen: ScreenInfo; search: string; onClose: () => void }) {
  const toast = useToast()
  const color = usePigColor()
  const send = useRateScreen()
  const [step, setStep] = useState<Step>('intro')
  const [rating, setRating] = useState<number | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggle = (p: string) => setProblems((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))

  async function submit() {
    if (rating == null) return
    setError(null)
    try {
      await send.mutateAsync({ screen: screen.key, rating, problems, message: message.trim() || null, context: ratingContext(search) })
      toast('Obrigado! Isso ajuda muito.')
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <Sheet open title="Avalie esta tela" onClose={onClose}>
      {step === 'intro' && (
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <img src={mascotSrc(color, 'rosto-feliz')} alt="" className="h-28 w-auto" draggable={false} />
          <div>
            <p className="text-[1.25rem] leading-tight font-bold">Nos ajude a melhorar sua experiência</p>
            <p className="mt-1.5 text-muted">
              São só 2 perguntas sobre a tela <strong className="text-ink">{screen.name}</strong>.
            </p>
          </div>
          <div className="mt-2 flex w-full flex-col gap-2">
            <Button onClick={() => setStep('nota')}>Quero responder</Button>
            <Button variant="ghost" onClick={onClose}>
              Agora não
            </Button>
          </div>
        </div>
      )}

      {step === 'nota' && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Pergunta 1 de 2</p>
            <p id="nota-titulo" className="mt-1 text-[1.125rem] leading-snug font-bold">
              Quão satisfeito você está com esta tela, suas funções e conteúdos?
            </p>
          </div>
          <div role="radiogroup" aria-labelledby="nota-titulo" className="overflow-hidden rounded-[1rem] bg-surface">
            {RATING_OPTIONS.map((o, i) => {
              const on = rating === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRating(o.value)}
                  className={`flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left text-[1rem] transition active:bg-surface-2 ${i ? 'border-t border-line' : ''} ${on ? 'font-semibold' : ''}`}
                >
                  {o.label}
                  <span aria-hidden className={`grid size-5.5 place-items-center rounded-full border-2 transition ${on ? 'border-primary' : 'border-faint'}`}>
                    <span className={`size-2.5 rounded-full bg-primary transition ${on ? 'scale-100' : 'scale-0'}`} />
                  </span>
                </button>
              )
            })}
          </div>
          <Button disabled={rating == null} onClick={() => setStep('melhorar')}>
            Continuar
          </Button>
        </div>
      )}

      {step === 'melhorar' && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Pergunta 2 de 2</p>
            <p className="mt-1 text-[1.125rem] leading-snug font-bold">
              {rating != null && rating >= 4 ? 'Tem algo que ainda dá para melhorar?' : 'O que podemos melhorar?'}
            </p>
            <p className="mt-1 text-[0.9375rem] text-muted">Marque quantas quiser. É opcional.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROBLEM_OPTIONS.map((p) => (
              <Chip key={p} selected={problems.includes(p)} onClick={() => toggle(p)}>
                {p}
              </Chip>
            ))}
          </div>
          <TextArea
            label="Quer contar mais? (opcional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex.: o saldo não bateu com o do banco"
          />
          {error && <ErrorBox message={error} />}
          <div className="flex flex-col gap-2">
            <Button loading={send.isPending} onClick={submit}>
              Enviar
            </Button>
            <Button variant="ghost" onClick={() => setStep('nota')}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

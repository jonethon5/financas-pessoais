import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ImagePlus, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { APP_VERSION } from '../../brand'
import { useToast } from '../../components/Toast'
import { Badge, Button, ErrorBox, List, NavBar, NavButton, Notice, Row, Segmented, TextArea } from '../../components/ui'
import { useMyFeedback, useSendFeedback } from '../../data/hooks'
import { formatDateShort } from '../../lib/dates'
import { shrinkImage } from '../../lib/image'
import { friendlyError } from '../../lib/supabase'
import type { FeedbackKind, FeedbackStatus } from '../../types'

const KINDS: { value: FeedbackKind; label: string; placeholder: string }[] = [
  { value: 'sugestao', label: 'Sugestão', placeholder: 'O que deixaria o app melhor para você?' },
  { value: 'problema', label: 'Problema', placeholder: 'O que aconteceu? O que você esperava que acontecesse?' },
  { value: 'elogio', label: 'Elogio', placeholder: 'O que você mais gostou?' },
]

const STATUS: Record<FeedbackStatus, { label: string; tone: 'neutral' | 'primary' | 'ok' }> = {
  novo: { label: 'Enviada', tone: 'neutral' },
  lido: { label: 'Lida', tone: 'primary' },
  resolvido: { label: 'Resolvida', tone: 'ok' },
}

/** Dados que ajudam a entender o problema (sem nada pessoal). */
function deviceContext(): Record<string, string> {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return {
    versao: APP_VERSION,
    aparelho: navigator.userAgent.slice(0, 240),
    tela: `${window.innerWidth}x${window.innerHeight}`,
    instalado: standalone ? 'sim' : 'não',
  }
}

export function FeedbackPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { mode } = useAuth()
  const send = useSendFeedback()
  const mine = useMyFeedback()
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<FeedbackKind>('sugestao')
  const [message, setMessage] = useState('')
  const [image, setImage] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!image) return setPreview(null)
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  async function pick(file: File) {
    setError(null)
    try {
      setImage(await shrinkImage(file))
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (message.trim().length < 3) return setFieldError('Escreva um pouquinho mais.')
    setFieldError(null)
    setError(null)
    try {
      await send.mutateAsync({ kind, message: message.trim(), context: deviceContext(), screenshot: image })
      toast('Recebemos, obrigado!')
      setMessage('')
      setImage(null)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const current = KINDS.find((k) => k.value === kind)!

  return (
    <>
      <NavBar
        title="Sugestões"
        large={false}
        left={<NavButton onClick={() => navigate('/voce')}>Fechar</NavButton>}
        right={
          <NavButton type="submit" form="sugestao" strong disabled={send.isPending}>
            Enviar
          </NavButton>
        }
      />
      <form id="sugestao" onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pt-4">
        <Segmented label="Tipo de mensagem" value={kind} onChange={setKind} options={KINDS.map(({ value, label }) => ({ value, label }))} />
        {mode === 'demo' && <Notice>No modo demonstração a mensagem fica só neste aparelho. Crie uma conta para enviar de verdade.</Notice>}
        {error && <ErrorBox message={error} />}
        <TextArea
          label="Mensagem"
          placeholder={current.placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={6}
          error={fieldError}
        />

        {preview ? (
          <div className="relative self-start">
            <img src={preview} alt="Imagem anexada" className="shadow-soft max-h-48 rounded-[0.875rem]" />
            <button type="button" onClick={() => setImage(null)} aria-label="Tirar imagem" className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-ink text-white">
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <Button variant="secondary" size="md" onClick={() => fileInput.current?.click()} className="self-start">
            <ImagePlus className="size-5" strokeWidth={1.8} aria-hidden /> Anexar print (opcional)
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void pick(file)
          }}
        />
        <p className="px-1 text-[0.8125rem] leading-snug text-muted">Junto com a mensagem vão a versão do app e o modelo do aparelho, para ajudar a encontrar o problema.</p>
        <Button type="submit" loading={send.isPending}>
          Enviar
        </Button>
      </form>

      {Boolean(mine.data?.length) && (
        <List header="Suas mensagens" className="mt-8">
          {mine.data!.map((f) => (
            <Row
              key={f.id}
              title={<span className="block truncate">{f.message}</span>}
              subtitle={`${KINDS.find((k) => k.value === f.kind)?.label} · ${formatDateShort(f.created_at.slice(0, 10))}`}
              trailing={<Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>}
            />
          ))}
        </List>
      )}
    </>
  )
}

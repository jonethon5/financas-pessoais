import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Copy, Trash2 } from 'lucide-react'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { copyText, useToast } from '../../components/Toast'
import { BackButton, Badge, Button, Card, ErrorBox, Field, List, NavBar, Row, Spinner, Switch } from '../../components/ui'
import { useAdminActions, useAdminFeedback, useAdminStats, useBetaCodes, useBetaRequired, useFileUrl, useProfile } from '../../data/hooks'
import { formatDateShort } from '../../lib/dates'
import { friendlyError } from '../../lib/supabase'
import type { AdminFeedback, BetaCode } from '../../types'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem 0/O, 1/I/L (fácil de ditar)

/** Código difícil de adivinhar: BETA-XXXXXXXX (31^8 ≈ 850 bilhões de combinações). */
export function randomBetaCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `BETA-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`
}

const KIND_LABEL = { sugestao: 'Sugestão', problema: 'Problema', elogio: 'Elogio' } as const

/** Painel do beta: códigos de acesso, números gerais e sugestões dos testadores. Só para o administrador. */
export function AdminPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (!profile.data?.is_admin) {
    return (
      <>
        <NavBar title="Painel do beta" large={false} left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
        <p className="py-10 text-center text-muted">Somente o administrador vê esta tela.</p>
      </>
    )
  }
  return <AdminPanel />
}

function AdminPanel() {
  const navigate = useNavigate()
  const toast = useToast()
  const stats = useAdminStats()
  const codes = useBetaCodes()
  const required = useBetaRequired()
  const feedback = useAdminFeedback()
  const actions = useAdminActions()
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<BetaCode | null>(null)

  const fail = (err: unknown) => toast(friendlyError(err))

  return (
    <>
      <NavBar title="Painel do beta" left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
      <div className="flex flex-col gap-7">
        {stats.isError ? (
          <ErrorBox message={friendlyError(stats.error)} onRetry={() => stats.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Testadores', stats.data?.users],
              ['Novos (7 dias)', stats.data?.users_7d],
              ['Fizeram o início', stats.data?.onboarded],
              ['Sugestões novas', stats.data?.feedback_new],
            ].map(([label, value]) => (
              <Card key={label as string} className="py-3.5">
                <p className="text-[0.8125rem] text-muted">{label}</p>
                <p className="num text-[1.75rem] leading-tight font-bold">{value ?? '–'}</p>
              </Card>
            ))}
          </div>
        )}

        <List header="Cadastro" footer="Desligado: qualquer pessoa com o link cria conta, sem código.">
          <Row
            title="Exigir código de acesso"
            trailing={
              <Switch
                label="Exigir código de acesso"
                checked={required.data ?? true}
                disabled={required.isPending || actions.setBetaRequired.isPending}
                onChange={(on) => actions.setBetaRequired.mutate(on, { onError: fail })}
              />
            }
          />
        </List>

        <section>
          <div className="mb-1.5 flex items-end justify-between px-4">
            <h2 className="text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Códigos de acesso</h2>
            <Button variant="ghost" size="sm" className="-mr-3" onClick={() => setCreating(true)}>
              Novo código
            </Button>
          </div>
          {codes.isPending ? (
            <Spinner />
          ) : codes.isError ? (
            <ErrorBox message={friendlyError(codes.error)} onRetry={() => codes.refetch()} />
          ) : codes.data.filter((c) => !c.code.startsWith('ADMIN-')).length === 0 ? (
            <Card className="text-center text-muted">Nenhum código ainda. Crie um e mande para quem vai testar.</Card>
          ) : (
            <List footer="Toque no código para copiar. O uso é contado no cadastro.">
              {codes.data.filter((c) => !c.code.startsWith('ADMIN-')).map((c) => (
                <Row
                  key={c.code}
                  title={
                    <button
                      type="button"
                      className="num inline-flex items-center gap-1.5 font-semibold tracking-wide"
                      onClick={async () => toast((await copyText(c.code)) ? 'Código copiado' : 'Não deu para copiar')}
                    >
                      {c.code} <Copy className="size-4 text-faint" aria-hidden />
                    </button>
                  }
                  subtitle={`${c.uses} de ${c.max_uses} usos${c.expires_at ? ` · até ${formatDateShort(c.expires_at.slice(0, 10))}` : ''}${c.note ? ` · ${c.note}` : ''}`}
                  trailing={
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Apagar ${c.code}`} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2" onClick={() => setRemoving(c)}>
                        <Trash2 className="size-[1.15rem]" strokeWidth={1.8} />
                      </button>
                      <Switch label={`Código ${c.code} ativo`} checked={c.active} onChange={(active) => actions.setCodeActive.mutate({ code: c.code, active }, { onError: fail })} />
                    </div>
                  }
                />
              ))}
            </List>
          )}
        </section>

        <section>
          <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Sugestões e problemas</h2>
          {feedback.isPending ? (
            <Spinner />
          ) : feedback.isError ? (
            <ErrorBox message={friendlyError(feedback.error)} onRetry={() => feedback.refetch()} />
          ) : feedback.data.length === 0 ? (
            <Card className="text-center text-muted">Nada por enquanto.</Card>
          ) : (
            <div className="flex flex-col gap-3">
              {feedback.data.map((f) => (
                <FeedbackCard key={f.id} item={f} onStatus={(status) => actions.setFeedbackStatus.mutate({ id: f.id, status }, { onError: fail })} />
              ))}
            </div>
          )}
        </section>
      </div>

      <NewCodeSheet open={creating} onClose={() => setCreating(false)} />
      <ConfirmSheet
        open={Boolean(removing)}
        title="Apagar código?"
        confirmLabel="Apagar"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) actions.deleteCode.mutate(removing.code, { onError: fail })
          setRemoving(null)
        }}
      >
        Quem já criou conta com <strong>{removing?.code}</strong> continua entrando normalmente.
      </ConfirmSheet>
    </>
  )
}

function FeedbackCard({ item, onStatus }: { item: AdminFeedback; onStatus: (s: 'lido' | 'resolvido') => void }) {
  const image = useFileUrl('feedback', item.screenshot_path)
  const tone = item.kind === 'problema' ? 'danger' : item.kind === 'elogio' ? 'coral' : 'primary'
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{KIND_LABEL[item.kind]}</Badge>
        <span className="text-[0.8125rem] text-muted">{formatDateShort(item.created_at.slice(0, 10))}</span>
      </div>
      <p className="mt-2.5 leading-snug whitespace-pre-wrap">{item.message}</p>
      {image.data && (
        <a href={image.data} target="_blank" rel="noreferrer" className="mt-3 block">
          <img src={image.data} alt="Print enviado" className="max-h-56 rounded-[0.75rem] border border-line" />
        </a>
      )}
      <p className="mt-3 text-[0.8125rem] leading-snug break-words text-muted">
        {item.sender_name || 'Sem nome'} · {item.sender_email ?? 'conta excluída'}
        <br />
        Versão {item.context.versao ?? '?'} · tela {item.context.tela ?? '?'} · instalado: {item.context.instalado ?? '?'}
      </p>
      <div className="mt-3 flex gap-2">
        {item.status === 'novo' && (
          <Button variant="secondary" size="sm" onClick={() => onStatus('lido')}>
            Marcar como lida
          </Button>
        )}
        {item.status !== 'resolvido' ? (
          <Button variant="soft" size="sm" onClick={() => onStatus('resolvido')}>
            Resolvida
          </Button>
        ) : (
          <Badge tone="ok">Resolvida</Badge>
        )}
      </div>
    </Card>
  )
}

function NewCodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { createCode } = useAdminActions()
  const [code, setCode] = useState(randomBetaCode)
  const [note, setNote] = useState('')
  const [uses, setUses] = useState('20')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const max = Number(uses)
    const normalized = code.trim().toUpperCase().replace(/\s/g, '')
    if (!/^[A-Z0-9-]{4,32}$/.test(normalized)) return setError('Use de 4 a 32 letras, números ou hífen.')
    if (!Number.isInteger(max) || max < 1 || max > 10000) return setError('Quantidade de usos: de 1 a 10.000.')
    setError(null)
    try {
      await createCode.mutateAsync({ code: normalized, note: note.trim() || null, max_uses: max })
      toast((await copyText(normalized)) ? 'Código criado e copiado' : 'Código criado')
      setCode(randomBetaCode())
      setNote('')
      onClose()
    } catch (err) {
      setError(/duplicate|already exists/i.test(String((err as Error).message)) ? 'Esse código já existe.' : friendlyError(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Novo código">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field label="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false} hint="Gerado ao acaso. Pode trocar por algo fácil, como AMIGOS-2026." />
        <Field label="Para quem (opcional)" placeholder="ex.: turma da faculdade" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
        <Field label="Quantas pessoas podem usar" inputMode="numeric" value={uses} onChange={(e) => setUses(e.target.value)} />
        <Button type="submit" loading={createCode.isPending}>
          Criar e copiar
        </Button>
      </form>
    </Sheet>
  )
}

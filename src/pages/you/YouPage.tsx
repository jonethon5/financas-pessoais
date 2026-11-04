import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { APP_VERSION } from '../../brand'
import { ProfileAvatar } from '../../components/Avatar'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BetaBadge, Button, ErrorBox, Field, List, NavBar, Row, Spinner, Switch } from '../../components/ui'
import { useProfile, useUpdateProfile } from '../../data/hooks'
import { centsToInput, formatBRL, parseBRL } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import type { AiTone, NotifyKind, Profile } from '../../types'

export const TONES: { value: AiTone; label: string; hint: string }[] = [
  { value: 'suave', label: 'Suave', hint: 'Dicas gentis, sem pressão. Comemora cada passo.' },
  { value: 'equilibrado', label: 'Equilibrado', hint: 'Direto ao ponto, com números e prazos realistas.' },
  { value: 'agressivo', label: 'Agressivo', hint: 'Sem rodeios: cortes fortes para chegar mais rápido nas metas.' },
]

export const NOTIFY: { kind: NotifyKind; label: string; hint: string }[] = [
  { kind: 'vencimentos', label: 'Contas a vencer', hint: 'Antes do vencimento e no dia' },
  { kind: 'pagamento', label: 'Lembrete do salário', hint: 'No dia do pagamento: separar o das caixinhas' },
  { kind: 'limite', label: 'Limite perto de estourar', hint: 'Quando uma categoria passa de 80%' },
  { kind: 'revisao', label: 'Revisão da semana', hint: 'Domingo, leva 2 minutos' },
  { kind: 'desejos', label: 'Lista de desejos', hint: 'Quando a espera de 30 dias termina' },
  { kind: 'metas', label: 'Marcos das caixinhas', hint: '25%, 50%, 75% e 100%' },
]

export const notifyOn = (p: Profile, kind: NotifyKind) => p.prefs.notify?.[kind] ?? true

const link = (to: string) => (content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
)

type SheetName = 'payday' | 'salary' | 'hours' | 'tone' | null

export function YouPage() {
  const profile = useProfile()
  const update = useUpdateProfile()
  const toast = useToast()
  const { email, mode, configured, signOut } = useAuth()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  if (profile.isPending) return <Spinner />
  if (profile.isError) return <ErrorBox message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />
  const p = profile.data
  const demoOnly = mode === 'demo' && !configured

  async function save(patch: Parameters<typeof update.mutateAsync>[0], message?: string) {
    try {
      await update.mutateAsync(patch)
      setSheet(null)
      if (message) toast(message)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <>
      <NavBar title="Você" />
      <div className="flex flex-col gap-7">
        <Link to="/voce/perfil" className="shadow-soft flex items-center gap-4 rounded-[1.25rem] bg-surface p-4 transition active:bg-surface-2">
          <ProfileAvatar profile={p} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.25rem] font-semibold">{p.name || 'Seu nome'}</p>
            <p className="truncate text-[0.9375rem] text-muted">{email}</p>
            <p className="mt-0.5 text-[0.875rem] font-medium text-primary">Editar perfil</p>
          </div>
          <ChevronRight className="size-5 text-faint" aria-hidden />
        </Link>

        <List header="Seu dinheiro" footer="O salário entra sozinho todo mês no dia do pagamento. As horas servem para mostrar quanto do seu trabalho cada compra custa.">
          <Row title="Dia do pagamento" trailing={p.payday ? `Dia ${p.payday}` : 'Definir'} chevron onClick={() => setSheet('payday')} />
          <Row title="Salário" trailing={p.salary_cents != null ? formatBRL(p.salary_cents) : 'Definir'} chevron onClick={() => setSheet('salary')} />
          <Row title="Horas de trabalho por semana" trailing={`${p.work_hours_week} h`} chevron onClick={() => setSheet('hours')} />
        </List>

        <List header="Assistente" footer="O assistente só dá dicas de orçamento e hábitos, nunca de investimento.">
          <Row title="Tom das dicas" trailing={TONES.find((t) => t.value === p.ai_tone)?.label} chevron onClick={() => setSheet('tone')} />
        </List>

        <List header="Avisos" footer="Escolha o que pode virar notificação no celular.">
          {NOTIFY.map((n) => (
            <Row
              key={n.kind}
              title={n.label}
              subtitle={n.hint}
              trailing={
                <Switch
                  label={n.label}
                  checked={notifyOn(p, n.kind)}
                  onChange={(on) => save({ prefs: { ...p.prefs, notify: { ...p.prefs.notify, [n.kind]: on } } })}
                />
              }
            />
          ))}
        </List>

        <List header={<>Beta <BetaBadge /></>} footer="Obrigado por testar! Toda sugestão é lida.">
          <Row title="Enviar sugestão ou relatar problema" chevron as={link('/voce/sugestao')} />
          <Row title="Termos de uso" chevron as={link('/termos')} />
          <Row title="Política de privacidade" chevron as={link('/privacidade')} />
          <Row title="Versão" trailing={APP_VERSION} />
        </List>

        {p.is_admin && (
          <List header="Administração">
            <Row title="Painel do beta" subtitle="Códigos de acesso e sugestões" chevron as={link('/voce/beta')} />
          </List>
        )}

        <List header="Conta">
          {mode === 'supabase' && <Row title="E-mail" trailing={<span className="max-w-[45vw] truncate text-muted">{email}</span>} chevron as={link('/voce/email')} />}
          {mode === 'supabase' && <Row title="Trocar senha" chevron as={link('/voce/senha')} />}
          {!demoOnly && <Row title={mode === 'demo' ? 'Sair da demonstração' : 'Sair'} onClick={() => setConfirmExit(true)} />}
        </List>

        <List>
          <Row title={mode === 'demo' ? 'Apagar dados da demonstração' : 'Excluir conta'} destructive as={link('/voce/excluir')} />
        </List>
      </div>

      <PaydaySheet open={sheet === 'payday'} value={p.payday} onClose={() => setSheet(null)} onSave={(payday) => save({ payday }, 'Dia do pagamento salvo')} />
      <SalarySheet open={sheet === 'salary'} value={p.salary_cents} onClose={() => setSheet(null)} onSave={(salary_cents) => save({ salary_cents }, 'Salário salvo')} />
      <HoursSheet open={sheet === 'hours'} value={p.work_hours_week} onClose={() => setSheet(null)} onSave={(work_hours_week) => save({ work_hours_week }, 'Horas salvas')} />
      <ToneSheet open={sheet === 'tone'} value={p.ai_tone} onClose={() => setSheet(null)} onSave={(ai_tone) => save({ ai_tone }, 'Tom das dicas salvo')} />
      <ConfirmSheet
        open={confirmExit}
        title={mode === 'demo' ? 'Sair da demonstração?' : 'Sair da conta?'}
        confirmLabel="Sair"
        onClose={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false)
          void signOut()
        }}
      >
        {mode === 'demo' ? 'Os dados de exemplo continuam neste aparelho.' : 'Seus dados continuam salvos na sua conta.'}
      </ConfirmSheet>
    </>
  )
}

export function PaydaySheet({ open, value, onClose, onSave }: { open: boolean; value: number | null; onClose: () => void; onSave: (day: number | null) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Dia do pagamento">
      <p className="mb-4 text-center text-[0.9375rem] text-muted">Em que dia o salário cai na sua conta?</p>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onSave(d)}
            aria-pressed={value === d}
            className={`num aspect-square rounded-full text-[1.0625rem] font-medium transition active:scale-95 ${value === d ? 'bg-primary text-white' : 'bg-surface text-ink'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-[0.8125rem] text-muted">Nos meses mais curtos, o dia 31 vira o último dia do mês.</p>
      {value != null && (
        <Button variant="ghost" size="md" className="mt-2 w-full" onClick={() => onSave(null)}>
          Não tenho dia fixo
        </Button>
      )}
    </Sheet>
  )
}

export function SalarySheet({ open, value, onClose, onSave }: { open: boolean; value: number | null; onClose: () => void; onSave: (cents: number | null) => void }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Salário">
      <form
        key={String(open)}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const raw = (e.currentTarget.elements.namedItem('salario') as HTMLInputElement).value
          if (!raw.trim()) return onSave(null)
          const cents = parseBRL(raw)
          if (cents == null) return setError('Digite um valor como 2.500,00')
          setError(null)
          onSave(cents)
        }}
      >
        <Field
          name="salario"
          label="Quanto entra por mês (líquido)"
          prefix="R$"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={centsToInput(value)}
          error={error}
          hint="O valor que cai na conta, já com os descontos. Rendas extras você lança à parte."
        />
        <Button type="submit">Salvar</Button>
      </form>
    </Sheet>
  )
}

function HoursSheet({ open, value, onClose, onSave }: { open: boolean; value: number; onClose: () => void; onSave: (hours: number) => void }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Horas por semana">
      <form
        key={String(open)}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number((e.currentTarget.elements.namedItem('horas') as HTMLInputElement).value)
          if (!Number.isInteger(n) || n < 1 || n > 100) return setError('Digite um número de 1 a 100.')
          setError(null)
          onSave(n)
        }}
      >
        <Field name="horas" label="Horas de trabalho por semana" inputMode="numeric" defaultValue={String(value)} error={error} hint="44 horas é a jornada padrão com carteira assinada." />
        <Button type="submit">Salvar</Button>
      </form>
    </Sheet>
  )
}

export function ToneSheet({ open, value, onClose, onSave }: { open: boolean; value: AiTone; onClose: () => void; onSave: (tone: AiTone) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Tom das dicas">
      <List>
        {TONES.map((t) => (
          <Row
            key={t.value}
            title={t.label}
            subtitle={<span className="whitespace-normal">{t.hint}</span>}
            onClick={() => onSave(t.value)}
            trailing={value === t.value ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhido" /> : null}
          />
        ))}
      </List>
    </Sheet>
  )
}

import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Bank, Bell, ChatCircleText, Coin, FileText, GearSix, Key, Moon, PiggyBank, Repeat, ShieldCheck, SignOut, Tag, Trash, UserCircle, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { MASCOT_NAME } from '../../brand'
import { ufInfo } from '../../lib/regions'
import { ChevronRight, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { APP_VERSION } from '../../brand'
import { ProfileAvatar } from '../../components/Avatar'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BackButton, BetaBadge, Button, ErrorBox, Field, List, NavBar, Row, Spinner, Switch } from '../../components/ui'
import { useProfile, useUpdateProfile } from '../../data/hooks'
import { getThemePref, setThemePref, type ThemePref } from '../../lib/theme'
import { PROFILE_INFO } from '../../lib/psych'
import { useWrite } from '../../data/finance'
import { currentYearMonth, isoDate, monthKey } from '../../lib/dates'
import { stableId } from '../../lib/recurring'
import { centsToInput, formatBRL, parseBRL } from '../../lib/money'
import { callFunction, friendlyError } from '../../lib/supabase'
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

type SheetName = 'payday' | 'salary' | 'hours' | 'tone' | 'theme' | null

const THEMES: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'claro', label: 'Claro', hint: 'Fundo claro, sempre' },
  { value: 'escuro', label: 'Escuro', hint: 'Fundo escuro, sempre' },
  { value: 'sistema', label: 'Igual ao celular', hint: 'Segue o modo claro ou escuro do aparelho' },
]

/** Ícone colorido da linha (como no app Ajustes do celular). */
function Ico({ icon: I, color }: { icon: PhosphorIcon; color: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[0.55rem] text-white" style={{ background: color }}>
      <I size={19} weight="fill" />
    </span>
  )
}

/** Ajustes: configurações do app, separadas do perfil. */
export function SettingsPage() {
  return <YouPage view="ajustes" />
}

/** Você: perfil (foto, salário, perfil com dinheiro). Os ajustes ficam em /ajustes. */
export function YouPage({ view = 'perfil' }: { view?: 'perfil' | 'ajustes' }) {
  const navigate = useNavigate()
  const profile = useProfile()
  const update = useUpdateProfile()
  const toast = useToast()
  const write = useWrite()
  const { userId } = useAuth()

  /** Salário ou dia do pagamento mudou: corrige o salário já lançado neste mês. */
  async function syncSalary(next: Profile) {
    if (!userId) return
    const ym = currentYearMonth()
    const id = await stableId(`salario:${userId}:${monthKey(ym)}`)
    await write.mutateAsync(async (b) => {
      if (next.salary_cents && next.payday) await b.update('transactions', id, { amount_cents: next.salary_cents, date: isoDate(ym, next.payday) })
      else await b.remove('transactions', [id])
    })
    // Com banco conectado: o salário que veio do extrato passa a contar como salário (sem duplicar)
    if (mode === 'supabase' && next.is_admin) await callFunction('bank-sync', { action: 'reconcile' }).catch(() => undefined)
  }
  const { email, mode, configured, signOut } = useAuth()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [theme, setTheme] = useState<ThemePref>(getThemePref)

  if (profile.isPending) return <Spinner />
  if (profile.isError) return <ErrorBox message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />
  const p = profile.data
  const demoOnly = mode === 'demo' && !configured

  async function save(patch: Parameters<typeof update.mutateAsync>[0], message?: string) {
    try {
      const next = await update.mutateAsync(patch)
      if ('salary_cents' in patch || 'payday' in patch) await syncSalary(next)
      setSheet(null)
      if (message) toast(message)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <>
      {view === 'perfil' ? (
        <NavBar
          title="Você"
          right={
            <Link to="/ajustes" aria-label="Ajustes" className="grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
              <GearSix size={24} />
            </Link>
          }
        />
      ) : (
        <NavBar title="Ajustes" left={<BackButton label="Voltar" onClick={() => navigate(-1)} />} />
      )}
      {view === 'perfil' ? (
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

          <List header="Sobre você" footer="Usado para adaptar as dicas, os exemplos e as metas. Dá para refazer quando quiser.">
            <Row title="Perfil com dinheiro" trailing={p.money_profile ? (PROFILE_INFO[p.money_profile as keyof typeof PROFILE_INFO]?.name ?? '—') : 'Fazer o teste'} chevron as={link('/boas-vindas')} />
            <Row title="Objetivo" trailing={<span className="max-w-[45vw] truncate text-muted">{p.about?.dream?.label ?? p.about?.goal ?? 'Definir'}</span>} chevron as={link('/boas-vindas')} />
            <Row title="Estado" trailing={ufInfo(p.about?.uf)?.name ?? 'Não informado'} chevron as={link('/boas-vindas')} />
          </List>

          <List>
            <Row icon={<Ico icon={PiggyBank} color="#E07C93" />} title={MASCOT_NAME} subtitle="Moedas, metas do dia e lojinha" chevron as={link('/porquinho')} />
            <Row icon={<Ico icon={GearSix} color="#5B6B7A" />} title="Ajustes" subtitle="Aparência, avisos, bancos, conta" chevron as={link('/ajustes')} />
          </List>

          {p.is_admin && (
            <List header="Administração">
              <Row title="Painel do beta" subtitle="Códigos de acesso e sugestões" chevron as={link('/voce/beta')} />
            </List>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <List header="Geral">
            <Row icon={<Ico icon={Moon} color="#3A4A5C" />} title="Aparência" trailing={THEMES.find((t) => t.value === theme)?.label} chevron onClick={() => setSheet('theme')} />
            <Row icon={<Ico icon={PiggyBank} color="#E07C93" />} title="Tom das dicas" subtitle={`O jeito do ${MASCOT_NAME} falar`} trailing={TONES.find((t) => t.value === p.ai_tone)?.label} chevron onClick={() => setSheet('tone')} />
          </List>

          <List header="Seu dinheiro">
            <Row icon={<Ico icon={Bank} color="#2F6FEB" />} title="Bancos conectados" subtitle="Seus gastos entram sozinhos" chevron as={link('/voce/bancos')} />
            <Row icon={<Ico icon={Repeat} color="#6E56F0" />} title="Gastos fixos" chevron as={link('/voce/fixos')} />
            <Row icon={<Ico icon={Tag} color="#0E9AA7" />} title="Categorias e limites" chevron as={link('/voce/categorias')} />
          </List>

          <List header="Avisos" footer="Escolha o que pode virar notificação no celular.">
            {NOTIFY.map((n) => (
              <Row
                key={n.kind}
                icon={<Ico icon={Bell} color="#E5484D" />}
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

          <List header="Conta">
            {mode === 'supabase' && <Row icon={<Ico icon={UserCircle} color="#2F6F8F" />} title="E-mail" trailing={<span className="max-w-[40vw] truncate text-muted">{email}</span>} chevron as={link('/voce/email')} />}
            {mode === 'supabase' && <Row icon={<Ico icon={Key} color="#8A5A06" />} title="Trocar senha" chevron as={link('/voce/senha')} />}
            {!demoOnly && <Row icon={<Ico icon={SignOut} color="#5B6B7A" />} title={mode === 'demo' ? 'Sair da demonstração' : 'Sair'} onClick={() => setConfirmExit(true)} />}
          </List>

          <List header={<>Beta <BetaBadge /></>} footer="Obrigado por testar! Toda sugestão é lida.">
            <Row icon={<Ico icon={ChatCircleText} color="#0F9D6B" />} title="Enviar sugestão ou relatar problema" chevron as={link('/voce/sugestao')} />
            <Row icon={<Ico icon={FileText} color="#5B6B7A" />} title="Termos de uso" chevron as={link('/termos')} />
            <Row icon={<Ico icon={ShieldCheck} color="#5B6B7A" />} title="Política de privacidade" chevron as={link('/privacidade')} />
            <Row icon={<Ico icon={Coin} color="#F2A516" />} title="Versão" trailing={APP_VERSION} />
          </List>

          <List>
            <Row icon={<Ico icon={Trash} color="#E5484D" />} title={mode === 'demo' ? 'Apagar dados da demonstração' : 'Excluir conta'} destructive as={link('/voce/excluir')} />
          </List>
        </div>
      )}

      <PaydaySheet open={sheet === 'payday'} value={p.payday} onClose={() => setSheet(null)} onSave={(payday) => save({ payday }, 'Dia do pagamento salvo')} />
      <SalarySheet open={sheet === 'salary'} value={p.salary_cents} onClose={() => setSheet(null)} onSave={(salary_cents) => save({ salary_cents }, 'Salário salvo')} />
      <HoursSheet open={sheet === 'hours'} value={p.work_hours_week} onClose={() => setSheet(null)} onSave={(work_hours_week) => save({ work_hours_week }, 'Horas salvas')} />
      <ToneSheet open={sheet === 'tone'} value={p.ai_tone} onClose={() => setSheet(null)} onSave={(ai_tone) => save({ ai_tone }, 'Tom das dicas salvo')} />
      <Sheet open={sheet === 'theme'} onClose={() => setSheet(null)} title="Tema">
        <List footer="Vale só para este aparelho.">
          {THEMES.map((t) => (
            <Row
              key={t.value}
              title={t.label}
              subtitle={t.hint}
              onClick={() => {
                setThemePref(t.value)
                setTheme(t.value)
              }}
              trailing={theme === t.value ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhido" /> : null}
            />
          ))}
        </List>
      </Sheet>
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
            className={`num aspect-square rounded-full text-[1.0625rem] font-medium transition active:scale-95 ${value === d ? 'bg-primary text-on-primary' : 'bg-surface text-ink'}`}
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

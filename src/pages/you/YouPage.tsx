import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowCounterClockwise, Bank, Bell, ChatCircleText, Sparkle, Coin, EyeSlash, FileText, GearSix, Info, Key, Moon, PaintBrush, PiggyBank, Repeat, ShieldCheck, SignOut, Tag, TextAa, Trash, UserCircle, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { Pig, mascotName } from '../../components/Pig'
import { toggleHidden, useHiddenValues } from '../../lib/privacy'
import { resetTours } from '../../components/Tour'
import { ChevronRight, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { APP_NAME, APP_VERSION } from '../../brand'
import { ProfileAvatar } from '../../components/Avatar'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BackButton, BetaBadge, Button, Chip, ErrorBox, Field, List, NavBar, Row, Spinner, Switch } from '../../components/ui'
import { PushCard } from '../../components/PushCard'
import { useProfile, useUpdateProfile } from '../../data/hooks'
import { FONTS, getFontPref, getThemePref, setFontPref, setThemePref, type FontPref, type ThemePref } from '../../lib/theme'
import { useTable, useWrite } from '../../data/finance'
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

// O que vira aviso no celular (o servidor manda: supabase/functions/notify). Limite por categoria ainda não sai
// como aviso: a conta do limite depende do mês da fatura do cartão, que só o app calcula.
export const NOTIFY: { kind: NotifyKind; label: string; hint: string }[] = [
  { kind: 'lembrete', label: 'Lembrete do dia', hint: 'O porquinho chama se você não abriu o app' },
  { kind: 'vencimentos', label: 'Contas a vencer', hint: 'Antes do vencimento, no dia e se atrasar' },
  { kind: 'pagamento', label: 'Dia do salário', hint: 'Lembra de separar o das caixinhas' },
  { kind: 'desejos', label: 'Lista de desejos', hint: 'Quando a espera de 30 dias termina' },
  { kind: 'metas', label: 'Marcos das caixinhas', hint: '25%, 50%, 75% e 100%' },
  { kind: 'revisao', label: 'Revisão da semana', hint: 'Domingo à noite, leva 2 minutos' },
]

/** Horários do lembrete da noite */
const HOURS = [18, 19, 20, 21, 22]

export const notifyOn = (p: Profile, kind: NotifyKind) => p.prefs.notify?.[kind] ?? true

const link = (to: string) => (content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
)

type SheetName = 'payday' | 'salary' | 'hours' | 'tone' | 'theme' | 'font' | null

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

/** Ajustes: configurações do app, separadas do perfil. Cada grupo abre a sua tela (/ajustes/:secao). */
export function SettingsPage() {
  const { secao } = useParams()
  return <YouPage section={secao} />
}

const SECTIONS: Record<string, string> = {
  aparencia: 'Aparência',
  dicas: 'Porquinho e dicas',
  avisos: 'Notificações',
  dinheiro: 'Seu dinheiro',
  conta: 'Conta e segurança',
  privacidade: 'Privacidade',
  sobre: 'Sobre o app',
}

/** Você: perfil, salário e todos os ajustes numa tela só (/ajustes sem seção abre esta mesma tela). */
export function YouPage({ section }: { section?: string }) {
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
    if (mode === 'supabase') await callFunction('bank-sync', { action: 'reconcile' }).catch(() => undefined)
  }
  const { email, mode, configured, signOut } = useAuth()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  // Quem paga o salário (o app aprendeu quando a pessoa tocou em "É o meu salário")
  const rules = useTable('category_rules')
  const payers = (rules.data ?? []).filter((r) => r.pattern.startsWith('salario:'))
  const [removePayer, setRemovePayer] = useState<{ id: string; name: string } | null>(null)
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [font, setFont] = useState<FontPref>(getFontPref)
  const hidden = useHiddenValues()

  if (profile.isPending) return <Spinner />
  if (profile.isError) return <ErrorBox message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />
  const p = profile.data
  const demoOnly = mode === 'demo' && !configured

  /** "Recomeçar gastos": apaga os gastos fixos e o que foi lançado à mão, para a pessoa montar de novo. */
  async function restartSpending() {
    try {
      let removed = 0
      await write.mutateAsync(async (b) => {
        const txs = await b.list('transactions')
        const manual = txs.filter((t) => t.source !== 'banco' && t.type !== 'salario').map((t) => t.id)
        // fixo que o banco já confirmou (pago): continua como o gasto que aconteceu, sem o vínculo com o fixo
        const linked = txs.filter((t) => t.source === 'banco' && t.type === 'fixo')
        for (const t of linked) await b.update('transactions', t.id, { type: 'dia', recurring_id: null })
        for (let i = 0; i < manual.length; i += 100) await b.remove('transactions', manual.slice(i, i + 100))
        const recs = await b.list('recurrings')
        if (recs.length) await b.remove('recurrings', recs.map((r) => r.id))
        removed = manual.length + recs.length
      })
      toast(removed ? 'Pronto: gastos fixos e lançamentos à mão apagados. Pode montar de novo.' : 'Não tinha nada para apagar')
    } catch (err) {
      toast(friendlyError(err))
    }
  }

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
      {!section ? (
        <NavBar title="Você" />
      ) : (
        <NavBar title={SECTIONS[section] ?? 'Ajustes'} left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
      )}
      {!section ? (
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

          <List header="Seu dinheiro" footer="O salário entra sozinho todo mês no dia do pagamento.">
            <Row title="Salário" trailing={p.salary_cents != null ? formatBRL(p.salary_cents) : 'Definir'} chevron onClick={() => setSheet('salary')} />
            <Row title="Dia do pagamento" trailing={p.payday ? `Dia ${p.payday}` : 'Definir'} chevron onClick={() => setSheet('payday')} />
            {payers.map((r) => {
              const name = r.pattern.slice('salario:'.length).replace(/(^|\s)\S/g, (c) => c.toUpperCase())
              return <Row key={r.id} title="Quem paga seu salário" subtitle="Pix daqui perto do dia do pagamento entram como salário" trailing={name} chevron onClick={() => setRemovePayer({ id: r.id, name })} />
            })}
            <Row title="Horas de trabalho por semana" trailing={`${p.work_hours_week} h`} chevron onClick={() => setSheet('hours')} />
            <Row title="Bancos e cartões" chevron as={link('/voce/bancos')} />
            <Row title="Gastos fixos" chevron as={link('/voce/fixos')} />
            <Row title="Categorias e limites" chevron as={link('/voce/categorias')} />
            <Row title={<span className="text-danger-strong">Recomeçar gastos</span>} subtitle="Apaga os gastos fixos e o que você lançou à mão" onClick={() => setConfirmRestart(true)} />
          </List>

          <List header="Ajustes">
            <Row icon={<Ico icon={PaintBrush} color="#3A4A5C" />} title="Aparência" subtitle={`${THEMES.find((t) => t.value === theme)?.label} · ${FONTS.find((f) => f.value === font)?.label}`} chevron as={link('/ajustes/aparencia')} />
            <Row icon={<Ico icon={PiggyBank} color="#E07C93" />} title={`${mascotName(p.prefs.pig?.color)} e dicas`} subtitle={`Modo ${TONES.find((t) => t.value === p.ai_tone)?.label.toLowerCase()}`} chevron as={link('/ajustes/dicas')} />
            <Row icon={<Ico icon={Bell} color="#E5484D" />} title="Notificações" subtitle={`${NOTIFY.filter((n) => notifyOn(p, n.kind)).length} de ${NOTIFY.length} ligadas`} chevron as={link('/ajustes/avisos')} />
            <Row icon={<Ico icon={ShieldCheck} color="#2F6F8F" />} title="Conta e segurança" subtitle={mode === 'demo' ? 'Demonstração' : 'E-mail, senha e sair'} chevron as={link('/ajustes/conta')} />
            <Row icon={<Ico icon={EyeSlash} color="#5B6B7A" />} title="Privacidade" subtitle="Esconder valores, seus dados" chevron as={link('/ajustes/privacidade')} />
          </List>

          <List>
            <Row icon={<Ico icon={ChatCircleText} color="#6E56F0" />} title="Ajuda e sugestões" chevron as={link('/voce/sugestao')} />
            <Row icon={<Ico icon={Sparkle} color="#0E9AA7" />} title="Ver o guia do app de novo" onClick={() => { resetTours(); toast('Guia ligado de novo'); navigate('/') }} />
            <Row title="Perfil com dinheiro e objetivo" subtitle="Refazer as perguntas do começo" chevron as={link('/boas-vindas')} />
            <Row icon={<Ico icon={Info} color="#F2A516" />} title={`Sobre o ${APP_NAME}`} trailing={APP_VERSION} chevron as={link('/ajustes/sobre')} />
          </List>

          {p.is_admin && (
            <List header="Administração">
              <Row icon={<Ico icon={GearSix} color="#0F2433" />} title="Painel do beta" subtitle="Códigos de acesso e sugestões" chevron as={link('/voce/beta')} />
            </List>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {section === 'aparencia' && (
            <>
              <List header="Tema" footer="Vale só para este aparelho.">
                {THEMES.map((t) => (
                  <Row key={t.value} icon={<Ico icon={Moon} color="#3A4A5C" />} title={t.label} subtitle={t.hint} onClick={() => { setThemePref(t.value); setTheme(t.value) }} trailing={theme === t.value ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhido" /> : null} />
                ))}
              </List>
              <List header="Fonte (em teste)" footer="Escolha a que achar mais bonita: estamos decidindo a fonte definitiva do app.">
                {FONTS.map((f) => (
                  <Row
                    key={f.value}
                    icon={<Ico icon={TextAa} color="#6E56F0" />}
                    title={<span style={{ fontFamily: `'${f.family}'` }}>{f.label}</span>}
                    subtitle={<span style={{ fontFamily: `'${f.family}'` }}>{f.hint}</span>}
                    onClick={() => { setFontPref(f.value); setFont(f.value) }}
                    trailing={font === f.value ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhida" /> : null}
                  />
                ))}
              </List>
            </>
          )}
          {section === 'dicas' && (
            <>
            <List header="Seu mascote">
              {(['azul', 'rosa'] as const).map((c) => (
                <Row key={c} icon={<Pig art="rosto-feliz" color={c} px={40} still />} title={c === 'rosa' ? 'Porquinha' : 'Porquinho'} subtitle={mascotName(c)} onClick={() => save({ prefs: { ...p.prefs, pig: { ...p.prefs.pig, color: c } } }, 'Mascote trocado')} trailing={(p.prefs.pig?.color ?? 'azul') === c ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhido" /> : null} />
              ))}
            </List>
            <List header="Modo do mascote" footer="Muda a roupa e o jeito do porquinho falar. As dicas são de orçamento e hábitos, nunca de investimento.">
              {TONES.map((t) => (
                <Row key={t.value} icon={<Pig tone={t.value} mood="normal" px={44} still />} title={t.label} subtitle={t.hint} onClick={() => save({ ai_tone: t.value }, 'Modo salvo')} trailing={p.ai_tone === t.value ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-label="Escolhido" /> : null} />
              ))}
            </List>
            </>
          )}
          {section === 'avisos' && (
            <div className="flex flex-col gap-5">
              <PushCard onEnabled={() => save({ prefs: { ...p.prefs, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } })} />
              <section>
                <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Horário do lembrete</h2>
                <div className="flex flex-wrap gap-2 px-1" role="radiogroup" aria-label="Horário do lembrete">
                  {HOURS.map((h) => (
                    <Chip key={h} selected={(p.prefs.notify_hour ?? 20) === h} onClick={() => save({ prefs: { ...p.prefs, notify_hour: h } }, `Lembrete às ${h}h`)}>
                      {h}h
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 px-4 text-[0.8125rem] leading-snug text-muted">À noite: o lembrete do dia, marcos das caixinhas e a revisão de domingo. Contas e salário chegam de manhã, a partir das 9h.</p>
              </section>
              <List footer={`Escolha o que pode virar aviso. Quem fala é o ${mascotName(p.prefs.pig?.color)}, no modo que você escolheu em Porquinho e dicas.`}>
                {NOTIFY.map((n) => (
                  <Row key={n.kind} title={n.label} subtitle={n.hint} trailing={<Switch label={n.label} checked={notifyOn(p, n.kind)} onChange={(on) => save({ prefs: { ...p.prefs, notify: { ...p.prefs.notify, [n.kind]: on } } })} />} />
                ))}
              </List>
            </div>
          )}
          {section === 'dinheiro' && (
            <>
              <List>
                <Row icon={<Ico icon={Bank} color="#2F6FEB" />} title="Bancos conectados" subtitle="Seus gastos entram sozinhos" chevron as={link('/voce/bancos')} />
                <Row icon={<Ico icon={Repeat} color="#6E56F0" />} title="Gastos fixos" subtitle="Aluguel, luz, internet…" chevron as={link('/voce/fixos')} />
                <Row icon={<Ico icon={Tag} color="#0E9AA7" />} title="Categorias e limites" chevron as={link('/voce/categorias')} />
              </List>
              <List footer="Salário, dia do pagamento e horas de trabalho ficam no seu perfil.">
                <Row icon={<Ico icon={UserCircle} color="#2F6F8F" />} title="Salário e pagamento" trailing={p.salary_cents != null ? formatBRL(p.salary_cents) : 'Definir'} chevron as={link('/voce')} />
              </List>
            </>
          )}
          {section === 'conta' && (
            <>
              <List>
                {mode === 'supabase' && <Row icon={<Ico icon={UserCircle} color="#2F6F8F" />} title="E-mail" trailing={<span className="max-w-[40vw] truncate text-muted">{email}</span>} chevron as={link('/voce/email')} />}
                {mode === 'supabase' && <Row icon={<Ico icon={Key} color="#8A5A06" />} title="Trocar senha" chevron as={link('/voce/senha')} />}
                <Row icon={<Ico icon={ArrowCounterClockwise} color="#0F9D6B" />} title="Refazer o primeiro acesso" subtitle="Mascote, objetivo, modo e salário" chevron as={link('/boas-vindas')} />
                {!demoOnly && <Row icon={<Ico icon={SignOut} color="#5B6B7A" />} title={mode === 'demo' ? 'Sair da demonstração' : 'Sair'} onClick={() => setConfirmExit(true)} />}
                {mode === 'demo' && demoOnly && <Row title="Você está na demonstração" subtitle="Os dados ficam só neste aparelho" />}
              </List>
              <List>
                <Row icon={<Ico icon={Trash} color="#E5484D" />} title={mode === 'demo' ? 'Começar a demonstração do zero' : 'Excluir conta'} subtitle={mode === 'demo' ? 'Apaga tudo e volta para o primeiro acesso' : undefined} destructive as={link('/voce/excluir')} />
              </List>
            </>
          )}
          {section === 'privacidade' && (
            <>
              <List footer="Também dá para tocar no olho da tela inicial.">
                <Row icon={<Ico icon={EyeSlash} color="#5B6B7A" />} title="Esconder valores" subtitle="Mostra R$ •••• no lugar dos números" trailing={<Switch label="Esconder valores" checked={hidden} onChange={() => toggleHidden()} />} />
              </List>
              <List>
                <Row icon={<Ico icon={ShieldCheck} color="#2F6F8F" />} title="Política de privacidade" chevron as={link('/privacidade')} />
                <Row icon={<Ico icon={FileText} color="#5B6B7A" />} title="Termos de uso" chevron as={link('/termos')} />
              </List>
            </>
          )}
          {section === 'sobre' && (
            <List header={<>Beta <BetaBadge /></>} footer="Obrigado por testar! Toda sugestão é lida.">
              <Row icon={<Ico icon={Coin} color="#F2A516" />} title="Versão" trailing={APP_VERSION} />
              <Row icon={<Ico icon={ChatCircleText} color="#0F9D6B" />} title="Enviar sugestão ou relatar problema" chevron as={link('/voce/sugestao')} />
            </List>
          )}
          {!SECTIONS[section] && <Row title="Essa página não existe." />}
        </div>
      )}

      <ConfirmSheet
        open={removePayer != null}
        title="Parar de contar como salário?"
        confirmLabel="Parar"
        destructive
        onClose={() => setRemovePayer(null)}
        onConfirm={async () => {
          const r = removePayer
          setRemovePayer(null)
          if (!r) return
          try {
            await write.mutateAsync((b) => b.remove('category_rules', [r.id]))
            toast(`${r.name} não conta mais como salário automaticamente`)
          } catch (err) {
            toast(friendlyError(err))
          }
        }}
      >
        {removePayer ? `Os próximos Pix de ${removePayer.name} voltam a perguntar "O que é esse dinheiro?". O que já entrou como salário continua.` : ''}
      </ConfirmSheet>
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
        open={confirmRestart}
        title="Recomeçar os gastos?"
        confirmLabel="Apagar e recomeçar"
        destructive
        onClose={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false)
          void restartSpending()
        }}
      >
        Apaga <strong>todos os gastos fixos</strong> e <strong>tudo que você lançou à mão</strong> (este e outros meses). Ficam: o que veio do banco, o salário, as caixinhas e as categorias. <strong>Não dá para desfazer.</strong>
      </ConfirmSheet>
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

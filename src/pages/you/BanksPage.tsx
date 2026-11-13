import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Info, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '../../auth/AuthProvider'
import { BankLogo } from '../../components/BankLogo'
import { Pig } from '../../components/Pig'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BackButton, Badge, Button, Card, ErrorBox, Field, List, Money, NavBar, Notice, Row, Spinner } from '../../components/ui'
import { connectDemoBank, disconnectDemoBank } from '../../data/demoBank'
import { useTable, useWrite } from '../../data/finance'
import { formatDateShort } from '../../lib/dates'
import { ALL_BANKS, POPULAR_BANKS, accountTitle, findInstitution, searchBanks, type Institution } from '../../lib/institutions'
import { callFunction, friendlyError } from '../../lib/supabase'
import type { BankAccount } from '../../types'

const ago = (iso: string | null) => {
  if (!iso) return 'ainda não atualizou'
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (min < 2) return 'atualizado agora'
  if (min < 60) return `atualizado há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `atualizado há ${h} h` : `atualizado em ${formatDateShort(iso.slice(0, 10))}`
}

/** Linha de uma conta: saldo da conta corrente ou fatura do cartão. */
export function AccountRow({ a, label, to }: { a: BankAccount; label?: string; to?: string }) {
  const credit = a.type === 'CREDIT'
  const inst = findInstitution(a.name, label)
  return (
    <Row
      icon={<BankLogo inst={inst} credit={credit} size="sm" />}
      title={accountTitle(inst, a.type, a.name)}
      subtitle={credit ? `Fatura atual${a.due_date ? ` · vence ${formatDateShort(a.due_date)}` : ''}${a.available_cents != null ? ` · limite livre ${formatBRLShort(a.available_cents)}` : ''}` : a.type === 'INVESTMENT' ? 'Guardado ou investido' : `Saldo na conta${a.overdraft_used_cents ? ` · cheque especial usado ${formatBRLShort(a.overdraft_used_cents)}` : ''}`}
      trailing={a.balance_cents != null ? <Money cents={a.balance_cents} className="text-[1.0625rem] font-semibold" /> : <span className="text-muted">—</span>}
      chevron={Boolean(to)}
      as={
        to
          ? (content, className) => (
              <Link to={to} className={className}>
                {content}
              </Link>
            )
          : undefined
      }
    />
  )
}
const formatBRLShort = (c: number) => `R$ ${Math.round(c / 100).toLocaleString('pt-BR')}`

/** Cartão do Open Finance: o porquinho no meio e os bancos girando em volta. */
function OpenFinanceHero({ onAdd, compact = false }: { onAdd: () => void; compact?: boolean }) {
  const banks = POPULAR_BANKS.slice(0, 8)
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-line bg-bg p-5 text-center">
      {!compact && (
        <div className="relative mx-auto mt-2 mb-6 size-56" aria-hidden>
          {/* órbita */}
          <div className="absolute inset-3 rounded-full border border-dashed border-line" />
          <div className="orbit absolute inset-0">
            {banks.map((b, i) => {
              const a = (i / banks.length) * Math.PI * 2
              return (
                <span key={b.key} className="absolute" style={{ left: `calc(50% + ${Math.cos(a) * 46}% - 1.25rem)`, top: `calc(50% + ${Math.sin(a) * 46}% - 1.25rem)` }}>
                  <span className="orbit-counter block">
                    <BankLogo inst={b} size="sm" />
                  </span>
                </span>
              )
            })}
          </div>
          <div className="absolute top-1/2 left-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-[0_12px_30px_-14px_rgb(15_36_51/0.45)]">
            <Pig art="principal" px={92} still />
          </div>
        </div>
      )}
      <p className="text-[1.75rem] leading-tight tracking-tight">
        <span className="font-extrabold">open</span>
        <span className="font-light">finance</span>
      </p>
      <p className="mx-auto mt-2 max-w-xs text-[0.9375rem] leading-snug text-muted">
        Conecte seu banco e seus cartões para os gastos entrarem sozinhos. É só leitura: o app vê saldos e lançamentos, mas não mexe no seu dinheiro.
      </p>
      <button type="button" onClick={onAdd} className="press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[1.0625rem] font-bold text-on-primary">
        <span className="text-[1.25rem] leading-none">+</span> Adicionar conexão
      </button>
      <div className="mt-4 flex gap-2.5 rounded-[1rem] bg-surface p-3.5 text-left text-[0.875rem] leading-snug text-muted">
        <Info size={20} className="mt-0.5 shrink-0" />
        <p>
          Entram os lançamentos de <strong className="text-ink">contas e cartões de crédito</strong>, já com categoria. Se corrigir uma categoria, o app aprende e acerta os próximos. Regulado pelo Banco Central.
        </p>
      </div>
    </section>
  )
}

/** Busca pelo nome e lista com todos os bancos do Open Finance; sem busca, os mais usados vêm primeiro. */
function BankPicker({ onPick }: { onPick: (inst: Institution) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const results = q ? searchBanks(q) : ALL_BANKS
  const item = (inst: Institution) => (
    <button key={inst.key} type="button" onClick={() => onPick(inst)} className="press flex w-full items-center gap-3 rounded-[1rem] bg-surface p-2.5 text-left">
      <BankLogo inst={inst} />
      <span className="min-w-0 flex-1 truncate leading-tight font-semibold">{inst.name}</span>
    </button>
  )
  return (
    <div className="flex flex-col gap-3">
      <label className="shadow-soft flex items-center gap-2.5 rounded-full bg-surface px-4 py-3">
        <MagnifyingGlass size={20} className="shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar banco (ex.: Neon, Caixa)"
          aria-label="Buscar banco pelo nome"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[1rem] outline-none placeholder:text-muted"
        />
      </label>
      {!q && (
        <>
          <p className="px-1 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Mais usados</p>
          <div className="grid grid-cols-2 gap-2">{POPULAR_BANKS.map(item)}</div>
          <p className="px-1 pt-1 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Todos os bancos ({ALL_BANKS.length})</p>
        </>
      )}
      <div className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
        {results.map(item)}
        {q && (
          <button type="button" onClick={() => onPick({ key: 'outro', name: q.slice(0, 40), color: '#5B6B7A', logo: '' })} className="press flex w-full items-center gap-3 rounded-[1rem] border border-dashed border-line p-2.5 text-left">
            <BankLogo inst={null} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-semibold">Usar “{q}”</span>
              <span className="block text-[0.8125rem] text-muted">{results.length ? 'Não é nenhum dos de cima' : 'Não achei esse nome na lista'}</span>
            </span>
          </button>
        )}
      </div>
      <p className="text-[0.8125rem] leading-snug text-muted">A conexão é pelo Open Finance: só leitura, o app não consegue mexer no seu dinheiro.</p>
    </div>
  )
}

/** Demonstração: simula a autorização no app do banco e cria dados de exemplo. */
function DemoConnect({ inst, onDone }: { inst: Institution; onDone: () => void }) {
  const write = useWrite()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const STEPS = [`Abrindo o ${inst.name}…`, 'Autorizando só leitura (Open Finance)…', 'Buscando saldo, cartão e lançamentos…']
  useEffect(() => {
    let alive = true
    const t1 = setTimeout(() => alive && setStep(1), 700)
    const t2 = setTimeout(() => alive && setStep(2), 1400)
    const t3 = setTimeout(async () => {
      try {
        const r = await write.mutateAsync((b) => connectDemoBank(b, inst))
        toast(`${inst.name} conectado: ${(r as { imported: number }).imported} lançamentos de exemplo`)
      } catch (err) {
        toast(friendlyError(err))
      }
      if (alive) onDone()
    }, 2100)
    return () => {
      alive = false
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <BankLogo inst={inst} />
      <ul className="flex w-full flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 transition-opacity ${i <= step ? 'opacity-100' : 'opacity-35'}`}>
            {i < step ? <CheckCircle size={24} weight="fill" className="shrink-0 text-grow" /> : <span className={`size-6 shrink-0 rounded-full border-2 ${i === step ? 'animate-pulse border-primary' : 'border-line'}`} />}
            <span className="leading-snug">{s}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-[0.8125rem] text-muted">Demonstração: nada é conectado de verdade, os dados são de exemplo.</p>
    </div>
  )
}

/** Você › Bancos conectados (Open Finance via Meu Pluggy, só leitura). */
export function BanksPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const write = useWrite()
  const { mode } = useAuth()
  const demo = mode === 'demo'
  const conns = useTable('bank_connections')
  const accounts = useTable('bank_accounts')
  const status = useQuery({
    queryKey: ['bank-status'],
    queryFn: () => callFunction<{ configured: boolean; allowed: boolean }>('bank-sync', { action: 'status' }),
    enabled: mode === 'supabase',
    retry: false,
  })
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Institution | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  async function syncNow() {
    if (demo) return toast('Na demonstração, os dados de exemplo não mudam.')
    setSyncing(true)
    try {
      const r = await callFunction<{ imported: number; matched: number; errors: string[] }>('bank-sync', { action: 'sync', force: true })
      await qc.invalidateQueries({ queryKey: ['t'] })
      toast(r.errors.length ? r.errors[0] : r.imported + r.matched ? `${r.imported} lançamentos novos, ${r.matched} contas conferidas` : 'Tudo em dia')
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setSyncing(false)
    }
  }

  const closeAdd = () => {
    setAdding(false)
    setPicked(null)
  }
  const header = <NavBar title="Bancos" left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />

  if ((!demo && status.isPending) || conns.isPending) return <Spinner />
  if (!demo && status.isError) return (
    <>
      {header}
      <ErrorBox message={friendlyError(status.error)} onRetry={() => status.refetch()} />
    </>
  )
  const configured = demo || status.data!.configured
  const allowed = demo || status.data!.allowed

  return (
    <>
      {header}
      <div className="stagger flex flex-col gap-6">
        {(conns.data ?? []).length > 0 && (
          <Card className="flex gap-3.5">
            <ShieldCheck size={34} weight="duotone" className="shrink-0 text-primary" />
            <p className="leading-snug text-muted">
              Conexão pelo <strong className="text-ink">Open Finance</strong>, regulado pelo Banco Central. É <strong className="text-ink">só leitura</strong>: o app vê saldos e lançamentos, mas não consegue mover dinheiro. Os dados do banco atualizam uma vez por dia.
            </p>
          </Card>
        )}
        {demo && <Notice tone="primary">Demonstração: escolha um banco para ver como o app fica com ele conectado. Os dados são de exemplo.</Notice>}

        {!configured ? (
          <Notice tone="warn">A conexão ainda não foi ligada: faltam as chaves da Pluggy (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET) nos secrets. O passo a passo está no README.</Notice>
        ) : !allowed ? (
          <Notice>No beta, a conexão com o banco está liberada só para quem recebeu um convite com banco. Em breve para todos.</Notice>
        ) : (
          <>
            {(conns.data ?? []).length === 0 ? (
              <OpenFinanceHero onAdd={() => setAdding(true)} />
            ) : (
              <>
                {(conns.data ?? []).map((c) => (
                  <List
                    key={c.id}
                    header={c.label}
                    footer={
                      <span className="flex items-center justify-between gap-2">
                        <span>{c.status === 'ok' ? ago(c.last_sync_at) : c.last_error}</span>
                        <button type="button" className="font-semibold text-danger-strong" onClick={() => setRemoving(c.id)}>
                          Desconectar
                        </button>
                      </span>
                    }
                  >
                    {c.status !== 'ok' && <Row title={<Badge tone="warn">{c.status === 'expirado' ? 'Autorização vencida' : 'Não atualizou'}</Badge>} />}
                    {(accounts.data ?? []).filter((a) => a.connection_id === c.id).map((a) => (
                      <AccountRow key={a.id} a={a} label={c.label} to={a.type === 'INVESTMENT' ? undefined : `/voce/bancos/${a.id}`} />
                    ))}
                  </List>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="md" loading={syncing} onClick={syncNow}>
                    Atualizar agora
                  </Button>
                  <Button variant="soft" size="md" onClick={() => setAdding(true)}>
                    Conectar outro
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={adding} onClose={closeAdd} title={picked ? `Conectar ${picked.name}` : 'Conectar banco'}>
        {adding && !picked && <BankPicker onPick={setPicked} />}
        {adding && picked && (demo ? <DemoConnect inst={picked} onDone={closeAdd} /> : <ConnectForm inst={picked} onDone={closeAdd} />)}
      </Sheet>
      <ConfirmSheet
        open={Boolean(removing)}
        title="Desconectar este banco?"
        confirmLabel="Desconectar"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const id = removing
          setRemoving(null)
          if (id) write.mutate((b) => (demo ? disconnectDemoBank(b, id) : b.remove('bank_connections', [id])))
        }}
      >
        Os lançamentos que já vieram continuam no app.{demo ? '' : ' Para cortar o acesso de vez, revogue também no Meu Pluggy.'}
      </ConfirmSheet>
    </>
  )
}

function ConnectForm({ inst, onDone }: { inst: Institution; onDone: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [label, setLabel] = useState(inst.name)
  const [itemId, setItemId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<string | null>(null)

  /** Liga a conexão no app. Logo depois de autorizar, o Meu Pluggy ainda pode estar buscando: tenta de novo por até 1 minuto. */
  async function connect(id: string) {
    setError(null)
    setLoading(true)
    try {
      for (let tryNo = 0; ; tryNo++) {
        try {
          setStep(tryNo ? 'O Meu Pluggy ainda está buscando os dados do banco…' : 'Buscando contas e lançamentos…')
          const r = await callFunction<{ imported: number; matched: number; accounts: number }>('bank-sync', { action: 'connect', itemId: id, label })
          await qc.invalidateQueries({ queryKey: ['t'] })
          toast(`${label} conectado: ${r.accounts} ${r.accounts === 1 ? 'conta' : 'contas'}, ${r.imported} lançamentos`)
          onDone()
          return
        } catch (err) {
          if (tryNo < 6 && /ainda está buscando/.test(friendlyError(err))) {
            await new Promise((ok) => setTimeout(ok, 10_000))
            continue
          }
          throw err
        }
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
      setStep(null)
    }
  }

  /** Abre a janela da Pluggy: a pessoa entra com a conta dela do Meu Pluggy e escolhe os bancos. */
  async function openPluggy() {
    setError(null)
    setLoading(true)
    setStep('Abrindo a Pluggy…')
    try {
      const [{ accessToken, connectorId }, { PluggyConnect }] = await Promise.all([
        callFunction<{ accessToken: string; connectorId: number }>('bank-sync', { action: 'connect_token' }),
        import('pluggy-connect-sdk'),
      ])
      let created: string | null = null
      const widget = new PluggyConnect({
        connectToken: accessToken,
        connectorIds: [connectorId],
        language: 'pt',
        onSuccess: (data: { item: { id: string } }) => {
          created = data.item.id
        },
        onError: (e: { message: string }) => setError(`A Pluggy não conseguiu conectar: ${e.message}`),
        onClose: () => {
          if (created) void connect(created)
          else {
            setLoading(false)
            setStep(null)
          }
        },
      })
      await widget.init()
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
      setStep(null)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void connect(itemId)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BankLogo inst={inst} />
        <p className="leading-snug text-muted">A conexão passa pelo Meu Pluggy (grátis). Se ainda não tem, crie a conta em <strong className="text-ink">meu.pluggy.ai</strong> e conecte o {inst.name} por lá primeiro.</p>
      </div>
      {error && <ErrorBox message={error} />}
      <Field label="Nome no app" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="ex.: Nubank" />
      <Button onClick={openPluggy} loading={loading}>
        Entrar com o Meu Pluggy
      </Button>
      {step && <p className="-mt-2 text-center text-[0.875rem] text-muted" aria-live="polite">{step}</p>}
      <ol className="list-decimal space-y-1.5 pl-5 text-[0.9375rem] leading-snug text-muted">
        <li>Na janela da Pluggy, entre com o e-mail da sua conta do Meu Pluggy.</li>
        <li>
          Marque o banco (um por vez) e toque em <strong className="text-ink">Autorizar</strong>.
        </li>
        <li>Feche a janela: o app busca os últimos 3 meses sozinho.</li>
      </ol>
      <details className="rounded-[1rem] bg-surface px-4 py-3">
        <summary className="cursor-pointer text-[0.9375rem] font-semibold">Já tenho o código da conexão (Item ID)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Item ID" value={itemId} onChange={(e) => setItemId(e.target.value.trim())} autoCapitalize="none" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Button type="submit" variant="secondary" loading={loading} disabled={itemId.length < 30}>
            Conectar com o código
          </Button>
        </div>
      </details>
      <p className="text-center text-[0.8125rem] leading-snug text-muted">Cada banco é uma conexão. Para o segundo banco, toque em “Conectar outro” e repita.</p>
    </form>
  )
}

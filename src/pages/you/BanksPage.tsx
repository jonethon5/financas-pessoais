import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '../../auth/AuthProvider'
import { BankLogo } from '../../components/BankLogo'
import { MascotArt } from '../../components/Pig'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BackButton, Badge, Button, Card, EmptyState, ErrorBox, Field, List, Money, NavBar, Notice, Row, Spinner } from '../../components/ui'
import { connectDemoBank, disconnectDemoBank } from '../../data/demoBank'
import { useTable, useWrite } from '../../data/finance'
import { formatDateShort } from '../../lib/dates'
import { POPULAR_BANKS, accountTitle, findInstitution, type Institution } from '../../lib/institutions'
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
export function AccountRow({ a, label }: { a: BankAccount; label?: string }) {
  const credit = a.type === 'CREDIT'
  const inst = findInstitution(label, a.name)
  return (
    <Row
      icon={<BankLogo inst={inst} credit={credit} size="sm" />}
      title={accountTitle(inst, a.type, a.name)}
      subtitle={credit ? `Fatura atual${a.due_date ? ` · vence ${formatDateShort(a.due_date)}` : ''}${a.available_cents != null ? ` · limite livre ${formatBRLShort(a.available_cents)}` : ''}` : 'Saldo na conta'}
      trailing={a.balance_cents != null ? <Money cents={a.balance_cents} className="text-[1.0625rem] font-semibold" /> : <span className="text-muted">—</span>}
    />
  )
}
const formatBRLShort = (c: number) => `R$ ${Math.round(c / 100).toLocaleString('pt-BR')}`

/** Grade com os bancos mais usados: a pessoa só toca no dela. */
function BankPicker({ onPick }: { onPick: (inst: Institution) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9375rem] leading-snug text-muted">Escolha o seu banco. A conexão é pelo Open Finance: só leitura, o app não consegue mexer no seu dinheiro.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {POPULAR_BANKS.map((inst) => (
          <button key={inst.key} type="button" onClick={() => onPick(inst)} className="press flex items-center gap-3 rounded-[1.1rem] bg-surface p-3 text-left">
            <BankLogo inst={inst} />
            <span className="leading-tight font-semibold">{inst.name}</span>
          </button>
        ))}
      </div>
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
        <Card className="flex gap-3.5">
          <ShieldCheck size={34} weight="duotone" className="shrink-0 text-primary" />
          <p className="leading-snug text-muted">
            Conexão pelo <strong className="text-ink">Open Finance</strong>, regulado pelo Banco Central. É <strong className="text-ink">só leitura</strong>: o app vê saldos e lançamentos, mas não consegue mover dinheiro. Os dados do banco atualizam uma vez por dia.
          </p>
        </Card>
        {demo && <Notice tone="primary">Demonstração: escolha um banco para ver como o app fica com ele conectado. Os dados são de exemplo.</Notice>}

        {!configured ? (
          <Notice tone="warn">A conexão ainda não foi ligada: faltam as chaves da Pluggy (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET) nos secrets. O passo a passo está no README.</Notice>
        ) : !allowed ? (
          <Notice>No beta, a conexão com o banco está disponível só para a conta de administrador. Em breve para todos.</Notice>
        ) : (
          <>
            {(conns.data ?? []).length === 0 ? (
              <EmptyState art={<MascotArt name="tela-conexao" px={170} />} title="Nenhum banco conectado" action={<Button onClick={() => setAdding(true)}>Conectar banco</Button>}>
                Conecte a sua conta e o seu cartão: os gastos entram sozinhos, sem digitar nada.
              </EmptyState>
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
                      <AccountRow key={a.id} a={a} label={c.label} />
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

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await callFunction<{ imported: number; matched: number; accounts: number }>('bank-sync', { action: 'connect', itemId, label })
      await qc.invalidateQueries({ queryKey: ['t'] })
      toast(`${label} conectado: ${r.accounts} ${r.accounts === 1 ? 'conta' : 'contas'}, ${r.imported} lançamentos`)
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BankLogo inst={inst} />
        <p className="leading-snug text-muted">Conecte o {inst.name} no Meu Pluggy e cole aqui o código da conexão.</p>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-[0.9375rem] leading-snug text-muted">
        <li>
          Em <strong className="text-ink">meu.pluggy.ai</strong>, conecte o {inst.name} (autoriza no app do banco).
        </li>
        <li>
          No painel <strong className="text-ink">dashboard.pluggy.ai</strong>: sua aplicação › Demo › Connect Account › escolha <strong className="text-ink">MeuPluggy</strong>.
        </li>
        <li>
          Em “Connected Items”, toque no item › <strong className="text-ink">Copiar Item ID</strong> e cole abaixo.
        </li>
      </ol>
      {error && <ErrorBox message={error} />}
      <Field label="Nome" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="ex.: Nubank" />
      <Field label="Item ID" value={itemId} onChange={(e) => setItemId(e.target.value.trim())} autoCapitalize="none" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <Button type="submit" loading={loading} disabled={itemId.length < 30}>
        Conectar e buscar lançamentos
      </Button>
      <p className="text-center text-[0.8125rem] text-muted">Na primeira vez o app busca os últimos 90 dias.</p>
    </form>
  )
}

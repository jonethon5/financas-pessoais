// Conexão com o banco via Open Finance (Pluggy / Meu Pluggy). SÓ LEITURA: nunca movimenta dinheiro.
//   { action: 'status' }                    → está configurado? esta conta pode usar?
//   { action: 'connect', itemId, label }    → liga uma conexão do Meu Pluggy (o "Item ID") e já sincroniza
//   { action: 'sync', force? }              → busca contas e lançamentos novos de todas as conexões da pessoa
//
// As chaves PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET ficam só nos secrets das funções.
// No beta, as chaves do Meu Pluggy são pessoais (do dono do app): por isso só o administrador usa.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { UserError, adminClient, callerUserId, handle, json } from '../_shared/common.ts'
import { findFixedMatch, isSalaryMatch, learnKey, mapTransaction, type AccountType, type PluggyTx } from '../_shared/bankmap.ts'

const API = Deno.env.get('PLUGGY_API_BASE') || 'https://api.pluggy.ai'
const CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''
const FIRST_SYNC_DAYS = 90
const COOLDOWN_MIN = 15

let cachedKey: { key: string; until: number } | null = null

async function apiKey(): Promise<string> {
  if (cachedKey && Date.now() < cachedKey.until) return cachedKey.key
  const res = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }) })
  if (!res.ok) throw new UserError('A Pluggy recusou as chaves. Confira os secrets PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.', 503)
  const { apiKey: key } = await res.json()
  cachedKey = { key, until: Date.now() + 100 * 60_000 } // a chave vale 2 horas
  return key
}

class PluggyError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

async function pluggy<T>(path: string, retry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-API-KEY': await apiKey() }, signal: AbortSignal.timeout(30_000) })
  if (res.status === 401 && retry) {
    cachedKey = null
    return pluggy(path, false)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new PluggyError(res.status, String(body?.code ?? ''), String(body?.message ?? `Pluggy ${res.status}`))
  }
  return res.json()
}

type PluggyAccount = {
  id: string
  type: AccountType
  subtype?: string | null
  name: string
  marketingName?: string | null
  balance?: number | null
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; balanceDueDate?: string | null; balanceCloseDate?: string | null } | null
}

const toCents = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100))
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000))
const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function stableUuid(key: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`poupei:${key}`)))
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

type Conn = { id: string; item_id: string; label: string; last_sync_at: string | null }

/** Sincroniza uma conexão: contas (saldo, limite, fatura) e lançamentos novos, sem duplicar. */
async function syncConnection(admin: SupabaseClient, uid: string, conn: Conn) {
  const today = todayBR()
  const from = conn.last_sync_at ? addDays(conn.last_sync_at.slice(0, 10), -10) : addDays(today, -FIRST_SYNC_DAYS)

  const [{ data: profile }, { data: categories }, { data: rules }, { data: open }] = await Promise.all([
    admin.from('profiles').select('salary_cents, payday').eq('id', uid).single(),
    admin.from('categories').select('id, name, kind').eq('user_id', uid),
    admin.from('category_rules').select('pattern, category_id').eq('user_id', uid),
    admin.from('transactions').select('id, type, amount_cents, date, paid, external_id').eq('user_id', uid).in('type', ['salario', 'fixo']).gte('date', from).eq('skipped', false),
  ])
  const catByName = new Map((categories ?? []).map((c) => [c.name, c.id]))
  const ruleByKey = new Map((rules ?? []).map((r) => [r.pattern, r.category_id]))
  const salaryRows = (open ?? []).filter((t) => t.type === 'salario' && !t.external_id)
  const fixedRows = (open ?? []).filter((t) => t.type === 'fixo')

  const accounts = (await pluggy<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(conn.item_id)}`)).results ?? []
  let imported = 0
  let matched = 0
  for (const acc of accounts) {
    const { data: saved, error: accError } = await admin
      .from('bank_accounts')
      .upsert(
        {
          user_id: uid,
          connection_id: conn.id,
          external_id: acc.id,
          type: acc.type,
          subtype: acc.subtype ?? null,
          name: acc.marketingName || acc.name || conn.label,
          balance_cents: toCents(acc.balance),
          credit_limit_cents: toCents(acc.creditData?.creditLimit),
          available_cents: toCents(acc.creditData?.availableCreditLimit),
          due_date: acc.creditData?.balanceDueDate?.slice(0, 10) ?? null,
          close_date: acc.creditData?.balanceCloseDate?.slice(0, 10) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,external_id' },
      )
      .select('id')
      .single()
    if (accError) throw accError

    // Lançamentos da conta (paginação por cursor)
    const txs: PluggyTx[] = []
    let next: string | null = `?accountId=${encodeURIComponent(acc.id)}&dateFrom=${from}`
    for (let page = 0; next && page < 40; page++) {
      const r: { results: PluggyTx[]; next: string | null } = await pluggy(`/v2/transactions${next}`)
      txs.push(...(r.results ?? []).filter((t) => t.status !== 'PENDING'))
      next = r.next
    }
    const mapped = txs.map((t) => mapTransaction(t, acc.type)).filter((m) => m != null)
    if (!mapped.length) continue

    const { data: seen } = await admin.from('transactions').select('external_id').eq('user_id', uid).in('external_id', mapped.map((m) => m.external_id))
    const already = new Set((seen ?? []).map((s) => s.external_id))
    const rows = []
    for (const m of mapped) {
      if (already.has(m.external_id)) continue
      const link = { external_id: m.external_id, source: 'banco', bank_account_id: saved.id, amount_cents: m.amount_cents, date: m.date }

      // Salário do mês já lançado pelo app: só confirma com o valor e o dia de verdade
      const sal = salaryRows.find((s) => isSalaryMatch(m, s))
      if (sal) {
        await admin.from('transactions').update(link).eq('id', sal.id)
        salaryRows.splice(salaryRows.indexOf(sal), 1)
        matched++
        continue
      }
      // Conta fixa em aberto: marca como paga
      const fixed = findFixedMatch(m, fixedRows)
      if (fixed) {
        await admin.from('transactions').update({ ...link, paid: true }).eq('id', fixed.id)
        fixed.external_id = m.external_id
        fixed.paid = true
        matched++
        continue
      }

      const salaryLike = m.kind === 'income' && profile?.salary_cents && profile?.payday
        && isSalaryMatch(m, { amount_cents: profile.salary_cents, date: `${m.date.slice(0, 8)}${String(Math.min(profile.payday, 28)).padStart(2, '0')}` })
      const learned = ruleByKey.get(learnKey(m.description))
      const fallback = m.kind === 'income' ? (salaryLike ? 'Salário' : 'Renda extra') : 'Outros'
      rows.push({
        user_id: uid,
        kind: m.kind,
        type: salaryLike ? 'salario' : m.type,
        amount_cents: m.amount_cents,
        date: m.date,
        description: m.description,
        category_id: learned ?? catByName.get(m.categoryHint ?? '') ?? catByName.get(fallback) ?? null,
        installment_group: m.installmentKey ? await stableUuid(`${uid}|${m.installmentKey}`) : null,
        installment_no: m.installment_no,
        installment_total: m.installment_total,
        paid: true,
        source: 'banco',
        external_id: m.external_id,
        bank_account_id: saved.id,
      })
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from('transactions').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      if (error) throw error
    }
    imported += rows.length
  }
  return { imported, matched, accounts: accounts.length }
}

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const uid = await callerUserId(req, admin)
    const body = await req.json().catch(() => ({}))
    const configured = Boolean(CLIENT_ID && CLIENT_SECRET)
    const { data: me } = await admin.from('profiles').select('is_admin').eq('id', uid).single()
    const allowed = Boolean(me?.is_admin)

    if (body.action === 'status') return json({ configured, allowed })
    if (!configured) throw new UserError('A conexão com o banco ainda não foi ligada: faltam as chaves da Pluggy nos secrets.', 503)
    if (!allowed) throw new UserError('No beta, a conexão com o banco está disponível só para a conta de administrador.', 403)

    if (body.action === 'connect') {
      const itemId = String(body.itemId ?? '').trim()
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new UserError('Esse não parece um Item ID. Copie o código do item na página Demo do painel da Pluggy.')
      const label = String(body.label ?? '').trim().slice(0, 40) || 'Banco'
      try {
        await pluggy(`/accounts?itemId=${encodeURIComponent(itemId)}`)
      } catch (err) {
        if (err instanceof PluggyError) throw new UserError(`A Pluggy não encontrou esse item (${err.status}). Confira o Item ID.`)
        throw err
      }
      const { data: conn, error } = await admin.from('bank_connections').upsert({ user_id: uid, item_id: itemId, label, status: 'ok', last_error: null }, { onConflict: 'user_id,item_id' }).select('id, item_id, label, last_sync_at').single()
      if (error) throw error
      const result = await syncConnection(admin, uid, conn)
      await admin.from('bank_connections').update({ last_sync_at: new Date().toISOString(), status: 'ok', last_error: null }).eq('id', conn.id)
      return json({ ok: true, ...result })
    }

    if (body.action === 'sync') {
      const { data: conns } = await admin.from('bank_connections').select('id, item_id, label, last_sync_at').eq('user_id', uid)
      const total = { imported: 0, matched: 0, accounts: 0, errors: [] as string[] }
      for (const conn of conns ?? []) {
        if (!body.force && conn.last_sync_at && Date.now() - Date.parse(conn.last_sync_at) < COOLDOWN_MIN * 60_000) continue
        try {
          const r = await syncConnection(admin, uid, conn)
          total.imported += r.imported
          total.matched += r.matched
          total.accounts += r.accounts
          await admin.from('bank_connections').update({ last_sync_at: new Date().toISOString(), status: 'ok', last_error: null }).eq('id', conn.id)
        } catch (err) {
          const expired = err instanceof PluggyError && /AUTHORIZATION_EXPIRED|CONSENT/i.test(err.code + err.message)
          const message = expired ? 'A autorização no Meu Pluggy venceu (dura 1 ano). Conecte de novo pelo painel da Pluggy.' : `Não deu para atualizar: ${(err as Error).message}`.slice(0, 300)
          console.error('bank-sync', conn.label, err)
          await admin.from('bank_connections').update({ status: expired ? 'expirado' : 'erro', last_error: message }).eq('id', conn.id)
          total.errors.push(`${conn.label}: ${message}`)
        }
      }
      return json({ ok: true, ...total })
    }

    throw new UserError('Ação inválida.')
  }),
)

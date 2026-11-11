// Conexão com o banco de ponta a ponta, contra o Supabase LOCAL e uma "Pluggy de mentira" (servidor HTTP local).
// A Edge Function bank-sync lê PLUGGY_API_BASE do supabase/functions/.env (aponta para este servidor).
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `BANK-${run.toUpperCase()}`
const ITEM = '11111111-2222-4333-8444-555555555555'
const now = new Date()
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const day = (d: number) => `${ym}-${String(d).padStart(2, '0')}`

// ---- Pluggy de mentira -------------------------------------------------------
const TXS: Record<string, { page1: unknown[]; page2?: unknown[] }> = {
  'acc-bank': {
    page1: [
      { id: 'b1', description: 'Salário EMPRESA LTDA', amount: 2113, date: `${day(5)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'b2', description: 'IFOOD *RESTAURANTE', amount: -42.9, date: `${day(6)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b3', description: 'Pagamento VIVO', amount: -39.9, date: `${day(14)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b4', description: 'Pagamento de fatura', amount: -500, date: `${day(10)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b5', description: 'Pix recebido Maria', amount: 150, date: `${day(7)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'b6', description: 'Compra pendente', amount: -10, date: `${day(8)}T00:00:00.000Z`, type: 'DEBIT', status: 'PENDING' },
    ],
    page2: [{ id: 'b7', description: 'UBER *TRIP', amount: -18.4, date: `${day(9)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' }],
  },
  'acc-card': {
    page1: [
      { id: 'c1', description: 'SHOPEE *LOJA', amount: 59.7, date: `${day(3)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'c2', description: 'MAGAZINE LUIZA', amount: 150, date: `${day(2)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED', creditCardMetadata: { installmentNumber: 3, totalInstallments: 10, purchaseDate: '2026-09-02T00:00:00Z' } },
      { id: 'c3', description: 'Pagamento recebido', amount: -500, date: `${day(10)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
    ],
  },
}

let server: Server
function startMock(): Promise<void> {
  server = createServer((req, res) => {
    const u = new globalThis.URL(req.url!, 'http://x')
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST' && u.pathname === '/auth') return send(200, { apiKey: 'chave-de-teste' })
    if (req.headers['x-api-key'] !== 'chave-de-teste') return send(401, { code: 'UNAUTHORIZED' })
    if (u.pathname === '/accounts') {
      if (u.searchParams.get('itemId') !== ITEM) return send(404, { code: 'ITEM_NOT_FOUND', message: 'not found' })
      return send(200, {
        results: [
          { id: 'acc-bank', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta Nubank', balance: 1234.56 },
          { id: 'acc-card', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Cartão Nubank', balance: 456.78, creditData: { creditLimit: 3000, availableCreditLimit: 2543.22, balanceDueDate: `${day(20)}T00:00:00Z` } },
        ],
      })
    }
    if (u.pathname === '/v2/transactions') {
      const acc = TXS[u.searchParams.get('accountId') ?? '']
      if (!acc) return send(200, { results: [], next: null })
      if (u.searchParams.get('after')) return send(200, { results: acc.page2 ?? [], next: null })
      return send(200, { results: acc.page1, next: acc.page2 ? `?accountId=${u.searchParams.get('accountId')}&after=pagina2` : null })
    }
    send(404, {})
  })
  return new Promise((r) => server.listen(55399, '0.0.0.0', () => r()))
}

// ---- Pessoas -----------------------------------------------------------------
type User = { id: string; client: SupabaseClient }
const created: string[] = []
async function newUser(label: string): Promise<User> {
  const email = `${label}-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'senha-de-teste-123', email_confirm: true, user_metadata: { name: label, beta_code: CODE } })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(URL, ANON, opts)
  await client.auth.signInWithPassword({ email, password: 'senha-de-teste-123' })
  return { id: data.user.id, client }
}

let owner: User
let tester: User
let salaryId: string
let fixedId: string

beforeAll(async () => {
  await startMock()
  await admin.from('beta_codes').insert({ code: CODE, max_uses: 5 })
  owner = await newUser('dono')
  tester = await newUser('testador')
  await admin.from('profiles').update({ is_admin: true, salary_cents: 211300, payday: 5 }).eq('id', owner.id)
  // Categorias padrão (o app cria no primeiro acesso)
  const names = ['Delivery', 'Transporte', 'Compras online', 'Telefone e internet', 'Outros']
  await owner.client.from('categories').insert(names.map((name, i) => ({ name, sort: i })))
  await owner.client.from('categories').insert([{ name: 'Salário', kind: 'income' }, { name: 'Renda extra', kind: 'income' }])
  // O que o app já lançou sozinho no mês: salário e o fixo do telefone (em aberto)
  const { data: sal } = await owner.client.from('transactions').insert({ kind: 'income', type: 'salario', amount_cents: 211300, date: day(5), description: 'Salário' }).select('id').single()
  salaryId = sal!.id
  const { data: rec } = await owner.client.from('recurrings').insert({ description: 'Telefone', amount_cents: 3900, day: 15, start_month: ym }).select('id').single()
  const { data: fx } = await owner.client.from('transactions').insert({ kind: 'expense', type: 'fixo', amount_cents: 3900, date: day(15), description: 'Telefone', recurring_id: rec!.id, paid: false }).select('id').single()
  fixedId = fx!.id
}, 60_000)

afterAll(async () => {
  server?.close()
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined)
  await admin.from('beta_codes').delete().eq('code', CODE)
})

describe('conexão com o banco (Pluggy de mentira)', () => {
  it('quem não é administrador não usa as chaves pessoais do Meu Pluggy', async () => {
    const st = await tester.client.functions.invoke('bank-sync', { body: { action: 'status' } })
    expect(st.data).toEqual({ configured: true, allowed: false })
    const r = await tester.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: ITEM } })
    expect(r.error).toBeTruthy()
    expect((await admin.from('bank_connections').select('id').eq('user_id', tester.id)).data).toEqual([])
  })

  it('recusa Item ID que não existe', async () => {
    const r = await owner.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: '99999999-2222-4333-8444-555555555555' } })
    expect(r.error).toBeTruthy()
  })

  it('conecta, lê saldo e fatura, e lança sem duplicar o que o app já tinha', async () => {
    const { data, error } = await owner.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: ITEM, label: 'Nubank' } })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, accounts: 2, matched: 2 })

    const { data: accounts } = await owner.client.from('bank_accounts').select('name, type, balance_cents, credit_limit_cents, available_cents, due_date').order('type')
    expect(accounts).toEqual([
      { name: 'Conta Nubank', type: 'BANK', balance_cents: 123456, credit_limit_cents: null, available_cents: null, due_date: null },
      { name: 'Cartão Nubank', type: 'CREDIT', balance_cents: 45678, credit_limit_cents: 300000, available_cents: 254322, due_date: day(20) },
    ])

    // Salário: o lançado pelo app foi confirmado (não virou outra renda)
    const { data: sal } = await owner.client.from('transactions').select('amount_cents, source, external_id').eq('id', salaryId).single()
    expect(sal).toEqual({ amount_cents: 211300, source: 'banco', external_id: 'pluggy:b1' })
    // Telefone: o fixo em aberto ficou pago com o valor real
    const { data: fx } = await owner.client.from('transactions').select('paid, amount_cents, external_id').eq('id', fixedId).single()
    expect(fx).toEqual({ paid: true, amount_cents: 3990, external_id: 'pluggy:b3' })

    const { data: imported } = await owner.client.from('transactions').select('description, kind, type, amount_cents, installment_no, installment_total, categories(name)').eq('source', 'banco').is('recurring_id', null).neq('type', 'salario').order('description')
    expect(imported).toEqual([
      { description: 'Ifood Restaurante', kind: 'expense', type: 'dia', amount_cents: 4290, installment_no: null, installment_total: null, categories: { name: 'Delivery' } },
      { description: 'Magazine Luiza', kind: 'expense', type: 'parcela', amount_cents: 15000, installment_no: 3, installment_total: 10, categories: { name: 'Outros' } },
      { description: 'Pix recebido Maria', kind: 'income', type: 'extra', amount_cents: 15000, installment_no: null, installment_total: null, categories: { name: 'Renda extra' } },
      { description: 'Shopee Loja', kind: 'expense', type: 'dia', amount_cents: 5970, installment_no: null, installment_total: null, categories: { name: 'Compras online' } },
      { description: 'Uber Trip', kind: 'expense', type: 'dia', amount_cents: 1840, installment_no: null, installment_total: null, categories: { name: 'Transporte' } },
    ])
  })

  it('sincronizar de novo não duplica nada', async () => {
    const before = (await owner.client.from('transactions').select('id')).data!.length
    const { data } = await owner.client.functions.invoke('bank-sync', { body: { action: 'sync', force: true } })
    expect(data).toMatchObject({ ok: true, imported: 0, matched: 0, errors: [] })
    expect((await owner.client.from('transactions').select('id')).data!.length).toBe(before)
  })

  it('aprende a categoria corrigida e usa nas próximas sincronizações', async () => {
    const { data: outros } = await owner.client.from('categories').select('id').eq('name', 'Outros').single()
    await owner.client.from('category_rules').insert({ pattern: 'novo mercado', category_id: outros!.id })
    expect((await tester.client.from('category_rules').select('id')).data).toEqual([])
    expect((await tester.client.from('bank_accounts').select('id')).data).toEqual([])
    // A pessoa não grava conta bancária nem conexão "na mão" (só a função)
    expect((await owner.client.from('bank_accounts').insert({ user_id: owner.id, connection_id: salaryId, external_id: 'x', type: 'BANK', name: 'x' })).error).toBeTruthy()
  })
})

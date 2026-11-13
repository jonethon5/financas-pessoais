// Conexão com o banco de ponta a ponta, contra o Supabase LOCAL e uma "Pluggy de mentira" (servidor HTTP local).
// As funções precisam rodar com PLUGGY_API_BASE=http://host.docker.internal:55399 (supabase functions serve --env-file …).
import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { stableId } from '../../src/lib/recurring'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `BANK-${run.toUpperCase()}`
const ITEM = '11111111-2222-4333-8444-555555555555'
const SLOW_ITEM = '22222222-2222-4333-8444-555555555555'
const now = new Date()
// Tudo no mês passado: assim nenhuma data cai no futuro (o que é futuro não entra), seja qual for o dia de hoje
const base = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const ym = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
const day = (d: number) => `${ym}-${String(d).padStart(2, '0')}`
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const WEBHOOK_KEY = createHash('sha256').update(`${process.env.PLUGGY_CLIENT_SECRET ?? 'segredo-de-teste'}:poupei-webhook`).digest('hex').slice(0, 40)

// ---- Pluggy de mentira -------------------------------------------------------
const TXS: Record<string, { page1: unknown[]; page2?: unknown[] }> = {
  'acc-bank': {
    page1: [
      { id: 'b1', description: 'Salário EMPRESA LTDA', amount: 2113, date: `${day(5)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'b2', description: 'IFOOD *RESTAURANTE', amount: -42.9, date: `${day(6)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b3', description: 'Pagamento VIVO', amount: -39.9, date: `${day(14)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b4', description: 'Pagamento de fatura', amount: -500, date: `${day(10)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      { id: 'b5', description: 'Pix recebido Maria', amount: 150, date: `${day(7)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      // Pendente com data de hoje ou antes entra (como no app do banco); com data futura, não
      { id: 'b6', description: 'Compra pendente', amount: -10, date: `${day(8)}T00:00:00.000Z`, type: 'DEBIT', status: 'PENDING' },
      { id: 'b-futura', description: 'Pix agendado', amount: -99, date: '2999-01-01T00:00:00.000Z', type: 'DEBIT', status: 'PENDING' },
    ],
    page2: [
      { id: 'b7', description: 'UBER *TRIP', amount: -18.4, date: `${day(9)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' },
      // Pix entre contas da própria pessoa (pelo nome e pela categoria do Open Finance): não é renda nem gasto
      { id: 'b8', description: 'Transferência recebida pelo Pix|DONO DA SILVA', amount: 800, date: `${day(8)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'b9', description: 'Transferência enviada pelo Pix|OUTRO BANCO', amount: -300, date: `${day(8)}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED', category: 'Same person transfer - PIX' },
      // Outra entrada do tamanho do salário no mesmo mês: o mês só tem um salário
      { id: 'b10', description: 'Transferência recebida pelo Pix|EMPRESA LTDA', amount: 2100, date: `${day(7)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
    ],
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
    if (req.method === 'POST' && u.pathname === '/connect_token') return send(200, { accessToken: 'token-da-janela' })
    if (u.pathname === `/items/${ITEM}`) return send(200, { id: ITEM, status: 'UPDATED', executionStatus: 'SUCCESS', connector: { name: 'Nubank' } })
    if (u.pathname === `/items/${SLOW_ITEM}`) return send(200, { id: SLOW_ITEM, status: 'UPDATING', executionStatus: 'LOGIN_IN_PROGRESS', connector: { name: 'Neon' } })
    if (u.pathname === '/identity') return send(200, { fullName: 'Dono Da Silva' })
    if (u.pathname === '/investments') {
      return send(200, {
        results: [
          { id: 'inv1', name: 'Caixinha Viagem', type: 'FIXED_INCOME', subtype: 'CDB', balance: 300.5, status: 'ACTIVE' },
          { id: 'inv2', name: 'Resgatada', type: 'FIXED_INCOME', subtype: 'CDB', balance: 0, status: 'TOTAL_WITHDRAWAL' },
        ],
      })
    }
    if (u.pathname === '/accounts') {
      if (u.searchParams.get('itemId') !== ITEM) return send(404, { code: 'ITEM_NOT_FOUND', message: 'not found' })
      return send(200, {
        results: [
          { id: 'acc-bank', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta Nubank', balance: 1234.56, bankData: { automaticallyInvestedBalance: 100, overdraftContractedLimit: 500, overdraftUsedLimit: 0 } },
          { id: 'acc-card', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Cartão Nubank', balance: 456.78, creditData: { creditLimit: 3000, availableCreditLimit: 2543.22, balanceDueDate: `${day(20)}T00:00:00Z` } },
        ],
      })
    }
    if (u.pathname === '/v2/transactions') {
      const acc = TXS[u.searchParams.get('accountId') ?? '']
      if (!acc) return send(200, { results: [], next: null })
      // Como a Pluggy: só a partir da data pedida
      const from = u.searchParams.get('dateFrom') ?? '0000'
      const since = (xs: unknown[]) => (xs as { date: string }[]).filter((t) => t.date.slice(0, 10) >= from)
      if (u.searchParams.get('after')) return send(200, { results: since(acc.page2 ?? []), next: null })
      return send(200, { results: since(acc.page1), next: acc.page2 ? `?accountId=${u.searchParams.get('accountId')}&dateFrom=${from}&after=pagina2` : null })
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
let manualId: string

beforeAll(async () => {
  await startMock()
  await admin.from('beta_codes').insert({ code: CODE, max_uses: 5 })
  owner = await newUser('dono')
  tester = await newUser('testador')
  await admin.from('profiles').update({ is_admin: true, salary_cents: 211300, payday: 5, name: 'Dono da Silva' }).eq('id', owner.id)
  // Categorias padrão (o app cria no primeiro acesso)
  const names = ['Delivery', 'Transporte', 'Compras online', 'Telefone e internet', 'Outros']
  await owner.client.from('categories').insert(names.map((name, i) => ({ name, sort: i })))
  await owner.client.from('categories').insert([{ name: 'Salário', kind: 'income' }, { name: 'Renda extra', kind: 'income' }])
  // O que o app já lançou sozinho no mês: salário e o fixo do telefone (em aberto)
  salaryId = await stableId(`salario:${owner.id}:${ym}`)
  await owner.client.from('transactions').insert({ id: salaryId, kind: 'income', type: 'salario', amount_cents: 211300, date: day(5), description: 'Salário' })
  const { data: rec } = await owner.client.from('recurrings').insert({ description: 'Telefone', amount_cents: 3900, day: 15, start_month: ym }).select('id').single()
  const { data: fx } = await owner.client.from('transactions').insert({ kind: 'expense', type: 'fixo', amount_cents: 3900, date: day(15), description: 'Telefone', recurring_id: rec!.id, paid: false }).select('id').single()
  fixedId = fx!.id
  // Um gasto que a pessoa lançou à mão e que o banco também vai trazer (Uber de R$ 18,40, um dia antes)
  const { data: byHand } = await owner.client.from('transactions').insert({ kind: 'expense', type: 'dia', amount_cents: 1840, date: day(8), description: 'Uber para o trabalho', emotion: 'cansado' }).select('id').single()
  manualId = byHand!.id
}, 60_000)

/** Faz a próxima atualização ler tudo de novo (sem isso, só os últimos 10 dias) */
const readAll = () => admin.from('bank_connections').update({ last_sync_at: null }).eq('user_id', owner.id)
const sync = () => owner.client.functions.invoke('bank-sync', { body: { action: 'sync', force: true } })

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

  it('convite com "libera banco": a pessoa pode conectar e abrir a janela da Pluggy (só o Meu Pluggy)', async () => {
    const BANK_CODE = `SOCIO-${run.toUpperCase()}`
    await admin.from('beta_codes').insert({ code: BANK_CODE, max_uses: 1, bank_access: true })
    const email = `socio-${run}@teste.local`
    const { data: created_, error } = await admin.auth.admin.createUser({ email, password: 'senha-de-teste-123', email_confirm: true, user_metadata: { name: 'Sócio', beta_code: BANK_CODE } })
    expect(error).toBeNull()
    created.push(created_.user!.id)
    const socio = createClient(URL, ANON, opts)
    await socio.auth.signInWithPassword({ email, password: 'senha-de-teste-123' })
    expect((await socio.functions.invoke('bank-sync', { body: { action: 'status' } })).data).toEqual({ configured: true, allowed: true })
    expect((await socio.functions.invoke('bank-sync', { body: { action: 'connect_token' } })).data).toEqual({ accessToken: 'token-da-janela', connectorId: 200 })
    // quem não tem o convite não pega o token
    expect((await tester.client.functions.invoke('bank-sync', { body: { action: 'connect_token' } })).error).toBeTruthy()
    // o código não fica visível nem editável para quem não é administrador
    expect((await socio.from('beta_codes').select('code')).data).toEqual([])
    await admin.from('beta_codes').delete().eq('code', BANK_CODE)
  })

  it('recusa Item ID que não existe', async () => {
    const r = await owner.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: '99999999-2222-4333-8444-555555555555' } })
    expect(r.error).toBeTruthy()
  })

  it('avisa quando o Meu Pluggy ainda está buscando os dados do banco', async () => {
    const r = await owner.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: SLOW_ITEM } })
    expect(r.error).toBeTruthy()
    expect(await r.error.context.json()).toMatchObject({ error: expect.stringContaining('ainda está buscando') })
    expect((await admin.from('bank_connections').select('id').eq('user_id', owner.id)).data).toEqual([])
  })

  it('conecta, lê saldo e fatura, e lança sem duplicar o que o app já tinha', async () => {
    const { data, error } = await owner.client.functions.invoke('bank-sync', { body: { action: 'connect', itemId: ITEM, label: 'Nubank' } })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, accounts: 2, matched: 3 })

    const { data: accounts } = await owner.client.from('bank_accounts').select('name, type, balance_cents, credit_limit_cents, available_cents, due_date, invested_cents, overdraft_limit_cents, overdraft_used_cents').order('type')
    expect(accounts).toEqual([
      { name: 'Conta Nubank', type: 'BANK', balance_cents: 123456, credit_limit_cents: null, available_cents: null, due_date: null, invested_cents: 10000, overdraft_limit_cents: 50000, overdraft_used_cents: 0 },
      { name: 'Cartão Nubank', type: 'CREDIT', balance_cents: 45678, credit_limit_cents: 300000, available_cents: 254322, due_date: day(20), invested_cents: null, overdraft_limit_cents: null, overdraft_used_cents: null },
      // dinheiro guardado: só o que ainda tem saldo
      { name: 'Caixinha Viagem', type: 'INVESTMENT', balance_cents: 30050, credit_limit_cents: null, available_cents: null, due_date: null, invested_cents: null, overdraft_limit_cents: null, overdraft_used_cents: null },
    ])

    // Salário: o lançado pelo app foi confirmado (não virou outra renda)
    const { data: sal } = await owner.client.from('transactions').select('amount_cents, source, external_id').eq('id', salaryId).single()
    expect(sal).toEqual({ amount_cents: 211300, source: 'banco', external_id: 'pluggy:b1' })
    // Telefone: o fixo em aberto ficou pago com o valor real
    const { data: fx } = await owner.client.from('transactions').select('paid, amount_cents, external_id').eq('id', fixedId).single()
    expect(fx).toEqual({ paid: true, amount_cents: 3990, external_id: 'pluggy:b3' })

    // Tudo o que o banco mandou aparece, com a descrição do banco. Contam só os gastos de verdade:
    // fatura, pagamento do cartão, entrada na conta e Pix entre contas próprias aparecem, mas não contam.
    const { data: imported } = await owner.client.from('transactions').select('description, kind, type, amount_cents, skipped, note').eq('source', 'banco').is('recurring_id', null).neq('type', 'salario')
    const rows = (imported ?? []).sort((x, y) => (x.description < y.description ? -1 : 1)).map((r) => ({ ...r, note: r.note ? r.note.split(':')[0] : null }))
    expect(rows).toEqual([
      { description: 'Compra pendente', kind: 'expense', type: 'dia', amount_cents: 1000, skipped: false, note: null },
      { description: 'IFOOD *RESTAURANTE', kind: 'expense', type: 'dia', amount_cents: 4290, skipped: false, note: null },
      { description: 'MAGAZINE LUIZA', kind: 'expense', type: 'parcela', amount_cents: 15000, skipped: false, note: null },
      { description: 'Pagamento de fatura', kind: 'expense', type: 'dia', amount_cents: 50000, skipped: true, note: 'Pagamento da fatura do cartão' },
      { description: 'Pagamento recebido', kind: 'income', type: 'extra', amount_cents: 50000, skipped: true, note: 'Pagamento da fatura do cartão' },
      { description: 'Pix recebido Maria', kind: 'income', type: 'extra', amount_cents: 15000, skipped: true, note: null },
      { description: 'SHOPEE *LOJA', kind: 'expense', type: 'dia', amount_cents: 5970, skipped: false, note: null },
      { description: 'Transferência enviada pelo Pix|OUTRO BANCO', kind: 'expense', type: 'dia', amount_cents: 30000, skipped: true, note: 'Transferência entre contas suas' },
      { description: 'Transferência recebida pelo Pix|DONO DA SILVA', kind: 'income', type: 'extra', amount_cents: 80000, skipped: true, note: 'Transferência entre contas suas' },
      // outra entrada do tamanho do salário no mesmo mês: o mês só tem um salário
      { description: 'Transferência recebida pelo Pix|EMPRESA LTDA', kind: 'income', type: 'extra', amount_cents: 210000, skipped: true, note: null },
      // o Uber não entrou de novo: confirmou o que a pessoa tinha lançado à mão (nome, dia e sentimento dela)
      { description: 'Uber para o trabalho', kind: 'expense', type: 'dia', amount_cents: 1840, skipped: false, note: null },
    ])
    const { data: byHand } = await owner.client.from('transactions').select('date, emotion, external_id').eq('id', manualId).single()
    expect(byHand).toEqual({ date: day(8), emotion: 'cansado', external_id: 'pluggy:b7' })
    // A renda do mês continua sendo só o salário do cadastro
    const { data: income } = await owner.client.from('transactions').select('type, amount_cents').eq('kind', 'income').eq('skipped', false)
    expect(income).toEqual([{ type: 'salario', amount_cents: 211300 }])
  })

  it('a entrada só conta como renda depois que a pessoa diz que as daquela origem contam', async () => {
    const { data: extra } = await owner.client.from('categories').select('id').eq('name', 'Renda extra').single()
    await owner.client.from('category_rules').insert({ pattern: 'conta:cliente joao', category_id: extra!.id })
    TXS['acc-bank'].page1.push(
      { id: 'b11', description: 'Transferência recebida pelo Pix|CLIENTE JOAO', amount: 250, date: `${day(9)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
      { id: 'b12', description: 'Transferência recebida pelo Pix|FULANO DE TAL', amount: 90, date: `${day(9)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' },
    )
    await readAll()
    const { data } = await sync()
    expect(data).toMatchObject({ ok: true, imported: 2, errors: [] })
    const { data: rows } = await owner.client.from('transactions').select('external_id, skipped').in('external_id', ['pluggy:b11', 'pluggy:b12']).order('external_id')
    expect(rows).toEqual([
      { external_id: 'pluggy:b11', skipped: false },
      { external_id: 'pluggy:b12', skipped: true },
    ])
  })

  it('salário cadastrado depois: a entrada parecida passa a confirmar o salário do mês (sem virar outra renda)', async () => {
    // Mês passado: o banco trouxe uma entrada do tamanho do salário, e o app ainda não tinha o salário daquele mês
    const prev = new Date(base.getFullYear(), base.getMonth() - 1, 5)
    const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    const { data: account } = await admin.from('bank_accounts').select('id').eq('user_id', owner.id).eq('type', 'BANK').single()
    await admin.from('transactions').insert({ user_id: owner.id, kind: 'income', type: 'extra', amount_cents: 205000, date: `${prevYm}-06`, description: 'Pix de Empresa Ltda', skipped: true, source: 'banco', external_id: 'pluggy:antigo', bank_account_id: account!.id })
    const { data } = await owner.client.functions.invoke('bank-sync', { body: { action: 'reconcile' } })
    expect(data).toMatchObject({ ok: true, changed: 1 })
    const { data: salaries } = await owner.client.from('transactions').select('id, amount_cents, date, external_id').eq('type', 'salario').gte('date', `${prevYm}-01`).lte('date', `${prevYm}-28`)
    expect(salaries).toEqual([{ id: await stableId(`salario:${owner.id}:${prevYm}`), amount_cents: 211300, date: `${prevYm}-05`, external_id: 'pluggy:antigo' }])
    expect((await owner.client.from('transactions').select('id').eq('type', 'extra').gte('date', `${prevYm}-01`).lte('date', `${prevYm}-28`)).data).toEqual([])
  })

  it('sincronizar de novo não duplica nada', async () => {
    const before = (await owner.client.from('transactions').select('id')).data!.length
    await readAll()
    const { data } = await sync()
    expect(data).toMatchObject({ ok: true, imported: 0, matched: 0, errors: [] })
    expect((await owner.client.from('transactions').select('id')).data!.length).toBe(before)
  })

  it('compra que o banco lançou com outro id não duplica, e o que o banco desfez sai do app', async () => {
    const card = TXS['acc-card'].page1 as { id: string }[]
    card.find((t) => t.id === 'c1')!.id = 'c1-lancada'
    TXS['acc-bank'].page1 = (TXS['acc-bank'].page1 as { id: string }[]).filter((t) => t.id !== 'b6')
    await readAll()
    const { data } = await sync()
    expect(data).toMatchObject({ ok: true, imported: 0, errors: [] })
    const { data: shopee } = await owner.client.from('transactions').select('external_id').eq('description', 'SHOPEE *LOJA')
    expect(shopee).toEqual([{ external_id: 'pluggy:c1-lancada' }])
    expect((await owner.client.from('transactions').select('id').eq('external_id', 'pluggy:b6')).data).toEqual([])
  })

  it('arruma o que a versão antiga gravou: a entrada que tinha virado um segundo salário deixa de contar', async () => {
    const { data: account } = await admin.from('bank_accounts').select('id').eq('user_id', owner.id).eq('type', 'BANK').single()
    await admin.from('transactions').insert({ user_id: owner.id, kind: 'income', type: 'salario', amount_cents: 187800, date: day(6), description: 'Pix de Outra Conta', source: 'banco', external_id: 'pluggy:velho', bank_account_id: account!.id })
    TXS['acc-bank'].page1.push({ id: 'velho', description: 'Transferência recebida pelo Pix|OUTRA PESSOA', amount: 1878, date: `${day(6)}T00:00:00.000Z`, type: 'CREDIT', status: 'POSTED' })
    await readAll()
    const { data } = await sync()
    expect(data).toMatchObject({ ok: true, errors: [] })
    const { data: old } = await owner.client.from('transactions').select('type, skipped').eq('external_id', 'pluggy:velho').single()
    expect(old).toEqual({ type: 'extra', skipped: true })
    const { data: salaries } = await owner.client.from('transactions').select('id, amount_cents').eq('type', 'salario').gte('date', day(1)).eq('skipped', false)
    expect(salaries).toEqual([{ id: salaryId, amount_cents: 211300 }])
  })

  it('aviso da Pluggy (webhook): sem a chave certa não faz nada; com ela, busca os lançamentos novos na hora', async () => {
    const hook = (key: string, body: unknown) => fetch(`${URL}/functions/v1/bank-webhook?chave=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect((await hook('errada', { event: 'item/updated', itemId: ITEM })).status).toBe(401)
    const yesterday = iso(new Date(now.getTime() - 86_400_000))
    TXS['acc-bank'].page1.push({ id: 'b-aviso', description: 'PADARIA DO BAIRRO', amount: -12.5, date: `${yesterday}T00:00:00.000Z`, type: 'DEBIT', status: 'POSTED' })
    const r = await hook(WEBHOOK_KEY, { event: 'item/updated', itemId: ITEM })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ ok: true, users: 1 })
    // O trabalho termina em segundo plano: espera aparecer
    let found: unknown[] = []
    for (let i = 0; i < 40 && !found.length; i++) {
      found = (await owner.client.from('transactions').select('id').eq('external_id', 'pluggy:b-aviso')).data ?? []
      if (!found.length) await new Promise((ok) => setTimeout(ok, 250))
    }
    expect(found).toHaveLength(1)
    // item que ninguém tem: responde e não faz nada
    expect((await hook(WEBHOOK_KEY, { event: 'item/updated', itemId: '33333333-2222-4333-8444-555555555555' })).status).toBe(200)
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

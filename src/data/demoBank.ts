// Demonstração: "conectar" um banco cria uma conta, um cartão e lançamentos de EXEMPLO (nada real),
// para quem testa ver como o app fica com o banco ligado.
import type { Backend } from './backend'
import type { Institution } from '../lib/institutions'
import { addDaysISO, todayISO } from '../lib/dates'

/** Número "aleatório" fixo por banco (cada banco mostra valores diferentes, sempre os mesmos). */
function seeded(key: string) {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const SPENDS: [string, string, number, number][] = [
  // descrição, categoria, mínimo, máximo (em reais)
  ['iFood', 'Delivery', 28, 75],
  ['Uber', 'Transporte', 12, 38],
  ['Mercado Assaí', 'Mercado', 40, 110],
  ['Padaria', 'Mercado', 9, 26],
  ['Shopee', 'Compras online', 25, 120],
  ['Farmácia', 'Saúde', 18, 90],
  ['Cinema', 'Lazer', 30, 60],
  ['Posto de gasolina', 'Transporte', 30, 80],
  ['Lanchonete', 'Delivery', 15, 40],
  ['Mercado Livre', 'Compras online', 30, 90],
]

export async function connectDemoBank(b: Backend, inst: Institution): Promise<{ accounts: number; imported: number }> {
  const rnd = seeded(inst.key)
  const money = (min: number, max: number) => Math.round((min + rnd() * (max - min)) * 100)
  const today = todayISO()
  const cats = await b.list('categories')
  const catId = (name: string) => cats.find((c) => c.name === name)?.id ?? null

  const connId = crypto.randomUUID()
  await b.insert('bank_connections', [{ id: connId, item_id: `demo-${inst.key}-${connId.slice(0, 8)}`, label: inst.name, status: 'ok', last_sync_at: new Date().toISOString(), last_error: null }])
  const bankId = crypto.randomUUID()
  const cardId = crypto.randomUUID()
  const limit = money(1500, 6000)
  const invoice = money(350, 1400)
  const due = addDaysISO(today, 6 + Math.floor(rnd() * 12))
  await b.insert('bank_accounts', [
    { id: bankId, connection_id: connId, external_id: `demo:${bankId}`, type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: `${inst.name} conta`, balance_cents: money(80, 1900), credit_limit_cents: null, available_cents: null, due_date: null, close_date: null, updated_at: new Date().toISOString() },
    { id: cardId, connection_id: connId, external_id: `demo:${cardId}`, type: 'CREDIT', subtype: 'CREDIT_CARD', name: `${inst.name} cartão`, balance_cents: invoice, credit_limit_cents: limit, available_cents: Math.max(0, limit - invoice), due_date: due, close_date: addDaysISO(due, -7), updated_at: new Date().toISOString() },
  ])

  // Lançamentos dos últimos 12 dias (débito/Pix na conta e compras no cartão)
  const rows = []
  // Poucos e pequenos: a demonstração já tem gastos; o banco só mostra como os lançamentos entram sozinhos
  const n = 4 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const [description, cat, min, max] = SPENDS[Math.floor(rnd() * SPENDS.length)]
    const card = rnd() < 0.55
    rows.push({
      kind: 'expense' as const, type: 'dia' as const, amount_cents: money(min, max), date: addDaysISO(today, -Math.floor(rnd() * 12)), description,
      category_id: catId(cat), recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null,
      paid: true, skipped: false, note: null, source: 'banco' as const, external_id: `demo:${crypto.randomUUID()}`, bank_account_id: card ? cardId : bankId,
    })
  }
  // Uma compra parcelada no cartão (3/10) e um Pix recebido
  rows.push({
    kind: 'expense' as const, type: 'parcela' as const, amount_cents: money(40, 90), date: addDaysISO(today, -3), description: 'Magazine Luiza',
    category_id: catId('Compras online'), recurring_id: null, installment_group: crypto.randomUUID(), installment_no: 3, installment_total: 10, emotion: null,
    paid: true, skipped: false, note: null, source: 'banco' as const, external_id: `demo:${crypto.randomUUID()}`, bank_account_id: cardId,
  })
  rows.push({
    kind: 'income' as const, type: 'extra' as const, amount_cents: money(50, 200), date: addDaysISO(today, -5), description: 'Pix de Maria',
    category_id: catId('Renda extra'), recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null,
    // Como no app de verdade: dinheiro que entra na conta aparece no extrato, mas não vira renda sozinho
    paid: true, skipped: true, note: null, source: 'banco' as const, external_id: `demo:${crypto.randomUUID()}`, bank_account_id: bankId,
  })
  await b.insert('transactions', rows)
  return { accounts: 2, imported: rows.length }
}

/** Desconectar na demonstração: some a conexão e as contas (os lançamentos ficam, como no app de verdade). */
export async function disconnectDemoBank(b: Backend, connectionId: string) {
  const accounts = (await b.list('bank_accounts')).filter((a) => a.connection_id === connectionId)
  if (accounts.length) await b.remove('bank_accounts', accounts.map((a) => a.id))
  await b.remove('bank_connections', [connectionId])
}

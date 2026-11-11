import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../types'
import { categoryStatuses, spendToday, summarizeMonth } from './budget'
import { buildFacts, cutPlan, dailyByCategory, localAnswer, purchaseImpact, purchaseLines, type CoachInput } from './coach'
import { financialHealth } from './health'

const TODAY = '2026-11-10'
let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  return {
    id: `t${++n}`, user_id: 'u', kind: type === 'salario' || type === 'extra' ? 'income' : 'expense', type, amount_cents: 1000, date: TODAY, description: 'segredo da pessoa',
    category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
  }
}
const cat = (id: string, name: string, grp: Category['grp']): Category => ({ id, user_id: 'u', name, icon: 'x', color: '#000', kind: 'expense', grp, monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '' })
const cats = [cat('del', 'Delivery', 'desejo'), cat('mer', 'Mercado', 'necessidade'), cat('lzr', 'Lazer', 'desejo')]

// R$ 3.000; nos 3 meses anteriores: delivery R$ 400, mercado R$ 800, lazer R$ 30 por mês
const history = ['2026-08', '2026-09', '2026-10'].flatMap((m) => [
  tx({ type: 'salario', amount_cents: 300000, date: `${m}-05` }),
  tx({ category_id: 'del', amount_cents: 40000, date: `${m}-12` }),
  tx({ category_id: 'mer', amount_cents: 80000, date: `${m}-15` }),
  tx({ category_id: 'lzr', amount_cents: 3000, date: `${m}-20` }),
])
const monthTxs = [tx({ type: 'salario', amount_cents: 300000, date: '2026-11-05' }), tx({ type: 'fixo', amount_cents: 120000, date: '2026-11-06' }), tx({ category_id: 'del', amount_cents: 15000, date: '2026-11-08' })]

function input(): CoachInput {
  const summary = summarizeMonth(monthTxs, 15000)
  const statuses = categoryStatuses(cats, monthTxs, [], monthTxs, TODAY)
  const base = { today: TODAY, monthTxs, history: [...history, ...monthTxs], goals: [], goalMoves: [], categories: cats, hasSalary: true }
  return {
    today: TODAY, salaryCents: 300000, payday: 5, hoursWeek: 44, summary, todayBudget: spendToday(monthTxs, 15000, TODAY), statuses,
    history: base.history, monthTxs, goals: [], subs: { items: [{ key: 'net', description: 'Streaming', monthlyCents: 4000, yearlyCents: 48000, source: 'fixo', categoryId: null }], yearlyCents: 48000 },
    health: financialHealth(base),
  }
}

describe('assistente: as contas são do app', () => {
  it('média mensal do dia a dia por categoria (3 meses)', () => {
    const m = dailyByCategory(input())
    expect(m.get('del')).toBe(40000)
    expect(m.get('mer')).toBe(80000)
  })

  it('plano de corte: desejos primeiro, necessidade corta a metade, e o tom muda o tamanho', () => {
    const eq = cutPlan(input(), 'equilibrado')
    expect(eq.items.map((i) => i.label)).toEqual(['Delivery', 'Mercado', 'Streaming']) // lazer < R$ 50 fica de fora
    expect(eq.items[0].saveCents).toBe(8000) // 20% de 400
    expect(eq.items[1].saveCents).toBe(8000) // 10% de 800 (necessidade: metade do corte)
    expect(eq.items[2].saveCents).toBe(4000) // cancelar a assinatura
    expect(eq.monthlyCents).toBe(20000)
    expect(eq.yearlyCents).toBe(240000)
    const soft = cutPlan(input(), 'suave')
    expect(soft.items.some((i) => i.label === 'Streaming')).toBe(false)
    expect(soft.monthlyCents).toBeLessThan(eq.monthlyCents)
    expect(cutPlan(input(), 'agressivo').monthlyCents).toBeGreaterThan(eq.monthlyCents)
  })

  it('nunca sugere cancelar conta essencial (aluguel, ajuda em casa), só assinatura', () => {
    const i = input()
    i.subs = {
      items: [
        { key: 'casa', description: 'Ajuda em casa', monthlyCents: 50000, yearlyCents: 600000, source: 'fixo', categoryId: 'mer' },
        { key: 'aluguel', description: 'Aluguel', monthlyCents: 90000, yearlyCents: 1080000, source: 'fixo', categoryId: null },
        { key: 'net', description: 'Netflix', monthlyCents: 4400, yearlyCents: 52800, source: 'fixo', categoryId: null },
      ],
      yearlyCents: 0,
    }
    const labels = cutPlan(i, 'agressivo').items.map((x) => x.label)
    expect(labels).toContain('Netflix')
    expect(labels).not.toContain('Ajuda em casa')
    expect(labels).not.toContain('Aluguel')
  })

  it('posso comprar? tênis de R$ 300 com R$ 3.000', () => {
    const p = purchaseImpact(input(), 30000)
    expect(p.pctSalary).toBe(0.1)
    expect(p.work).toBe('19 h') // 44 h por semana ≈ 190 h no mês
    // sobra prevista: 3.000 − 1.200 − 150 guardar − 150 delivery = 1.500 → depois do tênis 1.200
    expect(p.freeAfterCents).toBe(120000)
    expect(p.verdict).toBe('cabe')
    expect(purchaseLines(p, 'Tênis').at(-1)).toBe('Conclusão do app: cabe no orçamento.')
  })

  it('compra maior que a sobra não cabe; parcelado mostra quanto tempo para juntar à vista', () => {
    expect(purchaseImpact(input(), 200000).verdict).toBe('nao-cabe')
    const p = purchaseImpact(input(), 300000, 10)
    expect(p.perInstallmentCents).toBe(30000)
    expect(p.monthsToSave).toBe(2) // 3.000 ÷ 1.500 de sobra
    expect(purchaseLines(p, 'Celular')[0]).toBe('Compra: Celular de R$ 3.000,00 em 10x de R$ 300,00 (sem contar juros).')
  })

  it('o resumo para a IA não leva descrições dos lançamentos', () => {
    const facts = buildFacts(input())
    expect(facts).toContain('Salário: R$ 3.000,00 por mês, cai todo dia 5.')
    expect(facts).toContain('Delivery (desejo)')
    expect(facts).not.toContain('segredo da pessoa')
  })

  it('resposta automática (sem IA) usa os números do app', () => {
    expect(localAnswer('corte', input(), 'equilibrado')).toContain('R$ 200,00 por mês')
    const p = purchaseImpact(input(), 30000)
    expect(localAnswer('comprar', input(), 'equilibrado', { purchase: p, item: 'Tênis' })).toMatch(/^Cabe no seu orçamento\./)
  })
})

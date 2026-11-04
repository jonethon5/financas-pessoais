import { describe, expect, it } from 'vitest'
import type { BudgetMove, Category, Recurring, Transaction } from '../types'
import { categoryStatuses, coverOptions, levelOf, quickPicks, rule503020, spendToday, subscriptions, summarizeMonth, weekRange } from './budget'
import { buildInstallments } from './installments'
import { expectedMonthRows, missingRows, recurringActiveIn, stableId } from './recurring'

let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  return {
    id: `t${++n}`,
    user_id: 'u',
    kind: type === 'salario' || type === 'extra' ? 'income' : 'expense',
    type,
    amount_cents: 1000,
    date: '2026-11-04',
    description: 'Gasto',
    category_id: null,
    recurring_id: null,
    installment_group: null,
    installment_no: null,
    installment_total: null,
    emotion: null,
    paid: true,
    skipped: false,
    note: null,
    created_at: '2026-11-04T10:00:00Z',
    ...p,
  }
}
function cat(p: Partial<Category>): Category {
  return { id: 'c', user_id: 'u', name: 'Cat', icon: 'receipt', color: '#000000', kind: 'expense', grp: 'desejo', monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '', ...p }
}
const rec = (p: Partial<Recurring>): Recurring => ({ id: 'r1', user_id: 'u', description: 'Telefone', category_id: null, amount_cents: 3900, day: 10, remind: true, start_month: '2026-01', end_month: null, active: true, created_at: '', ...p })

// Mês de exemplo (novembro/2026, 30 dias): salário 3.000, extra 200, fixos 1.000, parcela 300, guardar 400
const month = [
  tx({ type: 'salario', amount_cents: 300000, date: '2026-11-05' }),
  tx({ type: 'extra', amount_cents: 20000, date: '2026-11-08' }),
  tx({ type: 'fixo', amount_cents: 100000, date: '2026-11-10' }),
  tx({ type: 'parcela', amount_cents: 30000, date: '2026-11-15' }),
  tx({ type: 'dia', amount_cents: 5000, date: '2026-11-01' }),
  tx({ type: 'dia', amount_cents: 2500, date: '2026-11-03' }),
  tx({ type: 'dia', amount_cents: 1200, date: '2026-11-04' }),
  tx({ type: 'fixo', amount_cents: 99999, date: '2026-11-12', skipped: true }),
]

describe('resumo do mês', () => {
  it('soma por tipo e ignora fixo pulado', () => {
    const s = summarizeMonth(month, 40000)
    expect(s).toEqual({ salary: 300000, extra: 20000, income: 320000, fixed: 100000, installments: 30000, committed: 130000, daily: 8700, save: 40000, free: 320000 - 130000 - 40000 - 8700 })
  })
})

describe('quanto posso gastar hoje', () => {
  it('(renda − comprometido − guardar − gasto até ontem) ÷ dias que faltam, e desconta o de hoje', () => {
    const t = spendToday(month, 40000, '2026-11-04')
    // disponível = 320.000 − 130.000 − 40.000 − 7.500 = 142.500; faltam 27 dias (4 a 30)
    expect(t.daysLeft).toBe(27)
    expect(t.availableFromToday).toBe(142500)
    expect(t.dailyAllowance).toBe(Math.floor(142500 / 27)) // 5.277
    expect(t.spentToday).toBe(1200)
    expect(t.leftToday).toBe(5277 - 1200)
  })
  it('no último dia sobra tudo para hoje', () => {
    const t = spendToday(month, 40000, '2026-11-30')
    expect(t.daysLeft).toBe(1)
    expect(t.dailyAllowance).toBe(320000 - 130000 - 40000 - 8700)
  })
  it('sem dinheiro disponível o valor do dia é zero, e o gasto de hoje aparece como excesso', () => {
    const t = spendToday([tx({ type: 'fixo', amount_cents: 5000 }), tx({ type: 'dia', amount_cents: 700, date: '2026-11-04' })], 0, '2026-11-04')
    expect(t.dailyAllowance).toBe(0)
    expect(t.leftToday).toBe(-700)
  })
  it('gastar menos hoje aumenta o valor dos próximos dias', () => {
    const amanhaSemGastar = spendToday(month.filter((t) => t.date !== '2026-11-04'), 40000, '2026-11-05').dailyAllowance
    const amanhaGastando = spendToday(month, 40000, '2026-11-05').dailyAllowance
    expect(amanhaSemGastar).toBeGreaterThan(amanhaGastando)
  })
})

describe('orçamento por categoria', () => {
  it('alerta em 80% e 100%', () => {
    expect(levelOf(7999, 10000)).toBe('ok')
    expect(levelOf(8000, 10000)).toBe('warn')
    expect(levelOf(10000, 10000)).toBe('over')
    expect(levelOf(500, null)).toBe('ok')
  })
  it('semana de segunda a domingo', () => {
    expect(weekRange('2026-11-04')).toEqual({ start: '2026-11-02', end: '2026-11-08' }) // quarta
    expect(weekRange('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' }) // domingo
    expect(weekRange('2026-11-30')).toEqual({ start: '2026-11-30', end: '2026-12-06' })
  })
  it('limite mensal com movimentações e limite semanal só do dia a dia', () => {
    const lazer = cat({ id: 'lazer', monthly_limit_cents: 20000, weekly_limit_cents: 5000 })
    const mercado = cat({ id: 'mercado', monthly_limit_cents: 80000 })
    const txs = [
      tx({ category_id: 'lazer', amount_cents: 15000, date: '2026-11-01' }), // semana anterior
      tx({ category_id: 'lazer', amount_cents: 6000, date: '2026-11-03' }),
      tx({ category_id: 'mercado', amount_cents: 30000, date: '2026-11-02' }),
    ]
    const moves: BudgetMove[] = [{ id: 'm', user_id: 'u', month: '2026-11', from_category: 'mercado', to_category: 'lazer', amount_cents: 5000, created_at: '' }]
    const [l, m] = categoryStatuses([lazer, mercado], txs, moves, txs, '2026-11-04')
    expect(l).toMatchObject({ spent: 21000, limit: 25000, level: 'warn', weekSpent: 6000, weekLimit: 5000, weekLevel: 'over' })
    expect(m).toMatchObject({ spent: 30000, limit: 75000, level: 'ok' })
    expect(coverOptions([l, m], 'lazer')).toEqual([{ category: mercado, available: 45000 }])
  })
})

describe('regra 50/30/20', () => {
  it('separa necessidades e desejos em % da renda', () => {
    const casa = cat({ id: 'casa', grp: 'necessidade' })
    const r = rule503020([tx({ type: 'salario', amount_cents: 200000 }), tx({ type: 'fixo', category_id: 'casa', amount_cents: 100000 }), tx({ amount_cents: 30000 })], [casa], 40000)
    expect(r.pct).toEqual({ needs: 50, wants: 15, save: 20 })
  })
})

describe('caçador de assinaturas', () => {
  it('lista os fixos e acha o que se repete no dia a dia', () => {
    const history = ['2026-08-03', '2026-09-03', '2026-10-04'].map((date) => tx({ description: 'Spotify', amount_cents: 2190, date }))
    history.push(tx({ description: 'iFood', amount_cents: 4000, date: '2026-09-01' }), tx({ description: 'iFood', amount_cents: 9000, date: '2026-10-01' }), tx({ description: 'ifood', amount_cents: 2000, date: '2026-11-01' }))
    const r = subscriptions([rec({ description: 'YouTube Music', amount_cents: 1200 })], history)
    expect(r.items.map((i) => [i.description, i.yearlyCents, i.source])).toEqual([
      ['Spotify', 26280, 'detectado'],
      ['YouTube Music', 14400, 'fixo'],
    ])
    expect(r.yearlyCents).toBe(40680)
  })
})

describe('lançamento rápido', () => {
  it('os mais frequentes primeiro, com o último valor', () => {
    const picks = quickPicks([
      tx({ description: 'Uber', amount_cents: 1800, date: '2026-11-01' }),
      tx({ description: 'uber', amount_cents: 2200, date: '2026-11-03' }),
      tx({ description: 'iFood', amount_cents: 4500, date: '2026-11-02' }),
    ])
    expect(picks).toEqual([
      { description: 'uber', categoryId: null, amountCents: 2200, times: 2 },
      { description: 'iFood', categoryId: null, amountCents: 4500, times: 1 },
    ])
  })
})

describe('parcelas', () => {
  it('total dividido no centavo, nos meses certos', () => {
    const p = buildInstallments({ amountCents: 100000, mode: 'total', count: 3, firstDate: '2026-12-31' })
    expect(p.map((i) => [i.no, i.date, i.amountCents])).toEqual([
      [1, '2026-12-31', 33334],
      [2, '2027-01-31', 33333],
      [3, '2027-02-28', 33333],
    ])
  })
  it('valor de cada parcela', () => {
    const p = buildInstallments({ amountCents: 15000, mode: 'parcela', count: 10, firstDate: '2026-11-10' })
    expect(p).toHaveLength(10)
    expect(p.reduce((a, i) => a + i.amountCents, 0)).toBe(150000)
    expect(p[9]).toEqual({ no: 10, total: 10, date: '2027-08-10', amountCents: 15000 })
  })
  it('recusa entradas inválidas', () => {
    expect(() => buildInstallments({ amountCents: 1, mode: 'total', count: 3, firstDate: '2026-11-01' })).toThrow()
    expect(() => buildInstallments({ amountCents: 1000, mode: 'total', count: 1, firstDate: '2026-11-01' })).toThrow()
  })
})

describe('salário e fixos automáticos', () => {
  it('id estável: o mesmo mês gera o mesmo id', async () => {
    expect(await stableId('a')).toBe(await stableId('a'))
    expect(await stableId('a')).not.toBe(await stableId('b'))
    expect(await stableId('a')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('respeita início, fim e pausa do fixo', () => {
    expect(recurringActiveIn(rec({ start_month: '2026-12' }), { year: 2026, month: 11 })).toBe(false)
    expect(recurringActiveIn(rec({ end_month: '2026-10' }), { year: 2026, month: 11 })).toBe(false)
    expect(recurringActiveIn(rec({ active: false }), { year: 2026, month: 11 })).toBe(false)
    expect(recurringActiveIn(rec({}), { year: 2026, month: 11 })).toBe(true)
  })
  it('cria salário no dia do pagamento e os fixos, sem repetir os que já existem', async () => {
    const rows = await expectedMonthRows({ year: 2027, month: 2 }, 'u', { salary_cents: 250000, payday: 31 }, [rec({})], 'sal')
    expect(rows.map((r) => [r.type, r.date, r.amount_cents])).toEqual([
      ['salario', '2027-02-28', 250000],
      ['fixo', '2027-02-10', 3900],
    ])
    expect(missingRows(rows, [{ id: rows[0].id }])).toEqual([rows[1]])
    const semSalario = await expectedMonthRows({ year: 2027, month: 2 }, 'u', { salary_cents: null, payday: 5 }, [], null)
    expect(semSalario).toEqual([])
  })
})

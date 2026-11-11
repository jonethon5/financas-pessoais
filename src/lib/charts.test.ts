import { describe, expect, it } from 'vitest'
import type { BankAccount, Category, Transaction } from '../types'
import { summarizeMonth } from './budget'
import { average, balanceProjection, byCategory, byMethod, byRecurrence, dailySpend, monthlySeries, salaryFlow, savedSeries } from './charts'

const NOV = { year: 2026, month: 11 }
let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  return {
    id: `t${++n}`, user_id: 'u', kind: type === 'salario' || type === 'extra' ? 'income' : 'expense', type, amount_cents: 1000, date: '2026-11-10', description: 'x',
    category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
  }
}
const cat = (id: string, name: string): Category => ({ id, user_id: 'u', name, icon: 'x', color: '#123456', kind: 'expense', grp: 'desejo', monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '' })

// Novembro: salário 3.000, aluguel 1.000 (dia 10), parcela 200, iFood 300 + 100, mercado 400; um gasto pulado não conta
const month = [
  tx({ type: 'salario', amount_cents: 300000, date: '2026-11-05' }),
  tx({ type: 'fixo', amount_cents: 100000, date: '2026-11-10', category_id: 'casa' }),
  tx({ type: 'parcela', amount_cents: 20000, date: '2026-11-15', category_id: 'compras' }),
  tx({ amount_cents: 30000, date: '2026-11-06', category_id: 'ifood', bank_account_id: 'card' }),
  tx({ amount_cents: 10000, date: '2026-11-08', category_id: 'ifood' }),
  tx({ amount_cents: 40000, date: '2026-11-09', category_id: 'mercado', bank_account_id: 'conta' }),
  tx({ amount_cents: 99999, date: '2026-11-09', skipped: true }),
]
const cats = [cat('casa', 'Casa'), cat('ifood', 'Delivery'), cat('mercado', 'Mercado'), cat('compras', 'Compras')]

describe('gráficos', () => {
  it('ranking por categoria, com porcentagem', () => {
    const r = byCategory(month, 'expense', cats)
    expect(r.map((x) => x.cents)).toEqual([100000, 40000, 40000, 20000])
    expect(r[0].name).toBe('Casa')
    expect(r.at(-1)!.name).toBe('Compras')
    expect(r[0].pct).toBe(0.5)
  })

  it('por recorrência: fixos, parcelas e dia a dia', () => {
    expect(byRecurrence(month, 'expense').map((p) => p.cents)).toEqual([100000, 20000, 80000])
    expect(byRecurrence(month, 'income').map((p) => p.cents)).toEqual([300000, 0])
  })

  it('débito × crédito pelo banco; o resto é "lançado à mão"', () => {
    const accounts = [{ id: 'card', type: 'CREDIT' }, { id: 'conta', type: 'BANK' }] as BankAccount[]
    expect(byMethod(month, accounts).map((p) => p.cents)).toEqual([30000, 40000, 130000])
  })

  it('renda e gastos dos últimos meses, do mais antigo ao mais novo', () => {
    const s = monthlySeries([...month, tx({ type: 'salario', amount_cents: 250000, date: '2026-10-05' })], NOV, 3)
    expect(s.map((p) => p.key)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(s[2]).toMatchObject({ income: 300000, expense: 200000, balance: 100000 })
    expect(average(s.map((p) => p.income))).toBe(275000) // meses vazios não puxam a média para baixo
  })

  it('saldo do mês: real até hoje e previsão depois (contas marcadas + média do dia a dia)', () => {
    const p = balanceProjection(month, NOV, '2026-11-10')
    // até dia 10: +3.000 − 300 − 100 − 400 − 1.000 = 1.200
    expect(p[9]).toEqual({ day: 10, real: 120000, previsto: 120000 })
    // depois: média de 800 em 10 dias = 80 por dia; dia 15 tem a parcela de 200
    expect(p[14].real).toBeNull()
    expect(p[14].previsto).toBe(120000 - 5 * 8000 - 20000)
    expect(p).toHaveLength(30)
  })

  it('mapa de calor: gasto do dia a dia por dia', () => {
    const d = dailySpend(month, NOV)
    expect(d[5].cents).toBe(30000)
    expect(d[8].cents).toBe(40000) // o gasto pulado não conta
    expect(d[9].cents).toBe(0) // aluguel é fixo, não dia a dia
  })

  it('para onde vai o dinheiro: a sobra é a mesma da tela inicial', () => {
    const s = summarizeMonth(month, 50000)
    const f = salaryFlow(s)
    expect(f.map((x) => [x.key, x.cents])).toEqual([['fixo', 100000], ['parcela', 20000], ['dia', 80000], ['caixinhas', 50000], ['sobra', 50000]])
    expect(f.find((x) => x.key === 'sobra')!.cents).toBe(s.free)
    expect(f.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(1)
  })

  it('evolução do que está guardado', () => {
    const moves = [{ amount_cents: 10000, date: '2026-09-02' }, { amount_cents: 5000, date: '2026-11-01' }, { amount_cents: -2000, date: '2026-11-03' }] as never
    expect(savedSeries(moves, NOV, 3).map((x) => x.saved)).toEqual([10000, 10000, 13000])
  })
})

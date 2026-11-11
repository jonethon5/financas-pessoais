import { describe, expect, it } from 'vitest'
import type { Category, Goal, GoalMove, Transaction } from '../types'
import { goalStatus } from './goals'
import { financialHealth, healthLabel, type HealthInput } from './health'
import { LESSONS } from './learn'

const TODAY = '2026-11-20'
const NOV = { year: 2026, month: 11 }
let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  return {
    id: `t${++n}`, user_id: 'u', kind: type === 'salario' || type === 'extra' ? 'income' : 'expense', type, amount_cents: 1000, date: '2026-11-04', description: 'x',
    category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
  }
}
const goal = (p: Partial<Goal>): Goal => ({ id: 'g', user_id: 'u', name: 'Meta', template: 'livre', icon: 'piggy', color: '#000', photo_path: null, motivation: null, concrete_name: null, concrete_cents: null, mode: 'mensal', target_cents: 100000, target_month: null, monthly_cents: 10000, priority: 1, archived: false, completed_at: null, created_at: '', ...p })
const move = (amount: number, date: string, goalId = 'g', kind: GoalMove['kind'] = 'deposito'): GoalMove => ({ id: `m${++n}`, user_id: 'u', goal_id: goalId, kind, amount_cents: amount, date, note: null, created_at: '' })
const cat = (limit: number | null): Category => ({ id: 'c', user_id: 'u', name: 'Mercado', icon: 'cart', color: '#000', kind: 'expense', grp: 'necessidade', monthly_limit_cents: limit, weekly_limit_cents: null, sort: 0, archived: false, created_at: '' })

/** Um mês de quem ganha R$ 3.000 e gasta `spent`. */
const monthOf = (ym: string, spent: number) => [tx({ type: 'salario', amount_cents: 300000, date: `${ym}-05` }), tx({ type: 'fixo', amount_cents: spent, date: `${ym}-10` })]

function input(p: Partial<HealthInput> & { moves?: GoalMove[]; goalList?: Goal[] }): HealthInput {
  const moves = p.moves ?? []
  const goals = (p.goalList ?? []).map((g) => ({ goal: g, status: goalStatus(g, moves, NOV) }))
  return { today: TODAY, monthTxs: [], history: [], goals, goalMoves: moves, categories: [], hasSalary: true, ...p }
}

describe('saúde financeira', () => {
  it('pessoa organizada com R$ 3.000: nota alta', () => {
    const history = [...monthOf('2026-08', 250000), ...monthOf('2026-09', 250000), ...monthOf('2026-10', 250000)]
    const reserva = goal({ id: 'r', template: 'reserva', name: 'Reserva', target_cents: 750000 })
    const moves = [move(750000, '2026-08-06', 'r'), move(10000, '2026-09-06', 'r'), move(10000, '2026-10-06', 'r'), move(10000, '2026-11-06', 'r')]
    const h = financialHealth(input({ history, monthTxs: monthOf('2026-11', 250000), goalList: [reserva], moves, categories: [cat(60000)] }))
    expect(h.score).toBe(100)
    expect(h.label).toBe('Saudável')
    expect(h.next).toHaveLength(0)
  })

  it('gasta mais do que ganha e sem reserva: nota baixa e o próximo passo é a reserva', () => {
    const history = [...monthOf('2026-09', 330000), ...monthOf('2026-10', 330000)]
    const h = financialHealth(input({ history, monthTxs: monthOf('2026-11', 330000) }))
    const p = Object.fromEntries(h.pillars.map((x) => [x.id, x]))
    expect(p.gastos.score).toBe(10) // 110% da renda
    expect(p.gastos.status).toBe('Os gastos passaram 10% da renda.')
    expect(p.reserva.score).toBe(0)
    expect(h.next[0].id).toBe('reserva') // é o que mais perde pontos (25)
    expect(h.score!).toBeLessThan(40)
  })

  it('conta vencida derruba o pilar de contas', () => {
    const monthTxs = [tx({ type: 'salario', amount_cents: 300000, date: '2026-11-05' }), tx({ type: 'fixo', amount_cents: 50000, date: '2026-11-10', paid: false }), tx({ type: 'fixo', amount_cents: 9000, date: '2026-11-25', paid: false })]
    const h = financialHealth(input({ monthTxs }))
    const contas = h.pillars.find((x) => x.id === 'contas')!
    expect(contas.score).toBe(8) // 1 vencida; a do dia 25 ainda não venceu
    expect(contas.status).toBe('1 conta passou do vencimento.')
  })

  it('reserva de 1 mês e meio vale metade do pilar', () => {
    const history = [...monthOf('2026-10', 200000)]
    const reserva = goal({ id: 'r', template: 'reserva', name: 'Reserva', target_cents: 600000 })
    const h = financialHealth(input({ history, goalList: [reserva], moves: [move(300000, '2026-10-06', 'r')] }))
    const r = h.pillars.find((x) => x.id === 'reserva')!
    expect(r.score).toBe(13) // 1,5 / 3 de 25 = 12,5
    expect(r.status).toBe('A reserva cobre uns 45 dias de gastos.')
  })

  it('reserva criada mas vazia: diz isso, sem "0 dias"', () => {
    const reserva = goal({ id: 'r', template: 'reserva', name: 'Reserva', target_cents: 600000 })
    const r = financialHealth(input({ history: monthOf('2026-10', 200000), goalList: [reserva] })).pillars.find((x) => x.id === 'reserva')!
    expect(r.status).toBe('A caixinha da reserva existe, mas ainda está vazia.')
    expect(r.tip).toBe('Leve a reserva primeiro aos R$ 500.')
  })

  it('sem nenhum dado: não inventa nota', () => {
    const h = financialHealth(input({ hasSalary: false }))
    expect(h.pillars.find((x) => x.id === 'gastos')!.score).toBeNull()
    expect(h.pillars.find((x) => x.id === 'contas')!.score).toBeNull()
    expect(h.score).not.toBeNull() // reserva, guardar e plano dão 55 pontos medidos
    expect(h.score).toBe(0)
  })

  it('todas as dicas apontam para lições que existem', () => {
    const h = financialHealth(input({ history: monthOf('2026-10', 330000), monthTxs: monthOf('2026-11', 280000) }))
    for (const p of h.pillars) expect(LESSONS.some((l) => l.id === p.lesson), p.lesson).toBe(true)
  })

  it('rótulos sem bronca', () => {
    expect(healthLabel(85)).toBe('Saudável')
    expect(healthLabel(65)).toBe('No caminho certo')
    expect(healthLabel(45)).toBe('Pede atenção')
    expect(healthLabel(10)).toBe('Apertado, mas dá para virar')
  })
})

import { describe, expect, it } from 'vitest'
import type { Goal, GoalMove } from '../types'
import { crossedMilestones, distribute, emergencySuggestion, goalStatus, monthGoalPlan, withdrawImpact } from './goals'

const NOV = { year: 2026, month: 11 }

function goal(p: Partial<Goal>): Goal {
  return { id: 'g', user_id: 'u', name: 'Meta', template: 'livre', icon: 'piggy', color: '#000000', photo_path: null, mode: 'mensal', target_cents: 100000, target_month: null, monthly_cents: 10000, priority: 1, archived: false, completed_at: null, created_at: '2026-01-01', ...p }
}
let n = 0
const move = (amount: number, date: string, kind: GoalMove['kind'] = amount < 0 ? 'retirada' : 'deposito', goalId = 'g'): GoalMove => ({ id: `m${++n}`, user_id: 'u', goal_id: goalId, kind, amount_cents: amount, date, note: null, created_at: '' })

describe('caixinha por data', () => {
  const viagem = goal({ mode: 'data', target_cents: 600000, target_month: '2027-07', monthly_cents: null })
  it('R$ 6.000 até julho: quanto guardar por mês e por semana (de novembro a julho são 9 meses)', () => {
    const s = goalStatus(viagem, [move(150000, '2026-10-01', 'inicial')], NOV)
    expect(s.perMonth).toBe(50000) // (6.000 − 1.500) / 9
    expect(s.perWeek).toBe(11600) // 500 × 12 / 52 = 115,38 → arredonda para cima no real: 116,00
    expect(s.needThisMonth).toBe(50000)
    expect(s.eta).toEqual({ year: 2027, month: 7 })
  })
  it('depósito do mês diminui o que falta neste mês, sem mudar o plano', () => {
    const s = goalStatus(viagem, [move(150000, '2026-10-01', 'inicial'), move(20000, '2026-11-05')], NOV)
    expect(s.perMonth).toBe(50000)
    expect(s.needThisMonth).toBe(30000)
  })
  it('mês sem guardar: recalcula sozinho para os meses que restam (sem bronca)', () => {
    const s = goalStatus(viagem, [move(150000, '2026-10-01', 'inicial')], { year: 2026, month: 12 })
    expect(s.perMonth).toBe(56300) // 4.500 / 8 = 562,50 → 563,00
  })
  it('passou da data sem chegar: atrasada, pede o resto agora', () => {
    const s = goalStatus(viagem, [move(500000, '2026-10-01', 'inicial')], { year: 2027, month: 8 })
    expect(s.late).toBe(true)
    expect(s.perMonth).toBe(100000)
  })
})

describe('caixinha por valor mensal', () => {
  const reserva = goal({ mode: 'mensal', target_cents: 900000, monthly_cents: 30000 })
  it('R$ 300/mês: quando chega lá', () => {
    // já tem 2.700; com os 300 deste mês fica 3.000; faltam 6.000 = 20 meses depois deste
    const s = goalStatus(reserva, [move(270000, '2026-06-01', 'inicial')], NOV)
    expect(s.eta).toEqual({ year: 2028, month: 7 })
    expect(s.progress).toBeCloseTo(0.3)
  })
  it('guardar mais adianta a data', () => {
    const s = goalStatus(reserva, [move(270000, '2026-06-01', 'inicial'), move(90000, '2026-11-02')], NOV)
    // 3.600 guardados; faltam 5.400 / 300 = 18 meses
    expect(s.eta).toEqual({ year: 2028, month: 5 })
  })
  it('meta batida: completa, sem plano', () => {
    const s = goalStatus(reserva, [move(900000, '2026-06-01', 'inicial')], NOV)
    expect(s.done).toBe(true)
    expect(s.perMonth).toBe(0)
  })
})

describe('caixinha sem valor final', () => {
  it('só acumula; o valor mensal, se houver, entra no plano', () => {
    const s = goalStatus(goal({ mode: 'livre', target_cents: null, monthly_cents: 5000 }), [move(12000, '2026-11-01')], NOV)
    expect(s.target).toBeNull()
    expect(s.progress).toBeNull()
    expect(s.perMonth).toBe(5000)
    expect(s.needThisMonth).toBe(0)
  })
})

describe('plano do mês', () => {
  it('soma o que cada caixinha pede (as completas não contam)', () => {
    const a = goalStatus(goal({ id: 'a', target_cents: 100000, monthly_cents: 10000 }), [], NOV)
    const b = goalStatus(goal({ id: 'b', target_cents: 100000, monthly_cents: 20000 }), [move(100000, '2026-01-01', 'inicial', 'b')], NOV)
    expect(monthGoalPlan([a, b])).toBe(10000)
  })
})

describe('freio para retirar', () => {
  it('tirar R$ 500 da viagem atrasa 1 mês no ritmo de R$ 500/mês, ou pede R$ 63 a mais por mês', () => {
    const viagem = goal({ mode: 'data', target_cents: 600000, target_month: '2027-07', monthly_cents: null })
    const moves = [move(150000, '2026-10-01', 'inicial')]
    expect(withdrawImpact(viagem, moves, 50000, NOV)).toEqual({ delayMonths: 1, extraPerMonth: 5600, progressAfter: 100000 / 600000 })
  })
  it('na mensal, conta quantos meses a data de chegada anda', () => {
    const reserva = goal({ mode: 'mensal', target_cents: 900000, monthly_cents: 30000 })
    expect(withdrawImpact(reserva, [move(270000, '2026-06-01', 'inicial')], 60000, NOV).delayMonths).toBe(2)
  })
})

describe('marcos', () => {
  it('avisa os marcos que o depósito passou', () => {
    expect(crossedMilestones(20000, 52000, 100000)).toEqual([0.25, 0.5])
    expect(crossedMilestones(99000, 100000, 100000)).toEqual([1])
    expect(crossedMilestones(30000, 40000, 100000)).toEqual([])
    expect(crossedMilestones(0, 100, null)).toEqual([])
  })
})

describe('sobra por prioridade', () => {
  it('completa o mês de cada caixinha na ordem e o resto vai para a primeira', () => {
    const a = goal({ id: 'a', priority: 1, monthly_cents: 10000 })
    const b = goal({ id: 'b', priority: 2, monthly_cents: 20000 })
    const list = [b, a].map((g) => ({ goal: g, status: goalStatus(g, [], NOV) }))
    expect(distribute(25000, list)).toEqual([
      { goalId: 'a', cents: 10000 },
      { goalId: 'b', cents: 15000 },
    ])
    expect(distribute(40000, list)).toEqual([
      { goalId: 'a', cents: 20000 },
      { goalId: 'b', cents: 20000 },
    ])
  })
})

describe('reserva de emergência', () => {
  it('sugere 6 meses de gastos', () => {
    expect(emergencySuggestion(150050)).toBe(900300)
  })
})

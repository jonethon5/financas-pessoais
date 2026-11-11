import { describe, expect, it } from 'vitest'
import type { GoalMove, Transaction } from '../types'
import { balance, dayGoals, pendingRewards, pigLine, pigState, type PigInput } from './pig'

// Terça, 10/11/2026. Salário R$ 3.000, fixos R$ 1.200, guardar R$ 300 → R$ 1.500 ÷ 30 = R$ 50 por dia
const TODAY = '2026-11-10'
let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  const date = p.date ?? TODAY
  return {
    id: `t${++n}`, user_id: 'u', kind: type === 'salario' || type === 'extra' ? 'income' : 'expense', type, amount_cents: 1000, date, description: 'x',
    category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null,
    created_at: `${date}T15:00:00Z`, ...p,
  }
}
const move = (amount: number, date: string, goal = 'g', kind: GoalMove['kind'] = 'deposito'): GoalMove => ({ id: `m${++n}`, user_id: 'u', goal_id: goal, kind, amount_cents: amount, date, note: null, created_at: `${date}T15:00:00Z` })
const base = [tx({ type: 'salario', amount_cents: 300000, date: '2026-11-05' }), tx({ type: 'fixo', amount_cents: 120000, date: '2026-11-06' })]

function input(p: Partial<PigInput>): PigInput {
  return { today: TODAY, startDay: '2026-10-01', txs: base, moves: [], goals: [], saveTarget: 30000, payday: 5, ...p }
}

describe('metas do dia', () => {
  it('lançou e guardou contam na hora; limite e dia sem gastar só depois que o dia acaba', () => {
    const txs = [...base, tx({ amount_cents: 2000, date: TODAY })]
    const g = dayGoals(TODAY, TODAY, txs, [move(500, TODAY)], 30000)
    expect(g).toEqual({ lancou: true, guardou: true, no_limite: false, sem_gastar: false })
  })
  it('ontem: gastou R$ 40 de R$ 50 → no limite; anteontem sem gasto nenhum → dia sem gastar', () => {
    const txs = [...base, tx({ amount_cents: 4000, date: '2026-11-09', created_at: '2026-11-09T22:00:00Z' })]
    expect(dayGoals('2026-11-09', TODAY, txs, [], 30000).no_limite).toBe(true)
    expect(dayGoals('2026-11-08', TODAY, txs, [], 30000)).toMatchObject({ sem_gastar: true, no_limite: false })
  })
  it('gasto que veio do banco não conta como "lançou" (só o que a pessoa anotou)', () => {
    expect(dayGoals(TODAY, TODAY, [...base, tx({ source: 'banco' })], [], 30000).lancou).toBe(false)
  })
})

describe('moedas', () => {
  it('1 por meta, nunca antes do começo da conta, e semana completa vale 10', () => {
    // Todos os dias de 02/11 (segunda) a 08/11 (domingo) sem gastar → semana completa
    // (a conta já tinha um lançamento antes: o app só conta "dia sem gastar" depois que a pessoa começou a usar)
    const r = pendingRewards(input({ startDay: '2026-11-02', txs: [...base, tx({ type: 'fixo', amount_cents: 5000, date: '2026-11-01' })] }))
    expect(r.every((x) => x.day >= '2026-11-02')).toBe(true)
    expect(r.find((x) => x.kind === 'semana')).toEqual({ day: '2026-11-08', kind: 'semana', ref: '', coins: 10 })
  })
  it('marco de 50% da caixinha vale 5', () => {
    const moves = [move(40000, '2026-10-01', 'g', 'inicial'), move(20000, '2026-11-09')]
    const r = pendingRewards(input({ moves, goals: [{ id: 'g', target: 100000 }] }))
    expect(r.filter((x) => x.kind === 'marco')).toEqual([{ day: '2026-11-09', kind: 'marco', ref: 'g:50', coins: 5 }])
  })
  it('saldo = ganhas − gastas na loja', () => {
    expect(balance([{ coins: 1 }, { coins: 10 }, { coins: 5 }], [{ price: 12 }])).toBe(4)
  })
})

describe('o porquinho segue a meta da própria pessoa', () => {
  it('meta de R$ 300 cumprida e hábitos em dia → gordinho e feliz', () => {
    const txs = [...base, ...Array.from({ length: 7 }, (_, i) => tx({ amount_cents: 1000, date: `2026-11-${String(10 - i).padStart(2, '0')}`, created_at: `2026-11-${String(10 - i).padStart(2, '0')}T15:00:00Z` }))]
    const s = pigState(input({ txs, moves: [move(30000, '2026-11-05')] }), [])
    expect(s.size).toBe('gordo')
    expect(s.mood).toBe('feliz')
  })
  it('quem guarda R$ 20 de uma meta de R$ 20 fica igual a quem guarda R$ 500 de R$ 500', () => {
    const a = pigState(input({ saveTarget: 2000, moves: [move(2000, '2026-11-06')] }), [])
    const b = pigState(input({ saveTarget: 50000, moves: [move(50000, '2026-11-06')] }), [])
    expect(a.fullness).toBe(b.fullness)
  })
  it('nada guardado e 3 dias sem nada → magrinho e triste (mas nunca morre)', () => {
    const txs = [...base, tx({ amount_cents: 9000, date: '2026-11-08', created_at: '2026-11-06T10:00:00Z' }), tx({ amount_cents: 9000, date: '2026-11-09', created_at: '2026-11-06T10:00:00Z' }), tx({ amount_cents: 9000, date: TODAY, created_at: '2026-11-06T10:00:00Z' })]
    const s = pigState(input({ txs, startDay: '2026-11-06' }), [])
    expect(s.size).toBe('magro')
    expect(s.mood).toBe('triste')
  })
  it('antes do dia do pagamento, vale o que guardou no mês passado', () => {
    const s = pigState(input({ today: '2026-11-03', moves: [move(30000, '2026-10-06')] }), [])
    expect(s.savedRatio).toBe(1)
  })
  it('marco ou semana completa nos últimos 2 dias → festa', () => {
    expect(pigState(input({}), [{ day: '2026-11-09', kind: 'marco' }]).mood).toBe('festa')
  })
  it('fala no tom escolhido', () => {
    expect(pigLine('agressivo', 'triste', 0)).toMatch(/parado/)
    expect(pigLine('suave', 'triste', 1)).toMatch(/Sem culpa/)
  })
})

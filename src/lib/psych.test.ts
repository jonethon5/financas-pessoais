import { describe, expect, it } from 'vitest'
import type { Category, Challenge, Goal, GoalMove, Rule, Transaction, Wish } from '../types'
import {
  challengeProgress, compareText, concreteText, freshStart, hourlyCents, loggingDayStreak, noSpendCalendar, profileFromAnswers, projection,
  roundUp, rulesForTransaction, savedByGivingUp, savingWeekStreak, weekRecap, weeklyLeftover, wishState, workTime,
} from './psych'

let n = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, user_id: 'u', kind: 'expense', type: 'dia', amount_cents: 1000, date: '2026-11-04', description: 'Gasto', category_id: null, recurring_id: null,
  installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
})
const move = (amount: number, date: string, p: Partial<GoalMove> = {}): GoalMove => ({ id: `m${++n}`, user_id: 'u', goal_id: 'g', kind: 'deposito', amount_cents: amount, date, note: null, created_at: '', ...p })
const cat = (id: string, name: string, p: Partial<Category> = {}): Category => ({ id, user_id: 'u', name, icon: 'receipt', color: '#000000', kind: 'expense', grp: 'desejo', monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '', ...p })

describe('horas de trabalho', () => {
  it('salário de R$ 2.200 em 44 h/semana: R$ 11,54 por hora', () => {
    expect(hourlyCents(220000, 44)).toBe(1154)
  })
  it('converte preço em tempo de trabalho', () => {
    expect(workTime(20770, 220000, 44)).toBe('18 h')
    expect(workTime(3000, 220000, 44)).toBe('2 h 36 min')
    expect(workTime(500, 220000, 44)).toBe('26 min')
    expect(workTime(500, null, 44)).toBeNull()
  })
})

describe('isso equivale a…', () => {
  const viagem = { id: 'v', name: 'Viagem', priority: 1, archived: false, concrete_name: 'diária do hotel', concrete_cents: 25000 } as Goal
  it('traduz o gasto no item concreto da caixinha', () => {
    expect(concreteText(12500, [viagem])).toBe('meia diária do hotel (Viagem)')
    expect(concreteText(25000, [viagem])).toBe('1 diária do hotel (Viagem)')
    expect(concreteText(75000, [viagem])).toBe('3× diária do hotel (Viagem)')
    expect(concreteText(2500, [viagem])).toBe('10% de uma diária do hotel (Viagem)')
    expect(concreteText(2500, [])).toBeNull()
  })
})

describe('sequências', () => {
  it('semanas seguidas guardando (a atual conta se já teve depósito)', () => {
    const moves = [move(100, '2026-11-03'), move(100, '2026-10-28'), move(100, '2026-10-20'), move(100, '2026-10-01')]
    expect(savingWeekStreak(moves, '2026-11-04')).toBe(3)
    expect(savingWeekStreak(moves.slice(1), '2026-11-04')).toBe(2) // esta semana ainda não guardou: conta a partir da anterior
    expect(savingWeekStreak([], '2026-11-04')).toBe(0)
  })
  it('dias seguidos lançando', () => {
    const txs = ['2026-11-04', '2026-11-03', '2026-11-02', '2026-10-30'].map((date) => tx({ date }))
    expect(loggingDayStreak(txs, '2026-11-04')).toBe(3)
    expect(loggingDayStreak(txs.slice(1), '2026-11-04')).toBe(2)
  })
  it('calendário de dias sem gastar', () => {
    const cal = noSpendCalendar([tx({ date: '2026-11-02' }), tx({ date: '2026-11-04' })], { year: 2026, month: 11 }, '2026-11-04')
    expect(cal.days.slice(0, 5).map((d) => d.state)).toEqual(['sem-gasto', 'gastou', 'sem-gasto', 'gastou', 'futuro'])
    expect(cal.count).toBe(2)
    expect(cal.leadingBlanks).toBe(6) // 1/11/2026 é domingo
  })
})

describe('desafios', () => {
  const cats = [cat('d', 'Delivery'), cat('o', 'Compras online')]
  const base = { id: 'c', user_id: 'u', title: '', params: {}, goal_id: null, status: 'ativo', created_at: '' } as const
  it('7 dias sem delivery: quebra com gasto em Delivery ou "ifood" na descrição', () => {
    const c: Challenge = { ...base, kind: 'sem_delivery', started_on: '2026-11-01', ends_on: '2026-11-07' }
    expect(challengeProgress(c, [tx({ description: 'Mercado', date: '2026-11-02' })], cats, [], '2026-11-04')).toMatchObject({ failed: false, daysDone: 3, days: 7 })
    expect(challengeProgress(c, [tx({ description: 'iFood lanche', date: '2026-11-02' })], cats, [], '2026-11-04').failed).toBe(true)
    expect(challengeProgress(c, [tx({ category_id: 'd', date: '2026-10-30' })], cats, [], '2026-11-04').failed).toBe(false) // antes do desafio não conta
  })
  it('52 semanas: semana atual e quanto guardar', () => {
    const c: Challenge = { ...base, kind: '52_semanas', params: { base_cents: 500 }, goal_id: 'g', started_on: '2026-10-19', ends_on: '2027-10-17' }
    const p = challengeProgress(c, [], cats, [move(500, '2026-10-20', { note: '52 semanas' }), move(1000, '2026-10-27', { note: '52 semanas' })], '2026-11-04')
    expect(p).toMatchObject({ week: 3, weekTarget: 1500, savedTotal: 1500, target: 689000 })
  })
})

describe('regras automáticas', () => {
  const rule = (p: Partial<Rule>): Rule => ({ id: 'r', user_id: 'u', kind: 'arredondar', goal_id: 'g', params: {}, active: true, created_at: '', ...p })
  it('arredondar até o próximo R$ 5', () => {
    expect(roundUp(1840, 500)).toBe(160)
    expect(roundUp(2000, 500)).toBe(0)
    expect(rulesForTransaction(tx({ amount_cents: 1840 }), [rule({ params: { step_cents: 500 } })])).toEqual([{ goal_id: 'g', amount_cents: 160, note: 'Regra: arredondar' }])
  })
  it('% da renda extra e prazer culpado', () => {
    expect(rulesForTransaction(tx({ kind: 'income', type: 'extra', amount_cents: 40000 }), [rule({ kind: 'renda_extra', params: { pct: 20 } })])[0].amount_cents).toBe(8000)
    expect(rulesForTransaction(tx({ category_id: 'd' }), [rule({ kind: 'prazer_culpado', params: { category_id: 'd', amount_cents: 1000 } })])[0].amount_cents).toBe(1000)
    expect(rulesForTransaction(tx({ category_id: 'x' }), [rule({ kind: 'prazer_culpado', params: { category_id: 'd' } })])).toEqual([])
    expect(rulesForTransaction(tx({ amount_cents: 1840 }), [rule({ active: false, params: { step_cents: 500 } })])).toEqual([])
  })
  it('sobra do limite semanal da semana passada', () => {
    const delivery = cat('d', 'Delivery', { weekly_limit_cents: 7000 })
    const r = weeklyLeftover([delivery], [tx({ category_id: 'd', amount_cents: 4500, date: '2026-10-28' })], '2026-11-04')
    expect(r).toEqual([{ category: delivery, leftover: 2500, weekStart: '2026-10-26' }])
  })
})

describe('lista de desejos', () => {
  const wish = (p: Partial<Wish>): Wish => ({ id: 'w', user_id: 'u', name: 'Tênis', price_cents: 45000, link: null, decide_on: '2026-11-10', status: 'esperando', decided_at: null, created_at: '', ...p })
  it('conta os dias da espera', () => {
    expect(wishState(wish({}), '2026-11-04')).toEqual({ daysLeft: 6, ready: false })
    expect(wishState(wish({ decide_on: '2026-11-01' }), '2026-11-04')).toEqual({ daysLeft: 0, ready: true })
  })
  it('soma o que deixou de gastar', () => {
    expect(savedByGivingUp([wish({ status: 'desisti' }), wish({ status: 'comprei' }), wish({ status: 'desisti', price_cents: 1000 })])).toBe(46000)
  })
})

describe('recomeço e futuro', () => {
  it('mensagens de recomeço', () => {
    expect(freshStart('2026-11-02', null)?.title).toBe('Mês novo, página em branco')
    expect(freshStart('2027-01-05', null)?.title).toBe('Bem-vindo a 2027')
    expect(freshStart('2026-11-20', '1995-11-20')?.title).toBe('Feliz aniversário!')
    expect(freshStart('2026-11-20', null)).toBeNull()
  })
  it('mantendo o ritmo dos últimos 3 meses', () => {
    const moves = [move(270000, '2026-06-01', { kind: 'inicial' }), move(30000, '2026-08-06'), move(30000, '2026-09-06'), move(30000, '2026-10-06')]
    expect(projection(moves, '2026-11-04')).toEqual({ pace: 30000, monthsLeft: 2, saved: 360000, projected: 420000 })
  })
  it('o que já foi guardado neste mês não conta duas vezes', () => {
    const moves = [move(270000, '2026-06-01', { kind: 'inicial' }), move(30000, '2026-08-06'), move(30000, '2026-09-06'), move(30000, '2026-10-06'), move(30000, '2026-11-03')]
    // antes: 390.000 + 2 × 30.000 = 450.000 (contava novembro duas vezes)
    expect(projection(moves, '2026-11-04').projected).toBe(420000)
  })
})

describe('revisão da semana', () => {
  it('compara com a semana anterior e acha a categoria que mais pesou', () => {
    const cats = [cat('d', 'Delivery')]
    const txs = [tx({ date: '2026-10-27', amount_cents: 5000, category_id: 'd' }), tx({ date: '2026-10-28', amount_cents: 1000 }), tx({ date: '2026-10-21', amount_cents: 9000 })]
    const r = weekRecap(txs, [move(2000, '2026-10-29')], cats, '2026-11-04')
    expect(r).toMatchObject({ from: '2026-10-26', to: '2026-11-01', spent: 6000, previousSpent: 9000, saved: 2000, topCategory: { name: 'Delivery', cents: 5000 }, noSpendDays: 5 })
    expect(compareText(6000, 9000)).toBe('Você gastou 33% menos que antes (R$ 30,00 a menos). Mandou bem!')
    expect(compareText(12000, 9000)).toContain('vamos ajustar')
  })
})

describe('teste de perfil', () => {
  it('o perfil que mais aparece nas respostas', () => {
    expect(profileFromAnswers({ salario: 'Separo uma parte para guardar', fim_do_mes: 'Sobra um pouco', promocao: 'Compro na hora, antes que acabe', controle: 'Sei, anoto tudo' })).toBe('guardiao')
    expect(profileFromAnswers({})).toBe('planejador')
  })
})

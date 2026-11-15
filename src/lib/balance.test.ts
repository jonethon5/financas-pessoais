import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../types'
import { monthlyBalance, type BalanceInput } from './balance'

const TODAY = '2026-11-15'
let n = 0
const tx = (category_id: string, amount_cents: number, date: string): Transaction => ({
  id: `t${++n}`, user_id: 'u', kind: 'expense', type: 'dia', amount_cents, date, description: 'x',
  category_id, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '',
})
const cat = (id: string, name: string, grp: Category['grp']): Category => ({ id, user_id: 'u', name, icon: 'x', color: '#000', kind: 'expense', grp, monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '' })
const cats = [cat('del', 'Delivery', 'desejo'), cat('lzr', 'Lazer', 'desejo'), cat('mer', 'Mercado', 'necessidade'), cat('ass', 'Assinaturas', 'desejo')]

/** Mesmo gasto por mês nos 3 meses anteriores (é a média que o balanço usa). */
function history(perMonth: Record<string, number>): Transaction[] {
  return ['2026-08-10', '2026-09-10', '2026-10-10'].flatMap((d) => Object.entries(perMonth).map(([c, v]) => tx(c, v, d)))
}

// Renda R$ 3.750; fixos R$ 1.500; dia a dia: delivery 400, lazer 300, mercado 900 → gasta 3.100, sobra 650 (17%)
const input = (over: Partial<BalanceInput> = {}): BalanceInput => ({
  today: TODAY,
  incomeCents: 375000,
  fixedCents: 150000,
  installmentsCents: 0,
  categories: cats,
  history: history({ del: 40000, lzr: 30000, mer: 90000 }),
  monthTxs: [],
  subscriptions: [{ description: 'Netflix', monthlyCents: 5590, categoryId: 'ass' }],
  ...over,
})

describe('balanço do mês: dá para guardar X%?', () => {
  it('já dá: o que sobra hoje cobre a meta, sem cortar nada', () => {
    const b = monthlyBalance(input(), 10)
    expect(b).toMatchObject({ verdict: 'ja-da', spendCents: 310000, leftCents: 65000, targetCents: 37500, gapCents: 0, cuts: [] })
  })

  it('dá cortando só desejos: o maior primeiro e só o que falta', () => {
    // 20% = 750; sobra 650 → faltam 100: sai do delivery (o maior desejo), com limite por semana
    const b = monthlyBalance(input(), 20)
    expect(b.verdict).toBe('da')
    expect(b.gapCents).toBe(10000)
    expect(b.cuts).toEqual([
      { categoryId: 'del', label: 'Delivery', group: 'desejo', kind: 'limite', nowCents: 40000, newCents: 30000, saveCents: 10000, how: expect.stringMatching(/^limite de R\$\s?70,00 por semana$/) },
    ])
    expect(b.lessons).toContain('regra-30-dias')
  })

  it('apertado: depois dos desejos e assinaturas, precisa mexer numa necessidade', () => {
    // 30% = 1.125; faltam 475. Desejos: delivery 160 + lazer 120 + Netflix 55,90 = 335,90; o resto vem do mercado
    const b = monthlyBalance(input(), 30)
    expect(b.verdict).toBe('apertado')
    expect(b.cuts.map((c) => [c.label, c.saveCents])).toEqual([
      ['Delivery', 16000],
      ['Lazer', 12000],
      ['Netflix', 5590],
      ['Mercado', 14000],
    ])
    expect(b.cuts.find((c) => c.label === 'Netflix')!.how).toMatch(/^cancelar/)
  })

  it('não dá ainda: mostra o máximo realista e o caminho de subir 1% por mês', () => {
    // Máximo cortando tudo: 650 + 160 + 120 + 55,90 + 140 (15% do mercado, de R$ 10 em R$ 10) = 1.125,90 → 30%
    const b = monthlyBalance(input(), 35)
    expect(b.verdict).toBe('nao-da')
    expect(b.maxPct).toBe(30)
    expect(b.path).toEqual({ startPct: 30, months: 5 })
    expect(b.lessons).toContain('compromisso')
  })

  it('no vermelho: começa de 1% e o plano mostra tudo o que dá para cortar', () => {
    const b = monthlyBalance(input({ fixedCents: 260000 }), 10)
    expect(b.leftCents).toBe(-45000)
    expect(b.verdict).toBe('nao-da')
    expect(b.path!.startPct).toBe(1)
    expect(b.cuts.length).toBe(4)
  })

  it('sem renda cadastrada não inventa conta', () => {
    expect(monthlyBalance(input({ incomeCents: 0 }), 10).verdict).toBe('sem-renda')
  })
})

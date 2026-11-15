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

describe('balanço: o que tem dono, o que dá para mexer e "e se?"', () => {
  const parcela: Transaction = { ...tx('mer', 10000, '2026-11-10'), type: 'parcela', description: 'Sapato social', installment_no: 3, installment_total: 10 }
  const uber = (d: string) => ({ ...tx('tra', 6000, d), description: 'UBER *TRIP' })

  it('parcelas aparecem como "já tem dono", com quantas faltam', () => {
    const b = monthlyBalance(input({ monthTxs: [parcela], installmentsCents: 10000 }), 10)
    expect(b.committed.parcels).toEqual([{ label: 'Sapato social 3/10', amountCents: 10000, left: 7 }])
  })

  it('dia a dia por categoria, com o app que mais pesa (Uber) dentro dela', () => {
    const cats2 = [...cats, cat('tra', 'Transporte', 'necessidade')]
    const hist = [...history({ del: 40000 }), uber('2026-08-05'), uber('2026-08-20'), uber('2026-09-05'), uber('2026-09-20'), uber('2026-10-05'), uber('2026-10-20')]
    const b = monthlyBalance(input({ categories: cats2, history: hist }), 10)
    expect(b.variable.find((v) => v.label === 'Transporte')).toEqual({ categoryId: 'tra', label: 'Transporte', group: 'necessidade', monthlyCents: 12000, merchants: [{ name: 'Uber', monthlyCents: 12000 }] })
    expect(b.variable[0].label).toBe('Delivery')
  })

  it('"e se?": gastando 30% menos no dia a dia, quanto sobra e quantos % da renda', () => {
    // dia a dia 1.600; 30% = 480; sobra 650 + 480 = 1.130 → 30% de 3.750
    const s30 = monthlyBalance(input(), 20).scenarios.find((s) => s.cutPct === 30)!
    expect(s30).toEqual({ cutPct: 30, saveCents: 48000, leftCents: 113000, pct: 30 })
  })

  it('avisa dos Pix que parecem repasse e ainda contam como gasto', () => {
    const info = (flow: 'saida' | 'entrada', time: string) => ({ original: 'x', time, method: 'pix' as const, flow, party: null })
    const recebido: Transaction = { ...tx('del', 26000, '2026-11-03'), kind: 'income', type: 'extra', skipped: true, bank_account_id: 'c', bank_info: info('entrada', '17:59') }
    const enviado: Transaction = { ...tx('del', 26000, '2026-11-03'), description: 'Transferência enviada pelo Pix|MARIA', bank_account_id: 'c', bank_info: info('saida', '18:01') }
    expect(monthlyBalance(input({ monthTxs: [recebido, enviado] }), 10).passThroughs).toEqual([{ id: enviado.id, label: 'MARIA', amountCents: 26000 }])
  })
})

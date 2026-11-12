import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../types'
import { filterStatement, insightTips, insights, methodOf, statementCSV, statementTotals } from './statement'

let n = 0
function tx(p: Partial<Transaction>): Transaction {
  const type = p.type ?? 'dia'
  return {
    id: `t${++n}`, user_id: 'u', kind: type === 'salario' || type === 'extra' ? 'income' : 'expense', type, amount_cents: 1000, date: '2026-11-10', description: 'x',
    category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
  }
}
const cat = (id: string, name: string): Category => ({ id, user_id: 'u', name, icon: 'x', color: '#123456', kind: 'expense', grp: 'desejo', monthly_limit_cents: null, weekly_limit_cents: null, sort: 0, archived: false, created_at: '' })
const cats = [cat('ifood', 'Delivery'), cat('mercado', 'Mercado')]
const accounts = [
  { id: 'conta', type: 'BANK' as const, name: 'Nubank conta' },
  { id: 'cartao', type: 'CREDIT' as const, name: 'Nubank cartão' },
]

const month = [
  tx({ type: 'salario', amount_cents: 210000, date: '2026-11-05', description: 'Salário' }),
  tx({ amount_cents: 4290, date: '2026-11-06', description: 'Ifood Restaurante', category_id: 'ifood', bank_account_id: 'cartao' }),
  tx({ amount_cents: 12000, date: '2026-11-07', description: 'Mercado Assaí', category_id: 'mercado', bank_account_id: 'conta' }),
  tx({ amount_cents: 5000, date: '2026-11-08', description: 'Pix para João Silva', bank_account_id: 'conta' }),
  tx({ amount_cents: 2500, date: '2026-11-08', description: 'Padaria' }),
  // aparecem no extrato, mas não contam: entrada do banco e Pix entre contas próprias
  tx({ type: 'extra', amount_cents: 80000, date: '2026-11-08', description: 'Pix de Ana Ribeiro', bank_account_id: 'conta', skipped: true }),
  tx({ amount_cents: 30000, date: '2026-11-09', description: 'Pix para Ana Ribeiro', bank_account_id: 'conta', skipped: true }),
]

describe('extrato', () => {
  it('sabe se foi no crédito, no Pix, no débito ou lançado à mão', () => {
    expect(month.slice(1, 5).map((t) => methodOf(t, accounts))).toEqual(['credito', 'debito', 'pix', 'manual'])
  })
  it('"tudo" mostra só o que conta; "fora" mostra o que não conta; mais novo primeiro', () => {
    expect(filterStatement(month, { view: 'tudo' }, cats).map((t) => t.description)).toEqual(['Pix para João Silva', 'Padaria', 'Mercado Assaí', 'Ifood Restaurante', 'Salário'])
    expect(filterStatement(month, { view: 'fora' }, cats).map((t) => t.description)).toEqual(['Pix para Ana Ribeiro', 'Pix de Ana Ribeiro'])
    expect(filterStatement(month, { view: 'entradas' }, cats).map((t) => t.description)).toEqual(['Salário'])
    expect(filterStatement(month, { view: 'gastos', accountId: 'conta' }, cats)).toHaveLength(2)
  })
  it('busca sem acento, pela descrição ou pela categoria', () => {
    expect(filterStatement(month, { view: 'tudo', query: 'assai' }, cats).map((t) => t.description)).toEqual(['Mercado Assaí'])
    expect(filterStatement(month, { view: 'tudo', query: 'DELIVERY' }, cats).map((t) => t.description)).toEqual(['Ifood Restaurante'])
    expect(filterStatement(month, { view: 'tudo', query: 'nada disso' }, cats)).toEqual([])
  })
  it('os totais batem com o que conta', () => {
    expect(statementTotals(filterStatement(month, { view: 'tudo' }, cats))).toEqual({ income: 210000, expense: 23790 })
  })
  it('a planilha abre no Excel em português: ponto e vírgula, vírgula nos centavos, gasto negativo', () => {
    const csv = statementCSV([month[1], month[0], tx({ amount_cents: 1050, date: '2026-11-11', description: 'Loja; "Centro"', installment_no: 2, installment_total: 5 })], cats, accounts)
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('Data;Descrição;Categoria;Tipo;Forma;Conta;Valor (R$);Conta no mês')
    expect(lines[1]).toBe('05/11/2026;Salário;;Entrada;Lançado à mão;;2100,00;sim')
    expect(lines[2]).toBe('06/11/2026;Ifood Restaurante;Delivery;Gasto;Cartão de crédito;Nubank cartão;-42,90;sim')
    expect(lines[3]).toBe('11/11/2026;"Loja; ""Centro"" 2/5";;Gasto;Lançado à mão;;-10,50;sim')
  })
})

describe('achados da conta', () => {
  it('total, compra média, maior compra e o lugar que mais se repete', () => {
    const i = insights([
      ...month,
      tx({ amount_cents: 3000, date: '2026-11-13', description: 'Ifood Restaurante' }),
      tx({ amount_cents: 2000, date: '2026-11-14', description: 'IFOOD *RESTAURANTE 8842' }),
    ])
    expect(i.spent).toBe(28790)
    expect(i.count).toBe(6)
    expect(i.ticket).toBe(4798)
    expect(i.biggest).toMatchObject({ description: 'Mercado Assaí', cents: 12000 })
    expect(i.topPlaces[0]).toMatchObject({ cents: 12000, count: 1 })
    expect(i.topPlaces[1]).toMatchObject({ name: 'Ifood Restaurante', cents: 9290, count: 3 })
    expect(i.small).toEqual({ count: 3, cents: 7500 })
  })
  it('dia da semana e fim de semana (2026-11-07 é sábado)', () => {
    const i = insights(month)
    expect(i.weekdays[6]).toMatchObject({ label: 'sábado', cents: 12000, count: 1 })
    expect(i.topWeekday).toMatchObject({ label: 'sábado' })
    expect(i.weekendShare).toBeCloseTo((12000 + 7500) / 23790, 5)
  })
  it('sentimento em que mais gastou', () => {
    const i = insights([tx({ amount_cents: 5000, emotion: 'estressado' }), tx({ amount_cents: 4000, emotion: 'estressado' }), tx({ amount_cents: 6000, emotion: 'comemorando' })])
    expect(i.topEmotion).toEqual({ emotion: 'estressado', cents: 9000, count: 2 })
  })
  it('sem gastos não inventa dica; com gastos, no máximo 3 frases com os números de verdade', () => {
    expect(insightTips(insights([]), null)).toEqual([])
    const many = Array.from({ length: 9 }, (_, k) => tx({ amount_cents: 1500, date: `2026-11-${String(10 + k).padStart(2, '0')}`, description: 'Padaria Bom Pão' }))
    const tips = insightTips(insights(many), { name: 'Mercado', cents: 13500, pct: 1 })
    expect(tips).toHaveLength(3)
    expect(tips[0]).toContain('Mercado leva 100%')
    expect(tips[1]).toContain('9 vezes em Padaria Bom Pão')
    expect(tips[2]).toContain('9 compras de até R$ 30')
  })
})

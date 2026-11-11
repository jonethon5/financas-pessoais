import { describe, expect, it } from 'vitest'
import { categoryHint, cleanDescription, findFixedMatch, isInternal, isSalaryMatch, learnKey, mapTransaction, type PluggyTx } from '../../supabase/functions/_shared/bankmap.ts'

const tx = (p: Partial<PluggyTx>): PluggyTx => ({ id: 'abc', description: 'Compra', amount: -10, date: '2026-11-04T00:00:00.000Z', ...p })

describe('conta corrente', () => {
  it('saída vira gasto do dia a dia, entrada vira renda', () => {
    expect(mapTransaction(tx({ description: 'IFOOD *RESTAURANTE', amount: -42.9 }), 'BANK')).toMatchObject({
      external_id: 'pluggy:abc', kind: 'expense', type: 'dia', amount_cents: 4290, date: '2026-11-04', description: 'Ifood Restaurante', categoryHint: 'Delivery',
    })
    expect(mapTransaction(tx({ description: 'Pix recebido Maria', amount: 150 }), 'BANK')).toMatchObject({ kind: 'income', type: 'extra', amount_cents: 15000, categoryHint: 'Renda extra' })
  })
  it('ignora pagamento de fatura e caixinhas do banco (não conta duas vezes)', () => {
    expect(mapTransaction(tx({ description: 'Pagamento de fatura', amount: -1200 }), 'BANK')).toBeNull()
    expect(mapTransaction(tx({ description: 'Aplicação RDB', amount: -300 }), 'BANK')).toBeNull()
    expect(mapTransaction(tx({ description: 'Resgate RDB', amount: 300 }), 'BANK')).toBeNull()
    expect(isInternal(tx({ description: 'Transferência', category: 'Same ownership transfer' }))).toBe(true)
  })
})

describe('cartão de crédito', () => {
  it('compra vira gasto; pagamento e estorno são ignorados', () => {
    expect(mapTransaction(tx({ description: 'UBER *TRIP', amount: 18.4 }), 'CREDIT')).toMatchObject({ kind: 'expense', type: 'dia', amount_cents: 1840, categoryHint: 'Transporte' })
    expect(mapTransaction(tx({ description: 'Pagamento recebido', amount: -500 }), 'CREDIT')).toBeNull()
    expect(mapTransaction(tx({ description: 'Estorno loja', amount: -30 }), 'CREDIT')).toBeNull()
  })
  it('parcela da compra vira "3/10" e as parcelas da mesma compra se juntam', () => {
    const m = mapTransaction(tx({ description: 'MAGAZINE LUIZA', amount: 150, creditCardMetadata: { installmentNumber: 3, totalInstallments: 10, purchaseDate: '2026-09-02T00:00:00Z' } }), 'CREDIT')
    expect(m).toMatchObject({ type: 'parcela', installment_no: 3, installment_total: 10, installmentKey: 'magazine luiza|2026-09-02|10' })
  })
})

describe('categorias', () => {
  it('sugere pela descrição ou pela categoria do Open Finance', () => {
    expect(categoryHint(tx({ description: 'NETFLIX.COM' }), 'expense')).toBe('Assinaturas')
    expect(categoryHint(tx({ description: 'Compra', category: 'Groceries' }), 'expense')).toBe('Mercado')
    expect(categoryHint(tx({ description: 'SHOPEE *LOJA' }), 'expense')).toBe('Compras online')
    expect(categoryHint(tx({ description: 'Loja qualquer' }), 'expense')).toBeNull()
    expect(categoryHint(tx({ description: 'Salário EMPRESA LTDA' }), 'income')).toBe('Salário')
  })
  it('chave para aprender a categoria corrigida', () => {
    expect(learnKey('UBER *TRIP 8842 HELP.UBER.COM')).toBe('uber trip')
    expect(learnKey('Pão de Açúcar 123')).toBe('pao de')
  })
  it('limpa a descrição', () => {
    expect(cleanDescription('  PAGTO   CONTA VIVO ')).toBe('Pagto Conta Vivo')
    expect(cleanDescription('Mercado Livre')).toBe('Mercado Livre')
  })
})

describe('sem duplicar com o que o app já lança sozinho', () => {
  it('reconhece o salário (até 15% e 6 dias de diferença)', () => {
    const salary = { amount_cents: 211300, date: '2026-11-05' }
    expect(isSalaryMatch({ kind: 'income', amount_cents: 211300, date: '2026-11-06' }, salary)).toBe(true)
    expect(isSalaryMatch({ kind: 'income', amount_cents: 15000, date: '2026-11-05' }, salary)).toBe(false)
    expect(isSalaryMatch({ kind: 'income', amount_cents: 211300, date: '2026-11-20' }, salary)).toBe(false)
  })
  it('acha o fixo em aberto que o gasto está pagando', () => {
    const fixed = [
      { id: 'tel', amount_cents: 3900, date: '2026-11-15', paid: false, external_id: null },
      { id: 'casa', amount_cents: 50000, date: '2026-11-10', paid: false, external_id: null },
      { id: 'pago', amount_cents: 3900, date: '2026-11-15', paid: true, external_id: null },
    ]
    expect(findFixedMatch({ kind: 'expense', amount_cents: 3990, date: '2026-11-13' }, fixed)?.id).toBe('tel')
    expect(findFixedMatch({ kind: 'expense', amount_cents: 7000, date: '2026-11-13' }, fixed)).toBeNull()
  })
})

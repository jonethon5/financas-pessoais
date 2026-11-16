import { describe, expect, it } from 'vitest'
import { belongsToMonth, cardCycle, cardCycles, invoiceMonth, nextInvoices } from './cardcycle'

const neon = { closeDay: 28, dueDay: 5 } // fecha dia 28, vence dia 5 do mês seguinte

describe('cartão no mês da fatura', () => {
  it('compra até o fechamento vai para a fatura que vence no mês seguinte; depois do fechamento, uma a mais', () => {
    expect(invoiceMonth('2026-11-15', neon)).toEqual({ year: 2026, month: 12 })
    expect(invoiceMonth('2026-11-28', neon)).toEqual({ year: 2026, month: 12 })
    expect(invoiceMonth('2026-11-29', neon)).toEqual({ year: 2027, month: 1 })
  })

  it('cartão que fecha e vence no mesmo mês (fecha 5, vence 15)', () => {
    const c = { closeDay: 5, dueDay: 15 }
    expect(invoiceMonth('2026-11-03', c)).toEqual({ year: 2026, month: 11 })
    expect(invoiceMonth('2026-11-10', c)).toEqual({ year: 2026, month: 12 })
  })

  it('sem dados do cartão: a fatura do mês seguinte', () => {
    expect(invoiceMonth('2026-11-15', null)).toEqual({ year: 2026, month: 12 })
  })

  it('lê fechamento e vencimento do banco; sem fechamento, estima 7 dias antes', () => {
    expect(cardCycle({ close_date: '2026-11-28', due_date: '2026-12-05' })).toEqual(neon)
    expect(cardCycle({ close_date: null, due_date: '2026-12-15' })).toEqual({ closeDay: 8, dueDay: 15 })
    expect(cardCycle({ close_date: null, due_date: null })).toBeNull()
  })

  it('o mês tem a conta pela data e o cartão pela fatura (sem contar a compra duas vezes)', () => {
    const cycles = cardCycles([{ id: 'neon', type: 'CREDIT', close_date: '2026-11-28', due_date: '2026-12-05' }, { id: 'conta', type: 'BANK', close_date: null, due_date: null }])
    const txs = [
      { id: 'pix-nov', date: '2026-11-10', bank_account_id: 'conta' },
      { id: 'cartao-out', date: '2026-10-20', bank_account_id: 'neon' }, // fatura de novembro
      { id: 'cartao-nov', date: '2026-11-15', bank_account_id: 'neon' }, // fatura de dezembro
      { id: 'mao', date: '2026-11-02', bank_account_id: null },
    ]
    expect(belongsToMonth(txs, { year: 2026, month: 11 }, cycles).map((t) => t.id)).toEqual(['pix-nov', 'cartao-out', 'mao'])
    expect(belongsToMonth(txs, { year: 2026, month: 12 }, cycles).map((t) => t.id)).toEqual(['cartao-nov'])
  })

  it('"já gasto no cartão": o que vai para a próxima fatura', () => {
    const cycles = cardCycles([{ id: 'neon', type: 'CREDIT', close_date: '2026-11-28', due_date: '2026-12-05' }])
    const t = (date: string, amount_cents: number, skipped = false) => ({ date, bank_account_id: 'neon', kind: 'expense', skipped, amount_cents })
    expect(nextInvoices([t('2026-10-20', 5000), t('2026-11-03', 33500), t('2026-11-10', 1000), t('2026-11-12', 999, true)], '2026-11-15', cycles)).toEqual({ month: { year: 2026, month: 12 }, cents: 34500 })
    expect(nextInvoices([t('2026-10-20', 5000)], '2026-11-15', cycles)).toBeNull()
  })
})

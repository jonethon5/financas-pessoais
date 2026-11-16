import { describe, expect, it } from 'vitest'
import { cardBills, dueText, spendSplit, uncountedIncome } from './bills'

const accounts = [
  { id: 'conta', type: 'BANK' as const, balance_cents: 50000, due_date: null },
  { id: 'neon', type: 'CREDIT' as const, balance_cents: 92200, due_date: '2026-12-12' },
  { id: 'nu', type: 'CREDIT' as const, balance_cents: 30000, due_date: '2026-11-20' },
  { id: 'zerado', type: 'CREDIT' as const, balance_cents: 0, due_date: '2026-11-25' },
]

describe('seu mês, separado pelo jeito que o dinheiro sai', () => {
  it('fixos, parcelas, cartão, Pix/débito e lançados à mão (o que não conta fica de fora)', () => {
    const t = (type: string, amount_cents: number, bank_account_id: string | null, skipped = false) => ({ kind: 'expense' as const, type: type as 'dia', amount_cents, bank_account_id, skipped })
    expect(spendSplit([t('fixo', 120000, null), t('parcela', 10000, 'neon'), t('dia', 4000, 'neon'), t('dia', 2500, 'conta'), t('dia', 1500, null), t('dia', 26000, 'conta', true)], accounts)).toEqual({
      fixed: 120000, installments: 10000, card: 4000, account: 2500, manual: 1500,
    })
  })

  it('Pix recebido que não conta como renda (fatura e transferência entre contas suas não entram)', () => {
    const r = (amount_cents: number, note: string | null, skipped = true) => ({ kind: 'income' as const, skipped, source: 'banco' as const, note, amount_cents })
    expect(uncountedIncome([r(165600, null), r(26000, null), r(80000, 'Transferência entre contas suas'), r(375600, null, false)])).toEqual({ cents: 191600, count: 2 })
  })
})

describe('faturas para pagar', () => {
  it('só cartão com fatura; a que vence primeiro antes; alerta até 7 dias', () => {
    const bills = cardBills(accounts, '2026-11-15')
    expect(bills.map((b) => [b.accountId, b.amountCents, b.daysUntil, b.urgent])).toEqual([
      ['nu', 30000, 5, true],
      ['neon', 92200, 27, false],
    ])
  })
  it('fatura que venceu e foi paga: mostra a próxima, no mês seguinte (o banco mandou a data antiga)', () => {
    const neon = [{ id: 'neon', type: 'CREDIT' as const, balance_cents: 99500, due_date: '2026-11-10' }]
    const pagamento = { kind: 'income' as const, bank_account_id: 'neon', date: '2026-11-09' }
    expect(cardBills(neon, '2026-11-16', [pagamento])).toEqual([{ accountId: 'neon', amountCents: 99500, dueDate: '2026-12-10', daysUntil: 24, urgent: false, estimated: true }])
    // sem pagamento e há poucos dias: continua o alerta de vencida
    expect(cardBills(neon, '2026-11-16')).toMatchObject([{ dueDate: '2026-11-10', daysUntil: -6, urgent: true, estimated: false }])
    // dado velho (venceu há mais de 20 dias): também passa para o mês seguinte
    expect(cardBills(neon, '2026-12-05')[0]).toMatchObject({ dueDate: '2026-12-10', daysUntil: 5, estimated: true })
  })

  it('texto do vencimento', () => {
    expect([dueText(0), dueText(1), dueText(5), dueText(-2), dueText(null)]).toEqual(['vence hoje', 'vence amanhã', 'vence em 5 dias', 'venceu há 2 dias', 'sem data de vencimento'])
  })
})

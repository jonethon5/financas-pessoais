/**
 * "Seu mês" mastigado: de onde saiu o dinheiro (fixos, parcelas, cartão, Pix e débito), o que entrou e não conta
 * como renda, e as faturas de cartão para pagar (com alerta perto do vencimento). Funções puras, testadas em bills.test.ts.
 */
import type { BankAccount, Transaction } from '../types'
import { daysBetweenISO } from './dates'

export type SpendSplit = {
  fixed: number
  installments: number
  /** compras do dia a dia no cartão de crédito (a pessoa paga na fatura) */
  card: number
  /** Pix, débito e boleto na conta (sai na hora) */
  account: number
  /** lançados à mão (sem banco conectado) */
  manual: number
}

/** O gasto do mês separado pelo jeito que sai do bolso. Soma igual ao "Gastos" de sempre (fixos + parcelas + dia a dia). */
export function spendSplit(monthTxs: Pick<Transaction, 'kind' | 'type' | 'skipped' | 'amount_cents' | 'bank_account_id'>[], accounts: Pick<BankAccount, 'id' | 'type'>[]): SpendSplit {
  const credit = new Set(accounts.filter((a) => a.type === 'CREDIT').map((a) => a.id))
  const out: SpendSplit = { fixed: 0, installments: 0, card: 0, account: 0, manual: 0 }
  for (const t of monthTxs) {
    if (t.kind !== 'expense' || t.skipped) continue
    if (t.type === 'fixo') out.fixed += t.amount_cents
    else if (t.type === 'parcela') out.installments += t.amount_cents
    else if (!t.bank_account_id) out.manual += t.amount_cents
    else if (credit.has(t.bank_account_id)) out.card += t.amount_cents
    else out.account += t.amount_cents
  }
  return out
}

/** Dinheiro que entrou na conta do banco e não está contando como renda (Pix recebido, transferência de alguém). */
export function uncountedIncome(monthTxs: Pick<Transaction, 'kind' | 'skipped' | 'source' | 'note' | 'amount_cents'>[]): { cents: number; count: number } {
  const list = monthTxs.filter((t) => t.kind === 'income' && t.skipped && t.source === 'banco' && !t.note)
  return { cents: list.reduce((a, t) => a + t.amount_cents, 0), count: list.length }
}

export type CardBill = {
  accountId: string
  amountCents: number
  dueDate: string | null
  /** dias até vencer (negativo = venceu) */
  daysUntil: number | null
  /** vence logo (até 7 dias) ou já venceu: vira alerta */
  urgent: boolean
}

/** Faturas abertas dos cartões conectados, a que vence primeiro antes. */
export function cardBills(accounts: Pick<BankAccount, 'id' | 'type' | 'balance_cents' | 'due_date'>[], today: string): CardBill[] {
  return accounts
    .filter((a) => a.type === 'CREDIT' && (a.balance_cents ?? 0) > 0)
    .map((a) => {
      const daysUntil = a.due_date ? daysBetweenISO(today, a.due_date) : null
      return { accountId: a.id, amountCents: a.balance_cents!, dueDate: a.due_date, daysUntil, urgent: daysUntil != null && daysUntil <= 7 }
    })
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
}

/** "vence hoje", "vence amanhã", "vence em 5 dias", "venceu há 2 dias" */
export function dueText(daysUntil: number | null): string {
  if (daysUntil == null) return 'sem data de vencimento'
  if (daysUntil < 0) return `venceu há ${-daysUntil} ${daysUntil === -1 ? 'dia' : 'dias'}`
  if (daysUntil === 0) return 'vence hoje'
  if (daysUntil === 1) return 'vence amanhã'
  return `vence em ${daysUntil} dias`
}

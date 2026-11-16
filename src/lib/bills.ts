/**
 * "Seu mês" mastigado: de onde saiu o dinheiro (fixos, parcelas, cartão, Pix e débito), o que entrou e não conta
 * como renda, e as faturas de cartão para pagar (com alerta perto do vencimento). Funções puras, testadas em bills.test.ts.
 */
import type { BankAccount, Transaction } from '../types'
import { addDaysISO, daysBetweenISO } from './dates'

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
  /** a data veio da fatura anterior (já paga): o vencimento mostrado é o do mês seguinte */
  estimated: boolean
}

/** Mesmo dia, um mês depois ("2026-11-10" → "2026-12-10"; 31 vira o último dia do mês). */
function nextMonthISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/**
 * Faturas abertas dos cartões conectados, a que vence primeiro antes.
 * O banco às vezes manda o vencimento da fatura anterior (já paga) junto com o valor da fatura aberta: se o
 * vencimento passou e o pagamento da fatura está nos lançamentos do cartão (ou passou há mais de 20 dias,
 * dado velho), conta como paga e mostra a próxima, no mês seguinte. Sem pagamento, fica o alerta de vencida.
 */
export function cardBills(
  accounts: Pick<BankAccount, 'id' | 'type' | 'balance_cents' | 'due_date'>[],
  today: string,
  txs: Pick<Transaction, 'kind' | 'bank_account_id' | 'date'>[] = [],
): CardBill[] {
  return accounts
    .filter((a) => a.type === 'CREDIT' && (a.balance_cents ?? 0) > 0)
    .map((a) => {
      let due = a.due_date
      let estimated = false
      if (due && due < today) {
        // pagamento da fatura: entrada no próprio cartão perto do vencimento
        const paid = txs.some((t) => t.kind === 'income' && t.bank_account_id === a.id && t.date >= addDaysISO(due!, -20) && t.date <= today)
        if (paid || daysBetweenISO(due, today) > 20) {
          while (due < today) due = nextMonthISO(due)
          estimated = true
        }
      }
      const daysUntil = due ? daysBetweenISO(today, due) : null
      return { accountId: a.id, amountCents: a.balance_cents!, dueDate: due, daysUntil, urgent: daysUntil != null && daysUntil <= 7, estimated }
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

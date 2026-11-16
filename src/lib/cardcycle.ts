/**
 * Cartão de crédito no mês da fatura (como nos apps de finanças brasileiros e no YNAB):
 * a compra conta no mês em que a fatura dela VENCE, com a categoria dela; o pagamento da fatura não conta de novo
 * (é transferência: contar as compras e a fatura seria contar duas vezes).
 * A fatura de uma compra sai do dia de fechamento: até o fechamento, entra na fatura daquele ciclo; depois, na seguinte.
 * Funções puras, testadas em cardcycle.test.ts.
 */
import type { BankAccount } from '../types'
import { addMonths, compareYearMonth, monthOf, type YearMonth } from './dates'

export type CardCycle = { closeDay: number; dueDay: number }

/** Dias de fechamento e vencimento do cartão (o banco manda as datas do ciclo atual; vale o dia do mês). */
export function cardCycle(a: Pick<BankAccount, 'close_date' | 'due_date'>): CardCycle | null {
  const dueDay = a.due_date ? Number(a.due_date.slice(8, 10)) : null
  if (!dueDay) return null
  // Sem fechamento: a maioria dos cartões fecha uns 7 dias antes do vencimento
  const closeDay = a.close_date ? Number(a.close_date.slice(8, 10)) : dueDay > 7 ? dueDay - 7 : dueDay - 7 + 30
  return { closeDay, dueDay }
}

/**
 * Mês em que a fatura dessa compra vence. Ex.: fecha dia 28 e vence dia 5: compra em 15/11 → fatura de dezembro;
 * compra em 29/11 → fatura de janeiro. Sem dados do cartão: a fatura do mês seguinte (o caso mais comum).
 */
export function invoiceMonth(date: string, cycle: CardCycle | null): YearMonth {
  const bought = monthOf(date)
  if (!cycle) return addMonths(bought, 1)
  const day = Number(date.slice(8, 10))
  const closes = day <= cycle.closeDay ? bought : addMonths(bought, 1)
  // Vence no mesmo mês do fechamento (fecha 5, vence 15) ou no seguinte (fecha 28, vence 5)
  return cycle.dueDay > cycle.closeDay ? closes : addMonths(closes, 1)
}

type CardTx = { date: string; bank_account_id?: string | null }

/** É lançamento de cartão de crédito conectado? */
export function isCardTx(t: CardTx, cycles: Map<string, CardCycle | null>): boolean {
  return Boolean(t.bank_account_id && cycles.has(t.bank_account_id))
}

/**
 * O que pertence ao mês: o que é da conta (Pix, débito, à mão) pela data; o que é do cartão pelo mês da fatura.
 * `txs` precisa vir com folga para trás (compras de até 2 meses antes podem cair na fatura deste mês).
 */
export function belongsToMonth<T extends CardTx>(txs: T[], ym: YearMonth, cycles: Map<string, CardCycle | null>): T[] {
  return txs.filter((t) =>
    isCardTx(t, cycles) ? compareYearMonth(invoiceMonth(t.date, cycles.get(t.bank_account_id!) ?? null), ym) === 0 : compareYearMonth(monthOf(t.date), ym) === 0,
  )
}

/** Cartões conectados e o ciclo de cada um. */
export function cardCycles(accounts: Pick<BankAccount, 'id' | 'type' | 'close_date' | 'due_date'>[]): Map<string, CardCycle | null> {
  return new Map(accounts.filter((a) => a.type === 'CREDIT').map((a) => [a.id, cardCycle(a)]))
}

/**
 * "Já gasto no cartão": compras feitas até hoje que vão para faturas de meses que ainda vêm.
 * É dinheiro que já tem dono, mesmo sem ter saído da conta (mostrar evita a surpresa da próxima fatura).
 */
export function nextInvoices<T extends CardTx & { kind: string; skipped: boolean; amount_cents: number }>(
  txs: T[],
  today: string,
  cycles: Map<string, CardCycle | null>,
): { month: YearMonth; cents: number } | null {
  const now = monthOf(today)
  let first: YearMonth | null = null
  let cents = 0
  for (const t of txs) {
    if (!isCardTx(t, cycles) || t.kind !== 'expense' || t.skipped || t.date > today) continue
    const m = invoiceMonth(t.date, cycles.get(t.bank_account_id!) ?? null)
    if (compareYearMonth(m, now) <= 0) continue
    if (!first || compareYearMonth(m, first) < 0) first = m
  }
  if (!first) return null
  for (const t of txs) {
    if (!isCardTx(t, cycles) || t.kind !== 'expense' || t.skipped || t.date > today) continue
    if (compareYearMonth(invoiceMonth(t.date, cycles.get(t.bank_account_id!) ?? null), first) === 0) cents += t.amount_cents
  }
  return { month: first, cents }
}

// Salário e gastos fixos: viram lançamentos do mês sozinhos.
// O id de cada um é previsível (mesma entrada → mesmo id), então criar duas vezes não duplica.
import type { NewRow, Profile, Recurring, Transaction } from '../types'
import { compareYearMonth, isoDate, monthKey, parseMonthKey, type YearMonth } from './dates'

/** UUID estável a partir de um texto (SHA-1, no formato de UUID versão 5). */
export async function stableId(key: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`poupei:${key}`)))
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function recurringActiveIn(r: Pick<Recurring, 'active' | 'start_month' | 'end_month'>, ym: YearMonth): boolean {
  if (!r.active) return false
  const start = parseMonthKey(r.start_month)
  const end = parseMonthKey(r.end_month)
  if (start && compareYearMonth(ym, start) < 0) return false
  if (end && compareYearMonth(ym, end) > 0) return false
  return true
}

/**
 * Lançamentos automáticos do mês: o salário (no dia do pagamento) e um para cada gasto fixo ativo.
 * Devolve todos os esperados; quem chama grava só os que ainda não existem.
 */
export async function expectedMonthRows(
  ym: YearMonth,
  userId: string,
  profile: Pick<Profile, 'salary_cents' | 'payday'>,
  recurrings: Recurring[],
  salaryCategoryId: string | null,
): Promise<(NewRow<'transactions'> & { id: string })[]> {
  const month = monthKey(ym)
  const rows: (NewRow<'transactions'> & { id: string })[] = []
  if (profile.salary_cents && profile.salary_cents > 0 && profile.payday) {
    rows.push({
      ...blank(),
      id: await stableId(`salario:${userId}:${month}`),
      kind: 'income',
      type: 'salario',
      amount_cents: profile.salary_cents,
      date: isoDate(ym, profile.payday),
      description: 'Salário',
      category_id: salaryCategoryId,
    })
  }
  for (const r of recurrings) {
    if (!recurringActiveIn(r, ym)) continue
    rows.push({
      ...blank(),
      id: await stableId(`fixo:${r.id}:${month}`),
      kind: 'expense',
      type: 'fixo',
      amount_cents: r.amount_cents,
      date: isoDate(ym, r.day),
      description: r.description,
      category_id: r.category_id,
      recurring_id: r.id,
      paid: false,
    })
  }
  return rows
}

function blank(): Omit<NewRow<'transactions'>, 'kind' | 'type' | 'amount_cents' | 'date' | 'description'> {
  return { category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null }
}

/** Os que faltam criar (compara pelos ids previsíveis). */
export function missingRows<T extends { id: string }>(expected: T[], existing: Pick<Transaction, 'id'>[]): T[] {
  const have = new Set(existing.map((t) => t.id))
  return expected.filter((r) => !have.has(r.id))
}

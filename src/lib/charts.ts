/**
 * Contas dos gráficos (tela Gráficos). Tudo em centavos; a tela só desenha.
 */
import type { BankAccount, Category, GoalMove, Transaction } from '../types'
import type { MonthSummary } from './budget'
import { addMonths, daysInMonth, dayOf, isoDate, monthKey, monthOf, monthShort, type YearMonth } from './dates'

const live = (t: Transaction) => !t.skipped
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const inMonth = (t: Transaction, key: string) => monthKey(monthOf(t.date)) === key

export type CatShare = { id: string; name: string; color: string; icon: string | null; cents: number; pct: number }

/** Total por categoria (gasto ou renda), do maior para o menor, com a porcentagem do total. */
export function byCategory(txs: Transaction[], kind: 'expense' | 'income', categories: Category[]): CatShare[] {
  const map = new Map<string, number>()
  for (const t of txs) if (live(t) && t.kind === kind) map.set(t.category_id ?? 'sem', (map.get(t.category_id ?? 'sem') ?? 0) + t.amount_cents)
  const total = sum([...map.values()])
  return [...map.entries()]
    .map(([id, cents]) => {
      const c = categories.find((x) => x.id === id)
      return { id, name: c?.name ?? 'Sem categoria', color: c?.color ?? '#8A94A0', icon: c?.icon ?? null, cents, pct: total ? cents / total : 0 }
    })
    .sort((a, b) => b.cents - a.cents)
}

export type Part = { key: string; label: string; cents: number; pct: number }

const parts = (entries: [string, string, number][]): Part[] => {
  const total = sum(entries.map((e) => e[2]))
  return entries.map(([key, label, cents]) => ({ key, label, cents, pct: total ? cents / total : 0 }))
}

/** Gastos por recorrência: fixos, parcelas e dia a dia. Renda: salário e extras. */
export function byRecurrence(txs: Transaction[], kind: 'expense' | 'income'): Part[] {
  const t = txs.filter((x) => live(x) && x.kind === kind)
  const of = (type: Transaction['type']) => sum(t.filter((x) => x.type === type).map((x) => x.amount_cents))
  return kind === 'expense'
    ? parts([['fixo', 'Fixos', of('fixo')], ['parcela', 'Parcelas', of('parcela')], ['dia', 'Dia a dia', of('dia')]])
    : parts([['salario', 'Salário', of('salario')], ['extra', 'Rendas extras', of('extra')]])
}

/** Débito × crédito: só dá para saber nos gastos que vieram do banco; os lançados à mão ficam como "não informado". */
export function byMethod(txs: Transaction[], accounts: BankAccount[]): Part[] {
  const credit = new Set(accounts.filter((a) => a.type === 'CREDIT').map((a) => a.id))
  const t = txs.filter((x) => live(x) && x.kind === 'expense')
  const card = sum(t.filter((x) => x.bank_account_id && credit.has(x.bank_account_id)).map((x) => x.amount_cents))
  const debit = sum(t.filter((x) => x.bank_account_id && !credit.has(x.bank_account_id)).map((x) => x.amount_cents))
  const manual = sum(t.filter((x) => !x.bank_account_id).map((x) => x.amount_cents))
  return parts([['credito', 'Cartão de crédito', card], ['debito', 'Débito e Pix', debit], ['manual', 'Lançado à mão', manual]])
}

export type MonthPoint = { key: string; label: string; income: number; expense: number; balance: number }

/** Renda e gastos de cada um dos últimos `n` meses, terminando em `ym` (do mais antigo ao mais novo). */
export function monthlySeries(txs: Transaction[], ym: YearMonth, n: number): MonthPoint[] {
  return Array.from({ length: n }, (_, i) => addMonths(ym, i - n + 1)).map((m) => {
    const key = monthKey(m)
    const month = txs.filter((t) => live(t) && inMonth(t, key))
    const income = sum(month.filter((t) => t.kind === 'income').map((t) => t.amount_cents))
    const expense = sum(month.filter((t) => t.kind === 'expense').map((t) => t.amount_cents))
    return { key, label: monthShort(m), income, expense, balance: income - expense }
  })
}

export const average = (xs: number[]) => {
  const v = xs.filter((x) => x > 0)
  return v.length ? Math.round(sum(v) / v.length) : 0
}

export type BalancePoint = { day: number; real: number | null; previsto: number | null }

/**
 * Saldo do mês dia a dia: o que entrou menos o que saiu, acumulado.
 * Até hoje é o real; depois de hoje, a previsão soma as contas que ainda vão vencer e
 * o gasto do dia a dia na média do que já foi gasto por dia.
 */
export function balanceProjection(monthTxs: Transaction[], ym: YearMonth, today: string): BalancePoint[] {
  const days = daysInMonth(ym)
  const key = monthKey(ym)
  const txs = monthTxs.filter((t) => live(t) && inMonth(t, key))
  const todayKey = monthKey(monthOf(today))
  const cut = todayKey === key ? dayOf(today) : todayKey > key ? days : 0
  const daily = sum(txs.filter((t) => t.type === 'dia' && dayOf(t.date) <= cut).map((t) => t.amount_cents))
  const dailyAvg = cut > 0 ? daily / cut : 0
  let acc = 0
  const out: BalancePoint[] = []
  for (let d = 1; d <= days; d++) {
    const date = isoDate(ym, d)
    const move = sum(txs.filter((t) => t.date === date).map((t) => (t.kind === 'income' ? t.amount_cents : -t.amount_cents)))
    if (d <= cut) {
      acc += move
      out.push({ day: d, real: acc, previsto: d === cut ? acc : null })
    } else {
      // Futuro: entram as contas marcadas para o dia; o dia a dia segue a média
      const planned = sum(txs.filter((t) => t.date === date && t.type !== 'dia').map((t) => (t.kind === 'income' ? t.amount_cents : -t.amount_cents)))
      acc += planned - dailyAvg
      out.push({ day: d, real: null, previsto: Math.round(acc) })
    }
  }
  return out
}

/** Gasto do dia a dia em cada dia do mês (para o mapa de calor). */
export function dailySpend(monthTxs: Transaction[], ym: YearMonth): { day: number; date: string; cents: number }[] {
  return Array.from({ length: daysInMonth(ym) }, (_, i) => {
    const date = isoDate(ym, i + 1)
    return { day: i + 1, date, cents: sum(monthTxs.filter((t) => live(t) && t.type === 'dia' && t.date === date).map((t) => t.amount_cents)) }
  })
}

/** Total guardado nas caixinhas no fim de cada mês (evolução). */
export function savedSeries(moves: GoalMove[], ym: YearMonth, n: number): { key: string; label: string; saved: number }[] {
  return Array.from({ length: n }, (_, i) => addMonths(ym, i - n + 1)).map((m) => {
    const key = monthKey(m)
    return { key, label: monthShort(m), saved: sum(moves.filter((x) => monthKey(monthOf(x.date)) <= key).map((x) => x.amount_cents)) }
  })
}

/**
 * Para onde vai o dinheiro do mês: fixos, parcelas, dia a dia, caixinhas (o plano do mês) e a sobra.
 * Usa o MESMO resumo da tela inicial, então a sobra aqui é igual à "Sobra do mês" de lá.
 */
export function salaryFlow(s: MonthSummary): Part[] {
  const entries: [string, string, number][] = [
    ['fixo', 'Fixos', s.fixed],
    ['parcela', 'Parcelas', s.installments],
    ['dia', 'Dia a dia', s.daily],
    ['caixinhas', 'Caixinhas', s.save],
    ['sobra', 'Sobra', Math.max(0, s.free)],
  ]
  const total = Math.max(s.income, s.fixed + s.installments + s.daily + s.save)
  return entries.map(([k, label, cents]) => ({ key: k, label, cents, pct: total ? cents / total : 0 }))
}

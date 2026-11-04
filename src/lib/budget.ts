// Regras do orçamento do mês. Tudo em centavos inteiros; o app calcula e a tela só mostra.
import type { BudgetMove, Category, Recurring, Transaction } from '../types'
import { addDaysISO, daysInMonth, dayOf, monthKey, monthOf, weekdayOf } from './dates'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const counts = (t: Transaction) => !t.skipped

export type MonthSummary = {
  salary: number
  extra: number
  income: number
  fixed: number
  installments: number
  /** fixos + parcelas: dinheiro que já tem dono */
  committed: number
  daily: number
  save: number
  /** o que sobra se nada mais for gasto: renda − comprometido − guardar − dia a dia */
  free: number
}

/** Resumo do mês (passe só os lançamentos do mês). `save` = quanto separar para as caixinhas. */
export function summarizeMonth(txs: Transaction[], save: number): MonthSummary {
  const live = txs.filter(counts)
  const total = (pred: (t: Transaction) => boolean) => sum(live.filter(pred).map((t) => t.amount_cents))
  const salary = total((t) => t.type === 'salario')
  const extra = total((t) => t.type === 'extra')
  const fixed = total((t) => t.type === 'fixo')
  const installments = total((t) => t.type === 'parcela')
  const daily = total((t) => t.type === 'dia')
  const income = salary + extra
  const committed = fixed + installments
  return { salary, extra, income, fixed, installments, committed, daily, save, free: income - committed - save - daily }
}

export type TodayBudget = {
  /** dias que faltam no mês, contando hoje */
  daysLeft: number
  /** quanto dá para gastar por dia (calculado com o que foi gasto até ontem) */
  dailyAllowance: number
  spentToday: number
  /** quanto ainda pode gastar hoje (negativo = passou do valor do dia) */
  leftToday: number
  /** o que tinha disponível para o dia a dia no começo de hoje */
  availableFromToday: number
}

/**
 * "Quanto posso gastar hoje":
 *   (renda − fixos e parcelas − caixinhas do mês − já gasto no dia a dia até ontem) ÷ dias que faltam (com hoje)
 * O gasto de hoje sai do valor de hoje; amanhã a conta é refeita (gastar menos hoje aumenta os próximos dias).
 */
export function spendToday(monthTxs: Transaction[], save: number, today: string): TodayBudget {
  const ym = monthOf(today)
  const live = monthTxs.filter(counts)
  const s = summarizeMonth(live, save)
  const dailyBefore = sum(live.filter((t) => t.type === 'dia' && t.date < today).map((t) => t.amount_cents))
  const spentToday = sum(live.filter((t) => t.type === 'dia' && t.date === today).map((t) => t.amount_cents))
  const daysLeft = daysInMonth(ym) - dayOf(today) + 1
  const availableFromToday = s.income - s.committed - save - dailyBefore
  const dailyAllowance = availableFromToday > 0 ? Math.floor(availableFromToday / daysLeft) : 0
  return { daysLeft, dailyAllowance, spentToday, leftToday: dailyAllowance - spentToday, availableFromToday }
}

// ---------------------------------------------------------------------------
// Orçamento por categoria
// ---------------------------------------------------------------------------

export type Level = 'ok' | 'warn' | 'over'

export function levelOf(spent: number, limit: number | null): Level {
  if (limit == null) return 'ok'
  if (limit <= 0) return spent > 0 ? 'over' : 'ok'
  if (spent >= limit) return 'over'
  if (spent >= limit * 0.8) return 'warn'
  return 'ok'
}

/** Semana de segunda a domingo que contém o dia. */
export function weekRange(today: string): { start: string; end: string } {
  const back = (weekdayOf(today) + 6) % 7
  const start = addDaysISO(today, -back)
  return { start, end: addDaysISO(start, 6) }
}

export type CategoryStatus = {
  category: Category
  spent: number
  /** limite do mês já com o que foi movido de/para outras categorias */
  limit: number | null
  level: Level
  weekSpent: number
  weekLimit: number | null
  weekLevel: Level
}

/** Limite efetivo do mês: limite da categoria + o que recebeu − o que cedeu (estilo YNAB). */
export function effectiveLimit(category: Category, moves: BudgetMove[]): number | null {
  const received = sum(moves.filter((m) => m.to_category === category.id).map((m) => m.amount_cents))
  const given = sum(moves.filter((m) => m.from_category === category.id).map((m) => m.amount_cents))
  if (category.monthly_limit_cents == null && received === 0) return null
  return (category.monthly_limit_cents ?? 0) + received - given
}

/**
 * Situação de cada categoria de gasto: no mês conta tudo (fixos, parcelas e dia a dia); na semana, só o dia a dia.
 * `recentTxs` deve cobrir a semana de `today` (pode atravessar o mês).
 */
export function categoryStatuses(categories: Category[], monthTxs: Transaction[], moves: BudgetMove[], recentTxs: Transaction[], today: string | null): CategoryStatus[] {
  const week = today ? weekRange(today) : null
  return categories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .map((category) => {
      const spent = sum(monthTxs.filter((t) => counts(t) && t.kind === 'expense' && t.category_id === category.id).map((t) => t.amount_cents))
      const weekSpent = week
        ? sum(recentTxs.filter((t) => counts(t) && t.type === 'dia' && t.category_id === category.id && t.date >= week.start && t.date <= week.end).map((t) => t.amount_cents))
        : 0
      const limit = effectiveLimit(category, moves)
      const weekLimit = week ? category.weekly_limit_cents : null
      return { category, spent, limit, level: levelOf(spent, limit), weekSpent, weekLimit, weekLevel: levelOf(weekSpent, weekLimit) }
    })
}

/** De onde dá para tirar para cobrir uma categoria estourada: as que ainda têm sobra, da maior para a menor. */
export function coverOptions(statuses: CategoryStatus[], overId: string): { category: Category; available: number }[] {
  return statuses
    .filter((s) => s.category.id !== overId && s.limit != null && s.limit - s.spent > 0)
    .map((s) => ({ category: s.category, available: s.limit! - s.spent }))
    .sort((a, b) => b.available - a.available)
}

// ---------------------------------------------------------------------------
// Regra 50/30/20
// ---------------------------------------------------------------------------

export type Rule503020 = { income: number; needs: number; wants: number; save: number; pct: { needs: number; wants: number; save: number } }

/** Necessidades (50%), desejos (30%) e guardar (20%), em % da renda do mês. Sem categoria conta como desejo. */
export function rule503020(monthTxs: Transaction[], categories: Category[], save: number): Rule503020 {
  const group = new Map(categories.map((c) => [c.id, c.grp]))
  const live = monthTxs.filter((t) => counts(t))
  const income = sum(live.filter((t) => t.kind === 'income').map((t) => t.amount_cents))
  const expenses = live.filter((t) => t.kind === 'expense')
  const needs = sum(expenses.filter((t) => group.get(t.category_id ?? '') === 'necessidade').map((t) => t.amount_cents))
  const wants = sum(expenses.map((t) => t.amount_cents)) - needs
  const pct = (v: number) => (income > 0 ? Math.round((v / income) * 100) : 0)
  return { income, needs, wants, save, pct: { needs: pct(needs), wants: pct(wants), save: pct(save) } }
}

// ---------------------------------------------------------------------------
// Caçador de assinaturas
// ---------------------------------------------------------------------------

export type Subscription = { key: string; description: string; monthlyCents: number; yearlyCents: number; source: 'fixo' | 'detectado'; categoryId: string | null }

export const normalizeText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/**
 * Tudo que se repete: os gastos fixos ativos e os gastos do dia a dia que aparecem em 3 meses ou mais
 * com valor parecido (±10%). Total por ano = valor do mês × 12.
 */
export function subscriptions(recurrings: Recurring[], history: Transaction[]): { items: Subscription[]; yearlyCents: number } {
  const items: Subscription[] = recurrings
    .filter((r) => r.active && !r.end_month)
    .map((r) => ({ key: `fixo:${r.id}`, description: r.description, monthlyCents: r.amount_cents, yearlyCents: r.amount_cents * 12, source: 'fixo' as const, categoryId: r.category_id }))
  const known = new Set(items.map((i) => normalizeText(i.description)))

  const groups = new Map<string, Transaction[]>()
  for (const t of history) {
    if (!counts(t) || t.type !== 'dia') continue
    const k = normalizeText(t.description)
    if (known.has(k)) continue
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  for (const [k, list] of groups) {
    const months = new Set(list.map((t) => monthKey(monthOf(t.date))))
    if (months.size < 3) continue
    const amounts = list.map((t) => t.amount_cents)
    const mid = median(amounts)
    if (amounts.some((a) => Math.abs(a - mid) > mid * 0.1)) continue
    const last = [...list].sort((a, b) => b.date.localeCompare(a.date))[0]
    items.push({ key: `detectado:${k}`, description: last.description, monthlyCents: mid, yearlyCents: mid * 12, source: 'detectado', categoryId: last.category_id })
  }
  items.sort((a, b) => b.yearlyCents - a.yearlyCents)
  return { items, yearlyCents: sum(items.map((i) => i.yearlyCents)) }
}

// ---------------------------------------------------------------------------
// Lançamento rápido
// ---------------------------------------------------------------------------

export type QuickPick = { description: string; categoryId: string | null; amountCents: number; times: number }

/** Os gastos do dia a dia mais comuns (com o último valor), para lançar com um toque. */
export function quickPicks(recent: Transaction[], limit = 6): QuickPick[] {
  const map = new Map<string, { last: Transaction; times: number }>()
  for (const t of recent) {
    if (t.type !== 'dia' || t.skipped) continue
    const k = normalizeText(t.description)
    const cur = map.get(k)
    if (!cur) map.set(k, { last: t, times: 1 })
    else {
      cur.times++
      if (t.date > cur.last.date || (t.date === cur.last.date && t.created_at > cur.last.created_at)) cur.last = t
    }
  }
  return [...map.values()]
    .sort((a, b) => b.times - a.times || b.last.date.localeCompare(a.last.date))
    .slice(0, limit)
    .map(({ last, times }) => ({ description: last.description, categoryId: last.category_id, amountCents: last.amount_cents, times }))
}

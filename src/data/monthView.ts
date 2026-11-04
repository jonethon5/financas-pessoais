// Tudo o que as telas Início e Mês precisam de um mês, já calculado.
import { categoryStatuses, spendToday, summarizeMonth } from '../lib/budget'
import { currentYearMonth, sameYearMonth, todayISO, type YearMonth } from '../lib/dates'
import { useBudgetMoves, useCategories, useHistory, useMonthPlan, useMonthTxs } from './finance'
import { useProfile } from './hooks'

export function useMonthView(ym: YearMonth) {
  const profile = useProfile()
  const txs = useMonthTxs(ym)
  const plan = useMonthPlan(ym)
  const moves = useBudgetMoves(ym)
  const categories = useCategories()
  const history = useHistory(6)

  const queries = [profile, txs, plan, moves, categories]
  const isPending = queries.some((q) => q.isPending)
  const error = queries.find((q) => q.error)?.error ?? null
  const isCurrent = sameYearMonth(ym, currentYearMonth())
  const today = todayISO()

  if (isPending || error) return { isPending, error, data: null, refetch: () => queries.forEach((q) => q.refetch()) }

  const monthTxs = txs.data!
  const save = plan.data?.save_cents ?? 0
  const summary = summarizeMonth(monthTxs, save)
  const todayBudget = isCurrent ? spendToday(monthTxs, save, today) : null
  // Histórico + mês sem repetir (o histórico já inclui o mês atual)
  const recent = [...new Map([...(history.data ?? []), ...monthTxs].map((t) => [t.id, t])).values()]
  const statuses = categoryStatuses(categories.data!, monthTxs, moves.data!, recent, isCurrent ? today : null)
  return {
    isPending: false,
    error: null,
    refetch: () => queries.forEach((q) => q.refetch()),
    data: { profile: profile.data!, txs: monthTxs, plan: plan.data ?? null, moves: moves.data!, categories: categories.data!, history: history.data ?? [], summary, todayBudget, statuses, isCurrent, today },
  }
}

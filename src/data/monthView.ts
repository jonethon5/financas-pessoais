// Tudo o que as telas Início e Mês precisam de um mês, já calculado.
import { categoryStatuses, spendToday, summarizeMonth } from '../lib/budget'
import { currentYearMonth, sameYearMonth, todayISO, type YearMonth } from '../lib/dates'
import { goalStatus, monthGoalPlan } from '../lib/goals'
import { useBudgetMoves, useCategories, useGoalMoves, useGoals, useHistory, useMonthPlan, useMonthTxs } from './finance'
import { useProfile } from './hooks'

export function useMonthView(ym: YearMonth) {
  const profile = useProfile()
  const txs = useMonthTxs(ym)
  const plan = useMonthPlan(ym)
  const moves = useBudgetMoves(ym)
  const categories = useCategories()
  const history = useHistory(6)
  const goals = useGoals()
  const goalMoves = useGoalMoves()

  const queries = [profile, txs, plan, moves, categories, goals, goalMoves]
  const isPending = queries.some((q) => q.isPending)
  const error = queries.find((q) => q.error)?.error ?? null
  const isCurrent = sameYearMonth(ym, currentYearMonth())
  const today = todayISO()

  if (isPending || error) return { isPending, error, data: null, refetch: () => queries.forEach((q) => q.refetch()) }

  const monthTxs = txs.data!
  // Com caixinhas, "guardar este mês" = o que elas pedem (ou o que já foi guardado, se for mais).
  // Sem caixinhas, vale o valor informado em "Separar o salário".
  const activeGoals = goals.data!.filter((g) => !g.archived)
  const goalStatuses = activeGoals.map((g) => ({ goal: g, status: goalStatus(g, goalMoves.data!, ym) }))
  const depositedThisMonth = goalStatuses.reduce((a, g) => a + Math.max(0, g.status.savedThisMonth), 0)
  const save = activeGoals.length ? Math.max(monthGoalPlan(goalStatuses.map((g) => g.status)), depositedThisMonth) : (plan.data?.save_cents ?? 0)
  const summary = summarizeMonth(monthTxs, save)
  const todayBudget = isCurrent ? spendToday(monthTxs, save, today) : null
  // Histórico + mês sem repetir (o histórico já inclui o mês atual)
  const recent = [...new Map([...(history.data ?? []), ...monthTxs].map((t) => [t.id, t])).values()]
  const statuses = categoryStatuses(categories.data!, monthTxs, moves.data!, recent, isCurrent ? today : null)
  return {
    isPending: false,
    error: null,
    refetch: () => queries.forEach((q) => q.refetch()),
    data: { profile: profile.data!, txs: monthTxs, plan: plan.data ?? null, moves: moves.data!, categories: categories.data!, history: history.data ?? [], goals: goalStatuses, goalMoves: goalMoves.data!, summary, todayBudget, statuses, isCurrent, today },
  }
}

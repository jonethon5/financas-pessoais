// Dados do orçamento (categorias, fixos, lançamentos, plano do mês) com TanStack Query.
// Todas as chaves começam com ['t', tabela]: gravar numa tabela recarrega o que depende dela.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { defaultCategories } from '../lib/categories'
import { addMonths, compareYearMonth, currentYearMonth, firstDayISO, lastDayISO, monthKey, type YearMonth } from '../lib/dates'
import { expectedMonthRows, missingRows } from '../lib/recurring'
import { supabase } from '../lib/supabase'
import type { MonthPlan, NewRow, Profile, TableName, Tables, Transaction } from '../types'
import { useBackend, type Backend } from './backend'
import { useProfile } from './hooks'

export type MonthTx = Transaction & { /** previsto (mês que ainda não chegou), ainda não gravado */ virtual?: boolean }

export const tkey = (table: TableName, ...rest: (string | number)[]) => ['t', table, ...rest] as const

export function useCategories() {
  const backend = useBackend()
  return useQuery({
    queryKey: tkey('categories'),
    queryFn: async () => {
      let list = await backend.list('categories', { order: 'sort' })
      if (list.length === 0) {
        // Primeiro acesso: categorias padrão (da planilha de orçamento)
        await backend.insert('categories', defaultCategories())
        list = await backend.list('categories', { order: 'sort' })
      }
      return list
    },
    staleTime: 5 * 60_000,
  })
}

export function useRecurrings() {
  const backend = useBackend()
  return useQuery({ queryKey: tkey('recurrings'), queryFn: () => backend.list('recurrings', { order: 'day' }) })
}

/** Cria (se faltar) o salário e os fixos do mês atual. Meses futuros só mostram como "previsto". */
async function loadMonth(backend: Backend, ym: YearMonth, userId: string, profile: Profile): Promise<MonthTx[]> {
  const range = { gte: ['date', firstDayISO(ym)] as [string, string], lte: ['date', lastDayISO(ym)] as [string, string], order: 'date' }
  const existing = await backend.list('transactions', range)
  const cmp = compareYearMonth(ym, currentYearMonth())
  if (cmp < 0) return existing

  const [recurrings, categories] = await Promise.all([backend.list('recurrings'), backend.list('categories')])
  const salaryCat = categories.find((c) => c.kind === 'income' && c.name === 'Salário')?.id ?? null
  const missing = missingRows(await expectedMonthRows(ym, userId, profile, recurrings, salaryCat), existing)
  if (!missing.length) return existing
  if (cmp === 0) {
    await backend.insert('transactions', missing, { ignoreDuplicates: true })
    return backend.list('transactions', range)
  }
  const now = new Date().toISOString()
  return [...existing, ...missing.map((r) => ({ ...r, user_id: userId, created_at: now, virtual: true }))].sort((a, b) => a.date.localeCompare(b.date))
}

export function useMonthTxs(ym: YearMonth) {
  const backend = useBackend()
  const { userId } = useAuth()
  const profile = useProfile()
  return useQuery({
    queryKey: [...tkey('transactions', 'month', monthKey(ym)), profile.data?.salary_cents ?? 0, profile.data?.payday ?? 0],
    queryFn: () => loadMonth(backend, ym, userId!, profile.data!),
    enabled: Boolean(profile.data && userId),
  })
}

/** Lançamentos dos últimos meses (sugestões rápidas, semana, caçador de assinaturas). */
export function useHistory(months = 6) {
  const backend = useBackend()
  const ym = currentYearMonth()
  const from = firstDayISO(addMonths(ym, -months))
  const to = lastDayISO(ym)
  return useQuery({
    queryKey: tkey('transactions', 'history', from, to),
    queryFn: () => backend.list('transactions', { gte: ['date', from], lte: ['date', to], order: 'date' }),
  })
}

export function useGoals() {
  const backend = useBackend()
  return useQuery({ queryKey: tkey('goals'), queryFn: () => backend.list('goals', { order: 'priority' }) })
}

export function useGoalMoves() {
  const backend = useBackend()
  return useQuery({ queryKey: tkey('goal_moves'), queryFn: () => backend.list('goal_moves', { order: 'date' }) })
}

export function useBudgetMoves(ym: YearMonth) {
  const backend = useBackend()
  const month = monthKey(ym)
  return useQuery({ queryKey: tkey('budget_moves', month), queryFn: () => backend.list('budget_moves', { eq: { month } }) })
}

export function useMonthPlan(ym: YearMonth) {
  const backend = useBackend()
  const month = monthKey(ym)
  return useQuery({
    queryKey: tkey('month_plans', month),
    queryFn: async (): Promise<MonthPlan | null> => (await backend.list('month_plans', { eq: { month } }))[0] ?? null,
  })
}

/** Gravações: cada uma recarrega as consultas das tabelas que mexeu. */
export function useWrite() {
  const backend = useBackend()
  const qc = useQueryClient()
  const refresh = (...tables: TableName[]) => Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: ['t', t] })))
  return useMutation({
    mutationFn: async (fn: (b: Backend) => Promise<unknown>) => fn(backend),
    onSettled: () => refresh('categories', 'recurrings', 'transactions', 'budget_moves', 'month_plans', 'goals', 'goal_moves'),
  })
}

export async function savePlan(backend: Backend, ym: YearMonth, patch: Partial<Pick<MonthPlan, 'save_cents' | 'split_done_at'>>, current: MonthPlan | null) {
  const row: NewRow<'month_plans'> = { month: monthKey(ym), save_cents: current?.save_cents ?? 0, split_done_at: current?.split_done_at ?? null, ...patch }
  await backend.upsert('month_plans', row, 'user_id,month')
}

/** Tempo real: mudanças feitas em outro aparelho aparecem aqui na hora. */
export function useRealtime() {
  const { mode, userId } = useAuth()
  const qc = useQueryClient()
  useEffect(() => {
    if (mode !== 'supabase' || !userId) return
    const tables: (keyof Tables)[] = ['categories', 'recurrings', 'transactions', 'budget_moves', 'month_plans', 'goals', 'goal_moves']
    let channel = supabase.channel(`dados-${userId}`)
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () =>
        qc.invalidateQueries({ queryKey: ['t', table] }),
      )
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [mode, userId, qc])
}

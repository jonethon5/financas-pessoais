// Regras das caixinhas. Tudo em centavos inteiros. O dinheiro fica no banco; aqui só calculamos o plano.
import type { Goal, GoalMode, GoalMove } from '../types'
import { addMonths, compareYearMonth, monthKey, monthOf, monthsBetween, parseMonthKey, type YearMonth } from './dates'

export type GoalTemplate = { key: string; name: string; icon: string; color: string; mode: GoalMode; hint: string; why: string }

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { key: 'reserva', name: 'Reserva de emergência', icon: 'lifebuoy', color: '#0B7F5A', mode: 'mensal', hint: 'O ideal é juntar de 3 a 6 meses dos seus gastos.', why: 'Dormir tranquilo sabendo que um imprevisto não vira dívida.' },
  { key: 'viagem', name: 'Viagem', icon: 'airplane', color: '#2F6F8F', mode: 'data', hint: 'Escolha o mês da viagem e veja quanto guardar por mês.', why: 'Ver o mar com quem eu amo, sem voltar endividado.' },
  { key: 'compra', name: 'Comprar algo', icon: 'bag', color: '#6E56F0', mode: 'data', hint: 'Juntar antes de comprar sai mais barato que parcelar com juros.', why: 'Comprar à vista, com desconto e sem parcela me perseguindo.' },
  { key: 'presente', name: 'Presente', icon: 'gift', color: '#D6457A', mode: 'data', hint: 'Aniversário, Natal, Dia das Mães: sem aperto na data.', why: 'Ver a cara de alegria de quem eu gosto.' },
  { key: 'estudos', name: 'Estudos', icon: 'graduation', color: '#0F2433', mode: 'mensal', hint: 'Curso, faculdade, livros, certificação.', why: 'Investir em mim para ganhar mais e trabalhar com o que gosto.' },
  { key: 'carro', name: 'Carro', icon: 'car', color: '#C2410C', mode: 'mensal', hint: 'Entrada, manutenção, IPVA ou a habilitação.', why: 'Ter liberdade para ir e vir e mais tempo com a família.' },
  { key: 'livre', name: 'Outro', icon: 'piggy', color: '#0F9D6B', mode: 'livre', hint: 'Qualquer outro objetivo: você dá o nome, com ou sem valor final.', why: 'O que esse dinheiro vai mudar na sua vida?' },
]

export const MILESTONES = [0.25, 0.5, 0.75, 1]

/** Arredonda para cima até o real inteiro (R$ 333,34 → R$ 334,00): plano fácil de lembrar. */
const upToReal = (cents: number) => Math.ceil(cents / 100) * 100

export type GoalStatus = {
  saved: number
  savedBeforeMonth: number
  savedThisMonth: number
  target: number | null
  /** 0 a 1 (pode passar de 1) */
  progress: number | null
  /** quanto guardar por mês, já recalculado (null = sem plano) */
  perMonth: number | null
  perWeek: number | null
  /** o que falta guardar este mês para seguir o plano */
  needThisMonth: number
  /** mês em que chega no valor (null = sem valor final ou sem ritmo) */
  eta: YearMonth | null
  done: boolean
  /** passou do mês combinado sem chegar */
  late: boolean
}

export function goalStatus(goal: Goal, moves: GoalMove[], ym: YearMonth): GoalStatus {
  const mine = moves.filter((m) => m.goal_id === goal.id)
  const key = monthKey(ym)
  const saved = mine.reduce((a, m) => a + m.amount_cents, 0)
  const savedThisMonth = mine.filter((m) => m.kind !== 'inicial' && monthKey(monthOf(m.date)) === key).reduce((a, m) => a + m.amount_cents, 0)
  const savedBeforeMonth = saved - savedThisMonth
  const target = goal.mode === 'livre' ? (goal.target_cents ?? null) : goal.target_cents
  const progress = target ? saved / target : null
  const done = target != null && saved >= target
  let perMonth: number | null = null
  let eta: YearMonth | null = null
  let late = false

  if (goal.mode === 'data' && target != null) {
    const until = parseMonthKey(goal.target_month)!
    late = !done && compareYearMonth(ym, until) > 0
    // Recalcula sozinho: o que falta (desde o começo do mês) dividido pelos meses que restam, contando este
    const monthsLeft = Math.max(1, monthsBetween(ym, until) + 1)
    perMonth = done ? 0 : upToReal(Math.max(0, target - savedBeforeMonth) / monthsLeft)
    eta = done ? ym : until
  } else if ((goal.mode === 'mensal' || goal.mode === 'livre') && target != null) {
    // Por mês (e "livre" com valor final): previsão de quando chega
    perMonth = done ? 0 : (goal.monthly_cents ?? (goal.mode === 'mensal' ? 0 : null))
    if (done) eta = ym
    else if (perMonth != null && perMonth > 0) {
      // Conta o depósito deste mês (o que já foi ou o do plano) e vê quantos meses faltam depois dele
      const afterThisMonth = target - Math.max(saved, savedBeforeMonth + perMonth)
      eta = afterThisMonth <= 0 ? ym : addMonths(ym, Math.ceil(afterThisMonth / perMonth))
    }
  } else {
    perMonth = goal.monthly_cents || null
  }

  const needThisMonth = perMonth ? Math.max(0, perMonth - savedThisMonth) : 0
  return { saved, savedBeforeMonth, savedThisMonth, target, progress, perMonth, perWeek: perMonth ? upToReal((perMonth * 12) / 52) : null, needThisMonth, eta, done, late }
}

/** Quanto das caixinhas o plano reserva neste mês (entra no "quanto posso gastar hoje"). */
export function monthGoalPlan(statuses: GoalStatus[]): number {
  return statuses.reduce((a, s) => a + (s.done ? 0 : (s.perMonth ?? 0)), 0)
}

export type WithdrawImpact = {
  /** quantos meses a mais para chegar (mantendo o ritmo atual) */
  delayMonths: number | null
  /** quanto a mais por mês para manter a data (caixinha com data) */
  extraPerMonth: number | null
  progressAfter: number | null
}

/** "Freio" antes de retirar: mostra o impacto na meta. */
export function withdrawImpact(goal: Goal, moves: GoalMove[], amount: number, ym: YearMonth): WithdrawImpact {
  const before = goalStatus(goal, moves, ym)
  const fake: GoalMove = { id: 'simulacao', user_id: '', goal_id: goal.id, kind: 'retirada', amount_cents: -amount, date: `${monthKey(ym)}-01`, note: null, created_at: '' }
  // A retirada simulada conta como "antes deste mês" para recalcular o plano dos próximos meses
  const after = goalStatus(goal, [...moves, { ...fake, kind: 'inicial' }], ym)
  const progressAfter = after.target ? Math.max(0, after.saved) / after.target : null
  if (goal.mode === 'data') {
    const pace = before.perMonth || 0
    return { delayMonths: pace > 0 ? Math.ceil(amount / pace) : null, extraPerMonth: Math.max(0, (after.perMonth ?? 0) - (before.perMonth ?? 0)), progressAfter }
  }
  if (goal.mode === 'mensal' && before.eta && after.eta) {
    return { delayMonths: Math.max(0, monthsBetween(before.eta, after.eta)), extraPerMonth: null, progressAfter }
  }
  return { delayMonths: null, extraPerMonth: null, progressAfter }
}

/** Marcos (25%, 50%, 75%, 100%) que o depósito acabou de passar. */
export function crossedMilestones(savedBefore: number, savedAfter: number, target: number | null): number[] {
  if (!target) return []
  return MILESTONES.filter((m) => savedBefore < target * m && savedAfter >= target * m)
}

export type Allocation = { goalId: string; cents: number }

/**
 * Para onde vai a sobra: completa o que falta neste mês em cada caixinha, na ordem de prioridade;
 * o que ainda sobrar vai para a primeira da lista que não está completa.
 */
export function distribute(amount: number, goals: { goal: Goal; status: GoalStatus }[]): Allocation[] {
  const queue = goals.filter((g) => !g.goal.archived && !g.status.done).sort((a, b) => a.goal.priority - b.goal.priority || a.goal.created_at.localeCompare(b.goal.created_at))
  const out = new Map<string, number>()
  let left = amount
  for (const g of queue) {
    if (left <= 0) break
    const take = Math.min(left, g.status.needThisMonth, g.status.target != null ? Math.max(0, g.status.target - g.status.saved) : Infinity)
    if (take > 0) {
      out.set(g.goal.id, take)
      left -= take
    }
  }
  if (left > 0 && queue.length) {
    const first = queue.find((g) => g.status.target == null || g.status.saved + (out.get(g.goal.id) ?? 0) < g.status.target) ?? queue[0]
    out.set(first.goal.id, (out.get(first.goal.id) ?? 0) + left)
  }
  return [...out.entries()].map(([goalId, cents]) => ({ goalId, cents }))
}

/** Sugestão para a reserva de emergência: 6 meses do que a pessoa gasta por mês. */
export function emergencySuggestion(monthlyExpenses: number): number {
  return upToReal(monthlyExpenses * 6)
}

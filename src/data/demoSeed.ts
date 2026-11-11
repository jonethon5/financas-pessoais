// Dados de exemplo da demonstração: um mês realista (salário, fixos, uma compra parcelada e gastos do dia a dia),
// mais 3 meses anteriores para o histórico. Valores de exemplo, nada da vida real de ninguém.
import { defaultCategories } from '../lib/categories'
import { addMonths, currentYearMonth, dayOf, isoDate, monthKey, todayISO, type YearMonth } from '../lib/dates'
import { buildInstallments } from '../lib/installments'
import { expectedMonthRows } from '../lib/recurring'
import type { Category, Challenge, Goal, GoalMove, IfThenPlan, Recurring, Rule, Tables, Transaction, Wish } from '../types'
import { addDaysISO } from '../lib/dates'

const SALARY = 320000
const PAYDAY = 5

/** Número "aleatório" sempre igual para a mesma semente (os exemplos não mudam a cada visita). */
function pseudo(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export async function buildDemoData(): Promise<{ [K in keyof Tables]: Tables[K][] }> {
  const now = new Date().toISOString()
  const today = todayISO()
  const ym = currentYearMonth()
  const id = () => crypto.randomUUID()
  const categories: Category[] = defaultCategories().map((c) => ({ ...c, id: id(), user_id: 'demo', created_at: now }))
  const byName = (name: string) => categories.find((c) => c.name === name)!.id
  categories.find((c) => c.name === 'Delivery')!.monthly_limit_cents = 25000
  categories.find((c) => c.name === 'Delivery')!.weekly_limit_cents = 7000
  categories.find((c) => c.name === 'Lazer')!.monthly_limit_cents = 20000
  categories.find((c) => c.name === 'Mercado')!.monthly_limit_cents = 70000
  categories.find((c) => c.name === 'Transporte')!.monthly_limit_cents = 30000

  const start = monthKey(addMonths(ym, -3))
  const rec = (description: string, category: string, amount_cents: number, day: number): Recurring => ({
    id: id(), user_id: 'demo', description, category_id: byName(category), amount_cents, day, remind: true, start_month: start, end_month: null, active: true, created_at: now,
  })
  const recurrings = [
    rec('Ajuda em casa', 'Casa', 50000, 10),
    rec('Faculdade', 'Educação', 21400, 10),
    rec('Academia', 'Saúde', 8000, 5),
    rec('Telefone', 'Telefone e internet', 3900, 15),
    rec('YouTube Music', 'Assinaturas', 1290, 20),
  ]

  const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount_cents' | 'date' | 'description'>): Transaction => ({
    id: id(), user_id: 'demo', kind: p.type === 'salario' || p.type === 'extra' ? 'income' : 'expense', category_id: null, recurring_id: null,
    installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: now, ...p,
  })

  const transactions: Transaction[] = []
  // Salário e fixos dos meses anteriores (o mês atual é criado pelo app, como numa conta de verdade)
  for (let back = 3; back >= 1; back--) {
    const m = addMonths(ym, -back)
    for (const r of await expectedMonthRows(m, 'demo', { salary_cents: SALARY, payday: PAYDAY }, recurrings, byName('Salário'))) {
      transactions.push({ ...r, user_id: 'demo', created_at: now, paid: true })
    }
  }

  // Autoescola (CNH) em 10x, começou há 2 meses → este mês é a 3/10
  const group = id()
  for (const p of buildInstallments({ amountCents: 18000, mode: 'parcela', count: 10, firstDate: isoDate(addMonths(ym, -2), 12) })) {
    transactions.push(tx({ type: 'parcela', amount_cents: p.amountCents, date: p.date, description: 'Autoescola (CNH)', category_id: byName('Educação'), installment_group: group, installment_no: p.no, installment_total: p.total, paid: p.date < today }))
  }

  // Gastos do dia a dia (meses anteriores e este mês até hoje)
  const daily: [string, string, number, number][] = [
    // descrição, categoria, valor base, a cada quantos dias
    ['Uber', 'Transporte', 1900, 3],
    ['iFood', 'Delivery', 4200, 4],
    ['Mercado', 'Mercado', 11000, 7],
    ['Padaria', 'Mercado', 1300, 2],
    ['Shopee', 'Compras online', 5500, 12],
    ['Cinema', 'Lazer', 4800, 14],
  ]
  for (let back = 3; back >= 0; back--) {
    const m: YearMonth = addMonths(ym, -back)
    const lastDay = back === 0 ? dayOf(today) : 28
    for (let d = 1; d <= lastDay; d++) {
      daily.forEach(([description, category, base, every], i) => {
        if ((d + i) % every !== 0) return
        const r = pseudo(m.month * 100 + d * 7 + i)
        const amount = Math.round((base * (0.75 + r * 0.5)) / 10) * 10
        const emotion = description === 'iFood' && r > 0.6 ? ('cansado' as const) : description === 'Shopee' && r > 0.5 ? ('entediado' as const) : null
        transactions.push(tx({ type: 'dia', amount_cents: amount, date: isoDate(m, d), description, category_id: byName(category), emotion }))
      })
    }
    // Uma assinatura que não foi cadastrada como fixa (o caçador de assinaturas encontra)
    if (back >= 1) transactions.push(tx({ type: 'dia', amount_cents: 2190, date: isoDate(m, 3), description: 'Spotify', category_id: byName('Assinaturas') }))
  }
  transactions.push(tx({ type: 'extra', amount_cents: 40000, date: isoDate(addMonths(ym, -1), 18), description: 'Freela', category_id: byName('Renda extra') }))

  const month_plans = [-2, -1, 0].map((b) => ({ id: id(), user_id: 'demo', month: monthKey(addMonths(ym, b)), save_cents: 40000, split_done_at: b < 0 ? now : null, created_at: now }))
  const demoGoals = buildDemoGoals()
  return { categories, recurrings, transactions, budget_moves: [], month_plans, ...demoGoals, ...buildDemoHabits(demoGoals.goals), bank_connections: [], bank_accounts: [], category_rules: [], pig_coins: [], pig_purchases: [] }
}

/** Caixinhas de exemplo (inspiradas nas linhas "Reserva" da planilha). */
export function buildDemoGoals(): { goals: Goal[]; goal_moves: GoalMove[] } {
  const now = new Date().toISOString()
  const ym = currentYearMonth()
  const goals: Goal[] = []
  const goal_moves: GoalMove[] = []
  const add = (p: Omit<Goal, 'id' | 'user_id' | 'photo_path' | 'archived' | 'completed_at' | 'created_at' | 'motivation' | 'concrete_name' | 'concrete_cents'> & { motivation?: string | null; concrete_name?: string; concrete_cents?: number }, moves: [number, number, GoalMove['kind']?][]) => {
    const id = crypto.randomUUID()
    goals.push({ motivation: null, concrete_name: null, concrete_cents: null, ...p, id, user_id: 'demo', photo_path: null, archived: false, completed_at: null, created_at: now })
    for (const [back, cents, kind] of moves) {
      goal_moves.push({ id: crypto.randomUUID(), user_id: 'demo', goal_id: id, kind: kind ?? 'deposito', amount_cents: cents, date: isoDate(addMonths(ym, -back), 6), note: null, created_at: now })
    }
  }
  add({ motivation: 'Nunca mais entrar no cheque especial por causa de imprevisto.', name: 'Reserva de emergência', template: 'reserva', icon: 'lifebuoy', color: '#0B7F5A', mode: 'mensal', target_cents: 900000, target_month: null, monthly_cents: 30000, priority: 1 }, [
    [5, 270000, 'inicial'], [3, 30000], [2, 30000], [1, 30000],
  ])
  add({ concrete_name: 'diária do hotel', concrete_cents: 25000, motivation: 'Ver o mar com a minha mãe, sem voltar endividada.', name: 'Viagem para a praia', template: 'viagem', icon: 'airplane', color: '#2F6F8F', mode: 'data', target_cents: 600000, target_month: monthKey(addMonths(ym, 8)), monthly_cents: null, priority: 2 }, [
    [3, 120000, 'inicial'], [2, 40000], [1, 40000],
  ])
  add({ name: 'Monitor novo', template: 'compra', icon: 'monitor', color: '#6E56F0', mode: 'data', target_cents: 90000, target_month: monthKey(addMonths(ym, 1)), monthly_cents: null, priority: 3 }, [
    [4, 49700, 'inicial'], [2, 18000], [1, 13300],
  ])
  add({ name: 'Forro do quarto', template: 'livre', icon: 'house', color: '#C2410C', mode: 'livre', target_cents: 120000, target_month: null, monthly_cents: 10000, priority: 4 }, [[2, 25000], [1, 10000]])
  return { goals, goal_moves }
}

/** Hábitos de exemplo: um desafio em andamento, uma regra, a lista de desejos e um plano "se… então". */
export function buildDemoHabits(goals: Goal[]): { challenges: Challenge[]; rules: Rule[]; wishes: Wish[]; if_then_plans: IfThenPlan[] } {
  const now = new Date().toISOString()
  const today = todayISO()
  const reserva = goals.find((g) => g.template === 'reserva') ?? goals[0]
  const viagem = goals.find((g) => g.template === 'viagem') ?? goals[0]
  const id = () => crypto.randomUUID()
  return {
    challenges: [
      { id: id(), user_id: 'demo', kind: 'sem_delivery', title: '7 dias sem delivery', params: {}, goal_id: null, started_on: addDaysISO(today, -2), ends_on: addDaysISO(today, 4), status: 'ativo', created_at: now },
    ],
    rules: reserva ? [{ id: id(), user_id: 'demo', kind: 'arredondar', goal_id: reserva.id, params: { step_cents: 500 }, active: true, created_at: now }] : [],
    wishes: [
      { id: id(), user_id: 'demo', name: 'Tênis de corrida', price_cents: 45000, link: null, decide_on: addDaysISO(today, -2), status: 'esperando', decided_at: null, created_at: now },
      { id: id(), user_id: 'demo', name: 'Fone bluetooth', price_cents: 23000, link: null, decide_on: addDaysISO(today, 20), status: 'esperando', decided_at: null, created_at: now },
      { id: id(), user_id: 'demo', name: 'Jaqueta jeans', price_cents: 28000, link: null, decide_on: addDaysISO(today, -15), status: 'desisti', decided_at: now, created_at: now },
    ],
    if_then_plans: viagem
      ? [{ id: id(), user_id: 'demo', trigger_text: 'Se der vontade de pedir iFood na sexta à noite', action_text: `faço um lanche em casa e guardo R$ 30 na ${viagem.name}`, weekday: 5, active: true, created_at: now }]
      : [],
  }
}

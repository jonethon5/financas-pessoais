/**
 * Saúde financeira: uma nota de 0 a 100 com 5 pilares, inspirada nos indicadores do FinHealth Score
 * (Financial Health Network): gastar menos do que ganha, pagar contas em dia, ter reserva, guardar com
 * regularidade e planejar. Cada pilar sem dados fica de fora (a nota é proporcional ao que dá para medir).
 * O objetivo é mostrar o próximo passo, não dar bronca.
 */
import type { Category, Goal, GoalMove, Transaction } from '../types'
import type { GoalStatus } from './goals'
import { addMonths, monthKey, monthOf, type YearMonth } from './dates'

export type PillarId = 'gastos' | 'contas' | 'reserva' | 'guardar' | 'plano'
export type Pillar = {
  id: PillarId
  title: string
  max: number
  /** null = ainda sem dados para medir */
  score: number | null
  /** frase curta sobre a situação de agora */
  status: string
  /** o próximo passo, em uma frase */
  tip: string
  lesson: string
  to?: string
}
export type Health = { score: number | null; label: string; pillars: Pillar[]; next: Pillar[] }

export type HealthInput = {
  today: string
  monthTxs: Transaction[]
  history: Transaction[]
  goals: { goal: Goal; status: GoalStatus }[]
  goalMoves: GoalMove[]
  categories: Category[]
  hasSalary: boolean
}

const live = (t: Transaction) => !t.skipped
const isExpense = (t: Transaction) => t.type === 'fixo' || t.type === 'parcela' || t.type === 'dia'
const isIncome = (t: Transaction) => t.type === 'salario' || t.type === 'extra'
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Meses completos anteriores ao atual (até 3) com renda e gastos. */
function pastMonths(history: Transaction[], ym: YearMonth, n = 3) {
  const out: { key: string; income: number; expenses: number }[] = []
  for (let i = 1; i <= n; i++) {
    const key = monthKey(addMonths(ym, -i))
    const txs = history.filter((t) => live(t) && monthKey(monthOf(t.date)) === key)
    const income = txs.filter(isIncome).reduce((a, t) => a + t.amount_cents, 0)
    const expenses = txs.filter(isExpense).reduce((a, t) => a + t.amount_cents, 0)
    if (income > 0 || expenses > 0) out.push({ key, income, expenses })
  }
  return out
}

export const isEmergencyGoal = (g: Goal) => g.template === 'reserva' || /reserva|emerg[eê]ncia|imprevisto/i.test(g.name)

export function healthLabel(score: number): string {
  if (score >= 80) return 'Saudável'
  if (score >= 60) return 'No caminho certo'
  if (score >= 40) return 'Pede atenção'
  return 'Apertado, mas dá para virar'
}

export function financialHealth(input: HealthInput): Health {
  const { today, monthTxs, history, goals, goalMoves, categories, hasSalary } = input
  const ym = monthOf(today)
  const past = pastMonths(history, ym)
  const cur = monthTxs.filter(live)
  const curIncome = cur.filter(isIncome).reduce((a, t) => a + t.amount_cents, 0)
  const curExpenses = cur.filter(isExpense).reduce((a, t) => a + t.amount_cents, 0)
  const pillars: Pillar[] = []

  // 1. Gastar menos do que ganha (30): meses passados; sem histórico, o mês atual
  {
    const months = past.filter((m) => m.income > 0)
    const sample = months.length ? months : curIncome > 0 ? [{ income: curIncome, expenses: curExpenses }] : []
    if (!sample.length) {
      pillars.push({ id: 'gastos', title: 'Gastar menos do que ganha', max: 30, score: null, status: 'Ainda não sabemos quanto entra por mês.', tip: 'Informe seu salário em Você.', lesson: '50-30-20', to: '/voce' })
    } else {
      const income = sample.reduce((a, m) => a + m.income, 0)
      const expenses = sample.reduce((a, m) => a + m.expenses, 0)
      const ratio = expenses / income
      const score = ratio <= 0.9 ? 30 : ratio <= 1 ? 20 : ratio <= 1.1 ? 10 : 0
      const status = ratio <= 1 ? `Você gasta ${pct(ratio)} do que ganha.` : `Os gastos passaram ${pct(ratio - 1)} da renda.`
      const tip = ratio <= 0.9 ? 'Ótimo. Mande a sobra para as caixinhas no dia do salário.' : ratio <= 1 ? 'Está no limite: tente sobrar ao menos 10% do salário.' : 'Corte primeiro o que se repete e não faz falta.'
      pillars.push({ id: 'gastos', title: 'Gastar menos do que ganha', max: 30, score, status, tip, lesson: ratio <= 1 ? 'pague-se-primeiro' : 'assinaturas', to: ratio <= 1 ? undefined : '/mes?aba=orcamento' })
    }
  }

  // 2. Contas em dia (15): fixos e parcelas do mês já vencidos e não pagos
  {
    const bills = cur.filter((t) => t.type === 'fixo' || t.type === 'parcela')
    const overdue = bills.filter((t) => !t.paid && t.date < today).length
    if (!bills.length) {
      pillars.push({ id: 'contas', title: 'Contas em dia', max: 15, score: null, status: 'Nenhuma conta fixa cadastrada.', tip: 'Cadastre aluguel, luz e internet em Gastos fixos.', lesson: 'lembretes', to: '/voce/fixos' })
    } else {
      const score = overdue === 0 ? 15 : overdue === 1 ? 8 : 0
      pillars.push({
        id: 'contas', title: 'Contas em dia', max: 15, score,
        status: overdue === 0 ? 'Nenhuma conta atrasada.' : overdue === 1 ? '1 conta passou do vencimento.' : `${overdue} contas passaram do vencimento.`,
        tip: overdue === 0 ? 'Continue marcando como paga quando pagar.' : 'Pague a vencida primeiro: atraso gera multa e juros.',
        lesson: overdue === 0 ? 'lembretes' : 'rotativo',
        to: overdue === 0 ? undefined : '/mes?aba=lancamentos',
      })
    }
  }

  // 3. Reserva para imprevistos (25): meses de gastos guardados na reserva (3 meses = nota cheia)
  {
    const reserve = goals.filter((g) => isEmergencyGoal(g.goal)).reduce((a, g) => a + g.status.saved, 0)
    const spentMonths = past.filter((m) => m.expenses > 0)
    const monthly = spentMonths.length ? spentMonths.reduce((a, m) => a + m.expenses, 0) / spentMonths.length : curExpenses
    if (!goals.some((g) => isEmergencyGoal(g.goal))) {
      pillars.push({ id: 'reserva', title: 'Reserva para imprevistos', max: 25, score: 0, status: 'Você ainda não tem uma reserva.', tip: 'Crie a caixinha de reserva. Primeira meta: R$ 500.', lesson: 'reserva', to: '/caixinhas/nova' })
    } else {
      const months = monthly > 0 ? reserve / monthly : reserve >= 50_000 ? 1 : 0
      const score = Math.round(Math.min(1, months / 3) * 25)
      const status = reserve <= 0 ? 'A caixinha da reserva existe, mas ainda está vazia.' : monthly > 0 ? (months >= 2 ? `A reserva cobre ${months.toFixed(1).replace('.', ',')} meses de gastos.` : `A reserva cobre uns ${Math.round(months * 30)} dias de gastos.`) : 'Reserva começada.'
      const tip = months >= 3 ? 'Reserva completa. Agora pode guardar para os sonhos.' : months >= 1 ? 'Continue a reserva até cobrir 3 meses de gastos.' : reserve < 50_000 ? 'Leve a reserva primeiro aos R$ 500.' : 'Próxima meta da reserva: 1 mês de gastos.'
      pillars.push({ id: 'reserva', title: 'Reserva para imprevistos', max: 25, score, status, tip, lesson: 'reserva', to: '/caixinhas' })
    }
  }

  // 4. Guardar todo mês (20): meses com depósito nas caixinhas, entre os 3 últimos (contando o atual)
  {
    const keys = [0, 1, 2].map((i) => monthKey(addMonths(ym, -i)))
    const withDeposit = keys.filter((k) => goalMoves.some((m) => m.kind !== 'inicial' && m.amount_cents > 0 && monthKey(monthOf(m.date)) === k)).length
    const score = Math.round((withDeposit / 3) * 20)
    pillars.push({
      id: 'guardar', title: 'Guardar todo mês', max: 20, score,
      status: withDeposit === 0 ? 'Nenhum depósito nos últimos 3 meses.' : `Guardou em ${withDeposit} dos últimos 3 meses.`,
      tip: withDeposit === 3 ? 'Constância é o que mais importa. Continue.' : 'Guarde algo todo mês, mesmo R$ 20: o costume vem antes do valor.',
      lesson: withDeposit === 3 ? 'compromisso' : 'pague-se-primeiro',
      to: withDeposit === 3 ? undefined : '/separar',
    })
  }

  // 5. Ter um plano (10): salário informado, caixinha com objetivo e limite em alguma categoria
  {
    const parts = [hasSalary, goals.some((g) => g.status.target != null), categories.some((c) => c.monthly_limit_cents != null && c.monthly_limit_cents > 0)]
    const score = (parts[0] ? 4 : 0) + (parts[1] ? 3 : 0) + (parts[2] ? 3 : 0)
    const missing = !parts[0] ? 'Informe salário e dia do pagamento.' : !parts[1] ? 'Dê um valor final a uma caixinha.' : !parts[2] ? 'Coloque limite numa categoria em que você gasta muito.' : 'Plano completo. Revise uma vez por semana.'
    pillars.push({ id: 'plano', title: 'Ter um plano', max: 10, score, status: `${parts.filter(Boolean).length} de 3 itens do plano prontos.`, tip: missing, lesson: 'escassez', to: !parts[0] ? '/voce' : !parts[1] ? '/caixinhas' : !parts[2] ? '/voce/categorias' : '/revisao' })
  }

  const known = pillars.filter((p) => p.score != null)
  const max = known.reduce((a, p) => a + p.max, 0)
  const score = max >= 40 ? Math.round((known.reduce((a, p) => a + p.score!, 0) / max) * 100) : null
  // O que melhorar: os pilares que mais perdem pontos (sem contar os que estão perfeitos)
  const next = [...known].filter((p) => p.score! < p.max).sort((a, b) => b.max - b.score! - (a.max - a.score!)).slice(0, 2)
  return { score, label: score == null ? 'Faltam dados' : healthLabel(score), pillars, next }
}

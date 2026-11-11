// Psicologia para guardar: tudo calculado aqui, em centavos; as telas só mostram.
import type { Category, Challenge, Goal, GoalMove, Rule, Transaction, Wish } from '../types'
import { addDaysISO, daysBetweenISO, daysInMonth, isoDate, monthKey, monthOf, parseISODate, todayISO, weekdayOf, type YearMonth } from './dates'
import { normalizeText } from './budget'
import { formatBRL } from './money'

// ---------------------------------------------------------------------------
// Preço em horas de trabalho e em coisas concretas
// ---------------------------------------------------------------------------

/** Quanto vale 1 hora de trabalho: salário ÷ horas do mês (semanas do ano ÷ 12). */
export function hourlyCents(salaryCents: number, hoursWeek: number): number {
  return Math.round(salaryCents / ((hoursWeek * 52) / 12))
}

/** "18 h", "2 h 40 min", "35 min" */
export function workTime(priceCents: number, salaryCents: number | null, hoursWeek: number): string | null {
  if (!salaryCents || salaryCents <= 0 || priceCents <= 0) return null
  const minutes = Math.round((priceCents / hourlyCents(salaryCents, hoursWeek)) * 60)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h >= 10 || m === 0) return `${Math.round(minutes / 60)} h`
  return `${h} h ${m} min`
}

/** "esse iFood = meia diária do hotel (Viagem)". Usa a primeira caixinha com item concreto. */
export function concreteText(priceCents: number, goals: Goal[]): string | null {
  const g = [...goals].filter((x) => !x.archived && x.concrete_name && x.concrete_cents).sort((a, b) => a.priority - b.priority)[0]
  if (!g || priceCents <= 0) return null
  const ratio = priceCents / g.concrete_cents!
  const name = g.concrete_name!
  let amount: string
  if (ratio < 0.2) amount = `${Math.max(1, Math.round(ratio * 100))}% de uma ${name}`
  else if (ratio < 0.4) amount = `um quarto de ${name}`
  else if (ratio < 0.7) amount = `meia ${name}`
  else if (ratio < 1.3) amount = `1 ${name}`
  else amount = `${Math.round(ratio)}× ${name}`
  return `${amount} (${g.name})`
}

// ---------------------------------------------------------------------------
// Sequências e dias sem gastar
// ---------------------------------------------------------------------------

/** Segunda-feira da semana do dia. */
export const weekStart = (iso: string) => addDaysISO(iso, -((weekdayOf(iso) + 6) % 7))

/** Semanas seguidas com depósito nas caixinhas (a semana atual conta se já teve; se não, começa na anterior). */
export function savingWeekStreak(moves: GoalMove[], today: string): number {
  const weeks = new Set(moves.filter((m) => m.amount_cents > 0 && m.kind === 'deposito').map((m) => weekStart(m.date)))
  let w = weekStart(today)
  if (!weeks.has(w)) w = addDaysISO(w, -7)
  let n = 0
  while (weeks.has(w)) {
    n++
    w = addDaysISO(w, -7)
  }
  return n
}

/** Dias seguidos lançando gastos (hoje conta se já lançou; se não, começa ontem). */
export function loggingDayStreak(txs: Transaction[], today: string): number {
  const days = new Set(txs.filter((t) => !t.skipped && t.type === 'dia').map((t) => t.date))
  let d = days.has(today) ? today : addDaysISO(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}

export type DayMark = { date: string; day: number; state: 'sem-gasto' | 'gastou' | 'futuro' | 'hoje' }

/** Calendário do mês: verde nos dias sem gastos do dia a dia (até ontem). */
export function noSpendCalendar(txs: Transaction[], ym: YearMonth, today: string): { days: DayMark[]; count: number; leadingBlanks: number } {
  const spent = new Set(txs.filter((t) => !t.skipped && t.type === 'dia').map((t) => t.date))
  const days: DayMark[] = []
  for (let d = 1; d <= daysInMonth(ym); d++) {
    const date = isoDate(ym, d)
    const state = date > today ? 'futuro' : spent.has(date) ? 'gastou' : date === today ? 'hoje' : 'sem-gasto'
    days.push({ date, day: d, state })
  }
  return { days, count: days.filter((d) => d.state === 'sem-gasto').length, leadingBlanks: (weekdayOf(isoDate(ym, 1)) + 6) % 7 }
}

// ---------------------------------------------------------------------------
// Desafios
// ---------------------------------------------------------------------------

export type ChallengeDef = { kind: Challenge['kind']; title: string; days: number; hint: string }

export const CHALLENGES: ChallengeDef[] = [
  { kind: 'sem_delivery', title: '7 dias sem delivery', days: 7, hint: 'Nada de iFood ou aplicativo de comida por uma semana.' },
  { kind: 'sem_shopee', title: 'Semana sem Shopee', days: 7, hint: 'Nenhuma compra online por 7 dias. O carrinho pode esperar.' },
  { kind: 'sem_impulso', title: 'Mês sem compras por impulso', days: 30, hint: 'Sem roupas e compras online por 30 dias, e o que der vontade vai para a lista de desejos.' },
  { kind: '52_semanas', title: 'Desafio das 52 semanas', days: 364, hint: 'Na semana 1 guarde R$ 5, na 2 guarde R$ 10… e assim até a 52. No fim: R$ 6.890.' },
]

export type ChallengeProgress = { daysDone: number; days: number; broken: Transaction[]; failed: boolean; finished: boolean; pct: number; week?: number; weekTarget?: number; savedTotal?: number; target?: number }

const has = (t: Transaction, words: string[]) => words.some((w) => normalizeText(t.description).includes(w))

/** O que quebra cada desafio. */
export function challengeBreakers(c: Challenge, txs: Transaction[], categories: Category[]): Transaction[] {
  const inWindow = txs.filter((t) => !t.skipped && t.kind === 'expense' && t.type === 'dia' && t.date >= c.started_on && t.date <= c.ends_on)
  const catId = (name: string) => categories.find((x) => normalizeText(x.name) === normalizeText(name))?.id
  if (c.kind === 'sem_delivery') return inWindow.filter((t) => t.category_id === catId('Delivery') || has(t, ['ifood', 'delivery', 'rappi', 'ze delivery']))
  if (c.kind === 'sem_shopee') return inWindow.filter((t) => t.category_id === catId('Compras online') || has(t, ['shopee', 'shein', 'mercado livre', 'aliexpress', 'temu']))
  if (c.kind === 'sem_impulso') return inWindow.filter((t) => [catId('Compras online'), catId('Roupas')].includes(t.category_id ?? '') || has(t, ['shopee', 'shein']))
  return []
}

export function challengeProgress(c: Challenge, txs: Transaction[], categories: Category[], moves: GoalMove[], today: string): ChallengeProgress {
  const days = daysBetweenISO(c.started_on, c.ends_on) + 1
  const daysDone = Math.max(0, Math.min(days, daysBetweenISO(c.started_on, today) + (today > c.ends_on ? 0 : 0)))
  const finished = today > c.ends_on
  if (c.kind === '52_semanas') {
    const base = c.params.base_cents ?? 500
    const week = Math.min(52, Math.floor(daysBetweenISO(c.started_on, today) / 7) + 1)
    const target = (base * 52 * 53) / 2
    const savedTotal = moves.filter((m) => m.goal_id === c.goal_id && m.amount_cents > 0 && m.date >= c.started_on && m.note === '52 semanas').reduce((a, m) => a + m.amount_cents, 0)
    return { daysDone, days, broken: [], failed: false, finished: finished || savedTotal >= target, pct: savedTotal / target, week, weekTarget: base * week, savedTotal, target }
  }
  const broken = challengeBreakers(c, txs, categories)
  return { daysDone, days, broken, failed: broken.length > 0, finished, pct: Math.min(1, daysDone / days) }
}

// ---------------------------------------------------------------------------
// Regras automáticas (estilo Qapital): viram depósitos nas caixinhas
// ---------------------------------------------------------------------------

/** Arredonda para cima até o próximo múltiplo e devolve a diferença (R$ 18,40 → R$ 20,00 = R$ 1,60). */
export function roundUp(cents: number, step: number): number {
  if (step <= 0) return 0
  const r = cents % step
  return r === 0 ? 0 : step - r
}

export type RuleMove = { goal_id: string; amount_cents: number; note: string }

/** Depósitos que um lançamento novo gera pelas regras ativas. */
export function rulesForTransaction(tx: Pick<Transaction, 'kind' | 'type' | 'amount_cents' | 'category_id'>, rules: Rule[]): RuleMove[] {
  const out: RuleMove[] = []
  for (const r of rules) {
    if (!r.active) continue
    if (r.kind === 'arredondar' && tx.kind === 'expense' && tx.type === 'dia') {
      const v = roundUp(tx.amount_cents, r.params.step_cents ?? 500)
      if (v > 0) out.push({ goal_id: r.goal_id, amount_cents: v, note: 'Regra: arredondar' })
    } else if (r.kind === 'renda_extra' && tx.kind === 'income' && tx.type === 'extra') {
      const v = Math.round((tx.amount_cents * (r.params.pct ?? 10)) / 100)
      if (v > 0) out.push({ goal_id: r.goal_id, amount_cents: v, note: `Regra: ${r.params.pct ?? 10}% da renda extra` })
    } else if (r.kind === 'prazer_culpado' && tx.kind === 'expense' && tx.category_id && tx.category_id === r.params.category_id) {
      out.push({ goal_id: r.goal_id, amount_cents: r.params.amount_cents ?? 1000, note: 'Regra: prazer culpado' })
    }
  }
  return out
}

/** "Gastei menos que o limite, guardo a diferença": sobra das categorias com limite semanal na semana passada. */
export function weeklyLeftover(categories: Category[], txs: Transaction[], today: string): { category: Category; leftover: number; weekStart: string }[] {
  const start = addDaysISO(weekStart(today), -7)
  const end = addDaysISO(start, 6)
  return categories
    .filter((c) => c.kind === 'expense' && !c.archived && c.weekly_limit_cents)
    .map((category) => {
      const spent = txs.filter((t) => !t.skipped && t.type === 'dia' && t.category_id === category.id && t.date >= start && t.date <= end).reduce((a, t) => a + t.amount_cents, 0)
      return { category, leftover: Math.max(0, category.weekly_limit_cents! - spent), weekStart: start }
    })
    .filter((x) => x.leftover > 0)
}

// ---------------------------------------------------------------------------
// Lista de desejos (espera de 30 dias)
// ---------------------------------------------------------------------------

export const WISH_WAIT_DAYS = 30

export function wishState(w: Wish, today: string): { daysLeft: number; ready: boolean } {
  const daysLeft = daysBetweenISO(today, w.decide_on)
  return { daysLeft: Math.max(0, daysLeft), ready: w.status === 'esperando' && daysLeft <= 0 }
}

/** Quanto deixou de gastar desistindo de desejos. */
export function savedByGivingUp(wishes: Wish[]): number {
  return wishes.filter((w) => w.status === 'desisti').reduce((a, w) => a + w.price_cents, 0)
}

// ---------------------------------------------------------------------------
// Recomeço e futuro
// ---------------------------------------------------------------------------

/** Mensagem de recomeço: virada do mês (dias 1 a 3), ano novo (1 a 7 de janeiro) e aniversário. */
export function freshStart(today: string, birthday: string | null): { title: string; text: string } | null {
  if (birthday && birthday.slice(5) === today.slice(5)) return { title: 'Feliz aniversário!', text: 'Ano novo seu, plano novo. Que tal revisar as caixinhas e escolher um desafio para começar bem?' }
  const d = parseISODate(today)
  if (d.getMonth() === 0 && d.getDate() <= 7) return { title: `Bem-vindo a ${d.getFullYear()}`, text: 'Um ano inteiro pela frente. O que você quer ter guardado em dezembro?' }
  if (d.getDate() <= 3) return { title: 'Mês novo, página em branco', text: 'O que passou, passou. Separe primeiro o das caixinhas e comece leve.' }
  return null
}

/** "Mantendo esse ritmo, em dezembro você terá R$ X": média dos depósitos dos últimos 3 meses. */
export function projection(moves: GoalMove[], today: string): { pace: number; monthsLeft: number; projected: number; saved: number } {
  const ym = monthOf(today)
  const keys = [1, 2, 3].map((b) => monthKey({ year: ym.month - b > 0 ? ym.year : ym.year - 1, month: ((ym.month - b - 1 + 12) % 12) + 1 }))
  const net = moves.filter((m) => m.kind !== 'inicial' && keys.includes(m.date.slice(0, 7))).reduce((a, m) => a + m.amount_cents, 0)
  const pace = Math.max(0, Math.round(net / 3))
  const saved = moves.reduce((a, m) => a + m.amount_cents, 0)
  const monthsLeft = 12 - ym.month + 1
  // O mês atual conta só o que ainda falta guardar nele (o que já foi guardado está em "saved")
  const thisMonth = moves.filter((m) => m.kind !== 'inicial' && m.date.slice(0, 7) === monthKey(ym)).reduce((a, m) => a + m.amount_cents, 0)
  return { pace, monthsLeft, saved, projected: saved + Math.max(0, pace - thisMonth) + pace * (monthsLeft - 1) }
}

// ---------------------------------------------------------------------------
// Revisão da semana e retrospectiva do mês
// ---------------------------------------------------------------------------

export type Recap = {
  spent: number
  previousSpent: number
  saved: number
  topCategory: { name: string; cents: number } | null
  noSpendDays: number
  biggest: { description: string; cents: number } | null
  byEmotion: { emotion: string; cents: number } | null
}

function recapOf(txs: Transaction[], moves: GoalMove[], categories: Category[], from: string, to: string, prevFrom: string, prevTo: string, today: string): Recap {
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b
  const daily = txs.filter((t) => !t.skipped && t.kind === 'expense' && inRange(t.date, from, to))
  const spent = daily.reduce((a, t) => a + t.amount_cents, 0)
  const previousSpent = txs.filter((t) => !t.skipped && t.kind === 'expense' && inRange(t.date, prevFrom, prevTo)).reduce((a, t) => a + t.amount_cents, 0)
  const saved = moves.filter((m) => m.kind !== 'inicial' && inRange(m.date, from, to)).reduce((a, m) => a + m.amount_cents, 0)
  const byCat = new Map<string, number>()
  for (const t of daily.filter((t) => t.type === 'dia')) byCat.set(t.category_id ?? '', (byCat.get(t.category_id ?? '') ?? 0) + t.amount_cents)
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
  const emo = new Map<string, number>()
  for (const t of daily) if (t.emotion) emo.set(t.emotion, (emo.get(t.emotion) ?? 0) + t.amount_cents)
  const topEmo = [...emo.entries()].sort((a, b) => b[1] - a[1])[0]
  const spentDays = new Set(daily.filter((t) => t.type === 'dia').map((t) => t.date))
  let noSpendDays = 0
  for (let d = from; d <= to && d < today; d = addDaysISO(d, 1)) if (!spentDays.has(d)) noSpendDays++
  const big = [...daily.filter((t) => t.type === 'dia')].sort((a, b) => b.amount_cents - a.amount_cents)[0]
  return {
    spent,
    previousSpent,
    saved,
    topCategory: top ? { name: categories.find((c) => c.id === top[0])?.name ?? 'Sem categoria', cents: top[1] } : null,
    noSpendDays,
    biggest: big ? { description: big.description, cents: big.amount_cents } : null,
    byEmotion: topEmo ? { emotion: topEmo[0], cents: topEmo[1] } : null,
  }
}

/** A semana passada (segunda a domingo), comparada com a anterior. */
export function weekRecap(txs: Transaction[], moves: GoalMove[], categories: Category[], today: string): Recap & { from: string; to: string } {
  const from = addDaysISO(weekStart(today), -7)
  const to = addDaysISO(from, 6)
  return { ...recapOf(txs, moves, categories, from, to, addDaysISO(from, -7), addDaysISO(from, -1), today), from, to }
}

/** O mês informado, comparado com o anterior. */
export function monthRecap(txs: Transaction[], moves: GoalMove[], categories: Category[], ym: YearMonth, today = todayISO()): Recap {
  const prev = ym.month === 1 ? { year: ym.year - 1, month: 12 } : { year: ym.year, month: ym.month - 1 }
  return recapOf(txs, moves, categories, isoDate(ym, 1), isoDate(ym, daysInMonth(ym)), isoDate(prev, 1), isoDate(prev, daysInMonth(prev)), today)
}

/** Frase positiva para a variação dos gastos (deslize vira "vamos ajustar"). */
export function compareText(spent: number, previous: number): string {
  if (previous <= 0) return 'Primeiro período registrado. Bora acompanhar!'
  const diff = spent - previous
  const pct = Math.round((Math.abs(diff) / previous) * 100)
  if (diff < 0) return `Você gastou ${pct}% menos que antes (${formatBRL(-diff)} a menos). Mandou bem!`
  if (diff === 0) return 'Gastos iguais ao período anterior. Constância também conta.'
  return `Gastou ${pct}% a mais (${formatBRL(diff)}). Tudo bem: vamos ajustar na próxima.`
}

// ---------------------------------------------------------------------------
// Teste de perfil com dinheiro (primeiro acesso)
// ---------------------------------------------------------------------------

export type MoneyProfile = 'planejador' | 'aproveitador' | 'guardiao' | 'desligado'

export const PROFILE_INFO: Record<MoneyProfile, { name: string; text: string; tone: 'suave' | 'equilibrado' | 'agressivo' }> = {
  planejador: { name: 'Planejador', text: 'Você gosta de saber para onde vai cada real. Vamos usar isso a seu favor com metas claras e números na mão.', tone: 'equilibrado' },
  aproveitador: { name: 'Vive o agora', text: 'Você aproveita o momento, e tudo bem. O segredo vai ser separar o das caixinhas primeiro, para gastar o resto sem culpa.', tone: 'suave' },
  guardiao: { name: 'Guardião', text: 'Guardar já é natural para você. Agora é dar um destino para esse dinheiro e acelerar as metas.', tone: 'agressivo' },
  desligado: { name: 'No piloto automático', text: 'Dinheiro some sem você perceber para onde. Lançar tudo por um mês já vai mudar o jogo.', tone: 'suave' },
}

export const QUIZ: { id: string; question: string; options: { label: string; profile: MoneyProfile }[] }[] = [
  {
    id: 'salario',
    question: 'O salário caiu. O que você faz primeiro?',
    options: [
      { label: 'Pago as contas e vejo quanto sobra', profile: 'planejador' },
      { label: 'Me dou um presente, eu mereço', profile: 'aproveitador' },
      { label: 'Separo uma parte para guardar', profile: 'guardiao' },
      { label: 'Nada de especial, vou gastando', profile: 'desligado' },
    ],
  },
  {
    id: 'fim_do_mes',
    question: 'Como costuma ser o fim do mês?',
    options: [
      { label: 'Apertado, mas eu sei por quê', profile: 'planejador' },
      { label: 'No vermelho, sempre falta', profile: 'aproveitador' },
      { label: 'Sobra um pouco', profile: 'guardiao' },
      { label: 'Não faço ideia de onde foi', profile: 'desligado' },
    ],
  },
  {
    id: 'promocao',
    question: 'Viu uma promoção boa de algo que você quer.',
    options: [
      { label: 'Comparo preços e penso uns dias', profile: 'planejador' },
      { label: 'Compro na hora, antes que acabe', profile: 'aproveitador' },
      { label: 'Só compro se já tiver o dinheiro guardado', profile: 'guardiao' },
      { label: 'Compro e esqueço que comprei', profile: 'desligado' },
    ],
  },
  {
    id: 'controle',
    question: 'Você sabe quanto gastou no último mês?',
    options: [
      { label: 'Sei mais ou menos', profile: 'planejador' },
      { label: 'Prefiro não saber', profile: 'aproveitador' },
      { label: 'Sei, anoto tudo', profile: 'guardiao' },
      { label: 'Não faço a menor ideia', profile: 'desligado' },
    ],
  },
]

/** Perfil que mais apareceu nas respostas (empate: o da primeira resposta). */
export function profileFromAnswers(answers: Record<string, string>): MoneyProfile {
  const count = new Map<MoneyProfile, number>()
  const order: MoneyProfile[] = []
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.label === answers[q.id])
    if (!opt) continue
    count.set(opt.profile, (count.get(opt.profile) ?? 0) + 1)
    order.push(opt.profile)
  }
  if (!order.length) return 'planejador'
  const max = Math.max(...count.values())
  return order.find((p) => count.get(p) === max)!
}

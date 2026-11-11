/**
 * Porquinho: o mascote que dá as dicas.
 * - Ganha 1 moeda por meta do dia (lançar gastos, ficar no limite do dia, dia sem gastar, guardar qualquer valor),
 *   +10 por semana completa e +5 por marco de caixinha (25/50/75/100%).
 * - Engorda ou emagrece pela meta que A PRÓPRIA PESSOA escolheu guardar (não pelo valor em reais) e pelos hábitos
 *   da semana. Quem ganha pouco e guarda R$ 20 deixa o porquinho tão feliz quanto quem guarda R$ 500.
 * - Nunca morre: fica tristinho e volta rápido com um passo pequeno.
 */
import type { AiTone, GoalMove, PigCoinKind, Transaction } from '../types'
import { addDaysISO, daysInMonth, dayOf, monthKey, monthOf, weekdayOf } from './dates'
import { MILESTONES } from './goals'

export type DailyKind = 'lancou' | 'no_limite' | 'sem_gastar' | 'guardou'
export const DAILY_KINDS: DailyKind[] = ['lancou', 'guardou', 'no_limite', 'sem_gastar']
export const COINS: Record<PigCoinKind, number> = { lancou: 1, no_limite: 1, sem_gastar: 1, guardou: 1, semana: 10, marco: 5 }
export const GOAL_LABEL: Record<DailyKind, string> = {
  lancou: 'Lançar os gastos',
  guardou: 'Guardar qualquer valor',
  no_limite: 'Ficar no limite do dia',
  sem_gastar: 'Dia sem gastar',
}

export type Reward = { day: string; kind: PigCoinKind; ref: string; coins: number }

/** Data (no horário de Brasília) em que o lançamento foi feito. */
export const createdDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

const live = (t: Transaction) => !t.skipped
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Quanto dava para gastar por dia no dia a dia daquele mês: (renda − fixos e parcelas − guardar) ÷ dias do mês. */
function dailyAllowance(txs: Transaction[], day: string, saveCents: number): number {
  const ym = monthOf(day)
  const key = monthKey(ym)
  const month = txs.filter((t) => live(t) && monthKey(monthOf(t.date)) === key)
  const income = sum(month.filter((t) => t.type === 'salario' || t.type === 'extra').map((t) => t.amount_cents))
  const committed = sum(month.filter((t) => t.type === 'fixo' || t.type === 'parcela').map((t) => t.amount_cents))
  return Math.max(0, Math.floor((income - committed - saveCents) / daysInMonth(ym)))
}

/** Metas cumpridas num dia. "No limite" e "sem gastar" só contam depois que o dia acaba. */
export function dayGoals(day: string, today: string, txs: Transaction[], moves: GoalMove[], saveCents: number): Record<DailyKind, boolean> {
  const closed = day < today
  const spent = sum(txs.filter((t) => live(t) && t.type === 'dia' && t.date === day).map((t) => t.amount_cents))
  const allowance = closed ? dailyAllowance(txs, day, saveCents) : 0
  return {
    lancou: txs.some((t) => t.source !== 'banco' && createdDay(t.created_at) === day),
    guardou: moves.some((m) => m.kind === 'deposito' && m.amount_cents > 0 && m.date === day),
    no_limite: closed && allowance > 0 && spent > 0 && spent <= allowance,
    sem_gastar: closed && spent === 0 && txs.some((t) => live(t) && t.date <= day),
  }
}

export type PigInput = {
  today: string
  /** primeiro dia que conta (criação da conta): não dá moeda por dias de antes */
  startDay: string
  txs: Transaction[]
  moves: GoalMove[]
  goals: { id: string; target: number | null }[]
  /** meta de guardar por mês que a pessoa escolheu (caixinhas ou "Separar") */
  saveTarget: number
  payday: number | null
}

/** Moedas a receber nos últimos 7 dias (o app grava; as repetidas são ignoradas pelo banco). */
export function pendingRewards(p: PigInput): Reward[] {
  const out: Reward[] = []
  const days = Array.from({ length: 8 }, (_, i) => addDaysISO(p.today, -i)).filter((d) => d >= p.startDay)
  const hit = new Map<string, number>()
  for (const day of days) {
    const g = dayGoals(day, p.today, p.txs, p.moves, p.saveTarget)
    let n = 0
    for (const k of DAILY_KINDS) if (g[k]) (out.push({ day, kind: k, ref: '', coins: COINS[k] }), n++)
    hit.set(day, n)
  }
  // Semana completa (segunda a domingo, todos os dias com alguma meta)
  for (let i = 1; i <= 14; i++) {
    const sunday = addDaysISO(p.today, -i)
    if (weekdayOf(sunday) !== 0) continue
    const week = Array.from({ length: 7 }, (_, j) => addDaysISO(sunday, -j))
    if (week.some((d) => d < p.startDay)) continue
    const all = week.every((d) => hit.get(d) ?? Object.values(dayGoals(d, p.today, p.txs, p.moves, p.saveTarget)).some(Boolean))
    if (all) out.push({ day: sunday, kind: 'semana', ref: '', coins: COINS.semana })
  }
  // Marcos das caixinhas (25/50/75/100%) alcançados nos últimos 14 dias
  const since = addDaysISO(p.today, -14)
  for (const g of p.goals) {
    if (!g.target) continue
    const mine = p.moves.filter((m) => m.goal_id === g.id).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    let saved = 0
    for (const m of mine) {
      const before = saved
      saved += m.amount_cents
      if (m.kind === 'retirada' || m.date < since || m.date < p.startDay || m.date > p.today) continue
      for (const pct of MILESTONES) if (before < g.target * pct && saved >= g.target * pct) out.push({ day: m.date, kind: 'marco', ref: `${g.id}:${pct * 100}`, coins: COINS.marco })
    }
  }
  return out
}

export type PigSize = 'magro' | 'normal' | 'gordo'
export type PigMood = 'feliz' | 'normal' | 'triste' | 'festa'
export type PigState = { size: PigSize; mood: PigMood; fullness: number; savedRatio: number | null; habitDays: number; today: Record<DailyKind, boolean> }

export function pigState(p: PigInput, rewards: { day: string; kind: PigCoinKind }[]): PigState {
  const habit = Array.from({ length: 7 }, (_, i) => addDaysISO(p.today, -i)).filter((d) => d >= p.startDay)
  const goalsByDay = habit.map((d) => dayGoals(d, p.today, p.txs, p.moves, p.saveTarget))
  const habitDays = goalsByDay.filter((g) => Object.values(g).some(Boolean)).length
  // Antes do dia do pagamento, vale o mês passado (ninguém guarda antes de receber)
  const ym = monthOf(p.today)
  const beforePay = p.payday != null && dayOf(p.today) < Math.min(p.payday, 28)
  const key = monthKey(beforePay ? { year: ym.month === 1 ? ym.year - 1 : ym.year, month: ym.month === 1 ? 12 : ym.month - 1 } : ym)
  const saved = sum(p.moves.filter((m) => m.kind !== 'inicial' && monthKey(monthOf(m.date)) === key).map((m) => m.amount_cents))
  const savedRatio = p.saveTarget > 0 ? Math.max(0, saved / p.saveTarget) : null
  const habitShare = habitDays / 7
  const fullness = savedRatio == null ? habitShare : 0.65 * Math.min(1, savedRatio) + 0.35 * habitShare
  const size: PigSize = fullness < 0.35 ? 'magro' : fullness < 0.7 ? 'normal' : 'gordo'
  const recentParty = rewards.some((r) => (r.kind === 'marco' || r.kind === 'semana') && r.day >= addDaysISO(p.today, -1))
  const last3 = goalsByDay.slice(0, 3)
  const idle = last3.length >= 3 && last3.every((g) => !Object.values(g).some(Boolean))
  const todayGoals = goalsByDay[0] ?? { lancou: false, guardou: false, no_limite: false, sem_gastar: false }
  const mood: PigMood = recentParty ? 'festa' : idle ? 'triste' : todayGoals.lancou || todayGoals.guardou || fullness >= 0.7 ? 'feliz' : 'normal'
  return { size, mood, fullness, savedRatio, habitDays, today: todayGoals }
}

export const balance = (coins: { coins: number }[], purchases: { price: number }[]) => sum(coins.map((c) => c.coins)) - sum(purchases.map((x) => x.price))

/** O que o porquinho fala, no tom escolhido. */
const LINES: Record<AiTone, Record<PigMood, string[]>> = {
  suave: {
    festa: ['Olha só o que você conseguiu! Tô muito orgulhoso.', 'Que dia bonito! Cada passo conta, e você deu um grande.'],
    feliz: ['Hoje já tá valendo. Obrigado por cuidar de mim (e de você).', 'Que bom te ver por aqui! Devagar a gente chega.'],
    normal: ['Oi! Um passinho hoje já me deixa feliz.', 'Tô aqui com você. Que tal lançar o que gastou hoje?'],
    triste: ['Tô com saudade… Um passo pequeno já ajuda: lançar um gasto ou guardar R$ 5.', 'Sem culpa, tá? Recomeçar hoje vale do mesmo jeito.'],
  },
  equilibrado: {
    festa: ['Meta batida! É assim que o dinheiro aparece.', 'Semana fechada. Bom ritmo: segue assim.'],
    feliz: ['Bom ritmo. Mantém assim que a meta chega.', 'Tudo em dia por hoje. Amanhã de novo.'],
    normal: ['Ainda dá tempo de bater a meta de hoje.', 'Uma ação rápida: lance seus gastos de hoje.'],
    triste: ['3 dias sem movimento. Um passo pequeno hoje já muda o rumo.', 'Tô ficando magrinho. Guarda qualquer valor e eu me animo.'],
  },
  agressivo: {
    festa: ['ISSO! Bateu a meta. Agora não pode relaxar.', 'Semana completa. Quero ver repetir!'],
    feliz: ['Bom. Mas amanhã tem mais: sem moleza.', 'Tá no caminho. Corta mais um gasto bobo e me engorda.'],
    normal: ['Bora! A meta de hoje não vai se bater sozinha.', 'Cadê o lançamento de hoje? Anota agora.'],
    triste: ['Ei! 3 dias parado. Guarda nem que seja R$ 10 agora.', 'Tô passando fome aqui. Volta pro jogo hoje!'],
  },
}

export function pigLine(tone: AiTone, mood: PigMood, dayIndex: number): string {
  const list = LINES[tone][mood]
  return list[((dayIndex % list.length) + list.length) % list.length]
}

/** Itens da loja (só cosméticos: dicas nunca custam moedas). */
export type ShopItem = { key: string; name: string; price: number }
export const SHOP: ShopItem[] = [
  { key: 'oculos', name: 'Óculos escuros', price: 20 },
  { key: 'gravata', name: 'Gravata borboleta', price: 25 },
  { key: 'chapeu', name: 'Chapéu de palha', price: 30 },
  { key: 'cachecol', name: 'Cachecol', price: 35 },
  { key: 'fone', name: 'Fone de ouvido', price: 40 },
  { key: 'cartola', name: 'Cartola', price: 60 },
  { key: 'coroa', name: 'Coroa', price: 80 },
]

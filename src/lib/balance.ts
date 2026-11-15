/**
 * Balanço do mês (Saúde financeira): "quero guardar X% da renda; dá? onde eu corto?".
 * O app calcula tudo aqui (sem IA): o que sobra hoje no ritmo de gastos da pessoa, quanto falta para a meta
 * e onde cortar, começando pelos desejos. Se não der, mostra o máximo realista e um caminho de subir aos poucos
 * (como o "Poupe Mais Amanhã", de Thaler e Benartzi: aumentos pequenos e combinados antes funcionam melhor).
 * Funções puras, testadas em balance.test.ts.
 */
import type { Category, Transaction } from '../types'
import { dailyByCategory } from './coach'
import { formatBRL } from './money'

/** Quanto dá para cortar de cada categoria sem virar um plano impossível de seguir. */
export const MAX_CUT = { desejo: 0.4, necessidade: 0.15 } as const
/** Abaixo disso por mês, não vale a pena mexer na categoria. */
const MIN_MONTHLY = 5000

export type BalanceInput = {
  today: string
  /** renda do mês (salário + o que a pessoa disse que conta) */
  incomeCents: number
  /** fixos e parcelas do mês: dinheiro que já tem dono */
  fixedCents: number
  installmentsCents: number
  categories: Category[]
  history: Transaction[]
  monthTxs: Transaction[]
  /** assinaturas cadastradas como gasto fixo (as detectadas no dia a dia já entram nas categorias) */
  subscriptions: { description: string; monthlyCents: number; categoryId: string | null }[]
}

export type BalanceCut = {
  categoryId: string | null
  label: string
  group: 'desejo' | 'necessidade'
  kind: 'limite' | 'cancelar'
  nowCents: number
  newCents: number
  saveCents: number
  /** a ação concreta ("limite de R$ 70 por semana") */
  how: string
}

export type BalanceVerdict = 'sem-renda' | 'ja-da' | 'da' | 'apertado' | 'nao-da'

export type Balance = {
  verdict: BalanceVerdict
  incomeCents: number
  /** gasto médio do mês no ritmo atual (fixos + parcelas + dia a dia) */
  spendCents: number
  /** o que sobra hoje sem mudar nada */
  leftCents: number
  targetPct: number
  targetCents: number
  /** quanto falta (0 se já dá) */
  gapCents: number
  cuts: BalanceCut[]
  cutsCents: number
  /** o máximo que dá para guardar hoje, cortando tudo o que dá */
  maxPct: number
  /** quando não dá: começar com startPct e subir 1 ponto por mês */
  path: { startPct: number; months: number } | null
  /** aulas do "Aprender" que combinam com o resultado */
  lessons: string[]
}

const roundUp10 = (c: number) => Math.ceil(c / 1000) * 1000
const round10 = (c: number) => Math.round(c / 1000) * 1000

export function monthlyBalance(input: BalanceInput, targetPct: number): Balance {
  const income = Math.max(0, input.incomeCents)
  const byCat = dailyByCategory({ history: input.history, monthTxs: input.monthTxs, today: input.today })
  const daily = [...byCat.values()].reduce((a, b) => a + b, 0)
  const spend = Math.round(input.fixedCents + input.installmentsCents + daily)
  const left = income - spend
  const target = Math.round((income * targetPct) / 100)
  const base = { incomeCents: income, spendCents: spend, leftCents: left, targetPct, targetCents: target }
  if (income <= 0) return { ...base, verdict: 'sem-renda', gapCents: target, cuts: [], cutsCents: 0, maxPct: 0, path: null, lessons: ['pague-se-primeiro'] }

  // O que dá para cortar, na ordem: desejos (maiores primeiro), assinaturas, necessidades
  type Option = Omit<BalanceCut, 'newCents' | 'saveCents' | 'how'> & { maxSave: number }
  const cats = input.categories.filter((c) => c.kind === 'expense')
  const catOptions = (grp: 'desejo' | 'necessidade'): Option[] =>
    cats
      .filter((c) => c.grp === grp)
      .map((c) => ({ c, now: byCat.get(c.id) ?? 0 }))
      .filter((x) => x.now >= MIN_MONTHLY)
      .sort((a, b) => b.now - a.now)
      .map(({ c, now }) => ({ categoryId: c.id, label: c.name, group: grp, kind: 'limite' as const, nowCents: round10(now), maxSave: round10(now * MAX_CUT[grp]) }))
  const grpOf = new Map(cats.map((c) => [c.id, c.grp]))
  const subOptions: Option[] = input.subscriptions
    .filter((s) => s.categoryId && grpOf.get(s.categoryId) === 'desejo')
    .sort((a, b) => b.monthlyCents - a.monthlyCents)
    .map((s) => ({ categoryId: s.categoryId, label: s.description, group: 'desejo' as const, kind: 'cancelar' as const, nowCents: s.monthlyCents, maxSave: s.monthlyCents }))
  const options = [...catOptions('desejo'), ...subOptions, ...catOptions('necessidade')]
  const maxCuts = options.reduce((a, o) => a + o.maxSave, 0)
  const maxPct = Math.max(0, Math.floor(((left + maxCuts) / income) * 100))

  const gap = Math.max(0, target - left)
  const cuts: BalanceCut[] = []
  let missing = gap
  for (const o of options) {
    if (missing <= 0) break
    // assinatura é tudo ou nada; categoria corta só o que falta (de R$ 10 em R$ 10)
    const save = o.kind === 'cancelar' ? o.maxSave : Math.min(o.maxSave, roundUp10(missing))
    if (save <= 0) continue
    const next = o.nowCents - save
    cuts.push({
      categoryId: o.categoryId,
      label: o.label,
      group: o.group,
      kind: o.kind,
      nowCents: o.nowCents,
      newCents: next,
      saveCents: save,
      how: o.kind === 'cancelar' ? 'cancelar (se sentir falta, assina de novo depois)' : `limite de ${formatBRL(round10(next / 4.33))} por semana`,
    })
    missing -= save
  }
  const cutsCents = cuts.reduce((a, c) => a + c.saveCents, 0)
  const verdict: BalanceVerdict = gap === 0 ? 'ja-da' : missing > 0 ? 'nao-da' : cuts.some((c) => c.group === 'necessidade') ? 'apertado' : 'da'
  const startPct = Math.max(1, Math.min(maxPct, targetPct))
  const path = verdict === 'nao-da' ? { startPct, months: targetPct - startPct } : null

  // Não dá ainda: a aula de combinar o aumento antes (compromisso) vem antes das de corte
  const lessons = ['pague-se-primeiro']
  if (verdict === 'nao-da') lessons.push('compromisso')
  if (cuts.some((c) => c.kind === 'limite' && c.group === 'desejo')) lessons.push('regra-30-dias')
  if (cuts.some((c) => c.kind === 'cancelar')) lessons.push('assinaturas')
  return { ...base, verdict, gapCents: gap, cuts: verdict === 'nao-da' ? cutsAll(options) : cuts, cutsCents: verdict === 'nao-da' ? maxCuts : cutsCents, maxPct, path, lessons: lessons.slice(0, 3) }
}

/** Quando não dá: mostra tudo o que dá para cortar (é o caminho até o máximo realista). */
function cutsAll(options: (Omit<BalanceCut, 'newCents' | 'saveCents' | 'how'> & { maxSave: number })[]): BalanceCut[] {
  return options
    .filter((o) => o.maxSave > 0)
    .map((o) => ({
      categoryId: o.categoryId,
      label: o.label,
      group: o.group,
      kind: o.kind,
      nowCents: o.nowCents,
      newCents: o.nowCents - o.maxSave,
      saveCents: o.maxSave,
      how: o.kind === 'cancelar' ? 'cancelar (se sentir falta, assina de novo depois)' : `limite de ${formatBRL(round10((o.nowCents - o.maxSave) / 4.33))} por semana`,
    }))
}

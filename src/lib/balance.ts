/**
 * Balanço do mês (Saúde financeira): "quero guardar X% da renda; dá? onde eu corto?".
 * O app calcula tudo aqui (sem IA): o que sobra hoje no ritmo de gastos da pessoa, quanto falta para a meta
 * e onde cortar, começando pelos desejos. Se não der, mostra o máximo realista e um caminho de subir aos poucos
 * (como o "Poupe Mais Amanhã", de Thaler e Benartzi: aumentos pequenos e combinados antes funcionam melhor).
 * Funções puras, testadas em balance.test.ts.
 */
import type { Category, Transaction } from '../types'
import { dailyByCategory } from './coach'
import { addMonths, dayOf, daysInMonth, monthKey, monthOf } from './dates'
import { installmentLabel } from './installments'
import { merchantOf } from './merchants'
import { formatBRL } from './money'
import { countedPassThroughs } from './statement'

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
  /** o que já tem dono e não dá para cortar agora */
  committed: { fixedCents: number; installmentsCents: number; parcels: { label: string; amountCents: number; left: number }[] }
  /** dia a dia por categoria (dá para mexer), com as lojas/apps que mais pesam em cada uma */
  variable: { categoryId: string; label: string; group: 'desejo' | 'necessidade'; monthlyCents: number; merchants: { name: string; monthlyCents: number }[] }[]
  variableCents: number
  /** "E se você gastasse X% menos no dia a dia?" */
  scenarios: { cutPct: number; saveCents: number; leftCents: number; pct: number }[]
  /** Pix que parecem repasse e ainda contam como gasto (se não forem gastos, a sobra melhora) */
  passThroughs: { id: string; label: string; amountCents: number }[]
}

/** Média por mês de cada chave nos últimos 3 meses (sem histórico, projeta o mês atual), como dailyByCategory. */
function monthlyBy(input: Pick<BalanceInput, 'history' | 'monthTxs' | 'today'>, key: (t: Transaction) => string | null): Map<string, number> {
  const ym = monthOf(input.today)
  const keys = [1, 2, 3].map((i) => monthKey(addMonths(ym, -i)))
  const live = (t: Transaction) => !t.skipped && t.type === 'dia'
  const past = input.history.filter((t) => live(t) && keys.includes(monthKey(monthOf(t.date))))
  const months = new Set(past.map((t) => monthKey(monthOf(t.date)))).size
  const out = new Map<string, number>()
  const add = (t: Transaction, v: number) => {
    const k = key(t)
    if (k) out.set(k, (out.get(k) ?? 0) + v)
  }
  if (months > 0) for (const t of past) add(t, t.amount_cents / months)
  else {
    const factor = daysInMonth(ym) / Math.max(1, dayOf(input.today))
    for (const t of input.monthTxs.filter(live)) add(t, t.amount_cents * factor)
  }
  return out
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
  // O que já tem dono: fixos e parcelas (as parcelas acabam sozinhas)
  const parcels = input.monthTxs
    .filter((t) => !t.skipped && t.type === 'parcela')
    .map((t) => ({ label: `${t.description}${t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}`, amountCents: t.amount_cents, left: t.installment_total && t.installment_no ? t.installment_total - t.installment_no : 0 }))
    .sort((a, b) => b.amountCents - a.amountCents)
  const committed = { fixedCents: input.fixedCents, installmentsCents: input.installmentsCents, parcels }
  // Dia a dia por categoria, com as lojas/apps reconhecidos dentro de cada uma (Uber, iFood…)
  const byMerchant = monthlyBy(input, (t) => {
    const m = merchantOf(t.bank_info?.original ?? t.description)
    return m ? `${t.category_id ?? ''}|${m.name}` : null
  })
  const variable = input.categories
    .filter((c) => c.kind === 'expense' && (byCat.get(c.id) ?? 0) >= 1000)
    .map((c) => ({
      categoryId: c.id,
      label: c.name,
      group: c.grp,
      monthlyCents: round10(byCat.get(c.id) ?? 0),
      merchants: [...byMerchant]
        .filter(([k, v]) => k.startsWith(`${c.id}|`) && v >= 1000)
        .map(([k, v]) => ({ name: k.slice(c.id.length + 1), monthlyCents: round10(v) }))
        .sort((a, b) => b.monthlyCents - a.monthlyCents)
        .slice(0, 3),
    }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents)
  const variableCents = Math.round(daily)
  const scenarios = [10, 20, 30, 40].map((cutPct) => {
    const saveCents = round10((daily * cutPct) / 100)
    const after = left + saveCents
    return { cutPct, saveCents, leftCents: after, pct: income > 0 ? Math.floor((Math.max(0, after) / income) * 100) : 0 }
  })
  const passThroughs = countedPassThroughs(input.monthTxs).map((t) => ({ id: t.id, label: t.description.includes('|') ? t.description.split('|').slice(1).join(' ') : t.description, amountCents: t.amount_cents }))
  const extra = { committed, variable, variableCents, scenarios, passThroughs }

  const base = { incomeCents: income, spendCents: spend, leftCents: left, targetPct, targetCents: target, ...extra }
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

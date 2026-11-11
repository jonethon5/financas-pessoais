/**
 * Assistente: o app calcula, a IA só escreve.
 * Aqui ficam as contas (plano de corte, "posso comprar isso?") e o resumo em texto que vai para o modelo.
 * Sem nome, e-mail, foto nem descrição de lançamentos: só totais por categoria e caixinha.
 * Também monta uma resposta automática (sem IA) para o modo demonstração e quando a IA não está ligada.
 */
import type { AiTone, Goal, Transaction } from '../types'
import type { CategoryStatus, MonthSummary, Subscription, TodayBudget } from './budget'
import { addMonths, dayOf, daysInMonth, monthKey, monthOf } from './dates'
import type { GoalStatus } from './goals'
import type { Health } from './health'
import { formatBRL } from './money'
import { hourlyCents, workTime } from './psych'

export type CoachKind = 'diagnostico' | 'corte' | 'comprar' | 'dividas' | 'pergunta'

export type CoachInput = {
  today: string
  salaryCents: number | null
  payday: number | null
  hoursWeek: number
  summary: MonthSummary
  todayBudget: TodayBudget | null
  statuses: CategoryStatus[]
  history: Transaction[]
  monthTxs: Transaction[]
  goals: { goal: Goal; status: GoalStatus }[]
  subs: { items: Subscription[]; yearlyCents: number }
  health: Health
}

const brl = (c: number) => formatBRL(Math.round(c)).replace(/ /g, ' ')
const live = (t: Transaction) => !t.skipped

/** Quanto a pessoa costuma gastar por mês no dia a dia de cada categoria (média dos últimos 3 meses; sem histórico, projeta o mês atual). */
export function dailyByCategory(input: Pick<CoachInput, 'history' | 'monthTxs' | 'today'>): Map<string, number> {
  const ym = monthOf(input.today)
  const keys = [1, 2, 3].map((i) => monthKey(addMonths(ym, -i)))
  const past = input.history.filter((t) => live(t) && t.type === 'dia' && keys.includes(monthKey(monthOf(t.date))))
  const monthsWithData = new Set(past.map((t) => monthKey(monthOf(t.date)))).size
  const out = new Map<string, number>()
  if (monthsWithData > 0) {
    for (const t of past) out.set(t.category_id ?? '', (out.get(t.category_id ?? '') ?? 0) + t.amount_cents / monthsWithData)
    return out
  }
  const factor = daysInMonth(ym) / Math.max(1, dayOf(input.today))
  for (const t of input.monthTxs.filter((x) => live(x) && x.type === 'dia')) out.set(t.category_id ?? '', (out.get(t.category_id ?? '') ?? 0) + t.amount_cents * factor)
  return out
}

export type CutItem = { label: string; nowCents: number; saveCents: number; how: string }
export type CutPlan = { items: CutItem[]; monthlyCents: number; yearlyCents: number }

/** Quanto cortar em cada categoria, conforme o tom: suave 10%, equilibrado 20%, agressivo 35%. Desejos antes das necessidades. */
export const CUT_RATE: Record<AiTone, number> = { suave: 0.1, equilibrado: 0.2, agressivo: 0.35 }

const SUBSCRIPTION_WORDS = /assinatura|streaming|netflix|spotify|deezer|prime|disney|max\b|globoplay|youtube|apple|icloud|google one|xbox|playstation|game ?pass|clube|academia|gympass/i

export function cutPlan(input: CoachInput, tone: AiTone): CutPlan {
  const rate = CUT_RATE[tone]
  const byCat = dailyByCategory(input)
  const cats = input.statuses
    .map((s) => ({ s, monthly: byCat.get(s.category.id) ?? 0 }))
    .filter((x) => x.monthly >= 5000) // a partir de R$ 50 por mês vale a pena olhar
    .sort((a, b) => (a.s.category.grp === b.s.category.grp ? b.monthly - a.monthly : a.s.category.grp === 'desejo' ? -1 : 1))
    .slice(0, tone === 'agressivo' ? 4 : 3)
  const items: CutItem[] = cats.map(({ s, monthly }) => {
    const save = Math.round((monthly * (s.category.grp === 'necessidade' ? rate / 2 : rate)) / 100) * 100
    return {
      label: s.category.name,
      nowCents: Math.round(monthly / 100) * 100,
      saveCents: save,
      how: s.category.grp === 'necessidade' ? 'compare preços e planeje antes de ir' : `limite de ${brl(Math.round((monthly - save) / 4.33 / 100) * 100)} por semana`,
    }
  })
  // Cancelar só o que é assinatura de verdade (desejo): nunca aluguel, ajuda em casa, luz, escola…
  const grpOf = new Map(input.statuses.map((s) => [s.category.id, s.category.grp]))
  const subs = [...input.subs.items]
    .filter((s) => {
      const grp = s.categoryId ? grpOf.get(s.categoryId) : undefined
      return grp === 'desejo' || (grp == null && SUBSCRIPTION_WORDS.test(s.description))
    })
    .sort((a, b) => b.monthlyCents - a.monthlyCents)
    .slice(0, tone === 'agressivo' ? 2 : tone === 'equilibrado' ? 1 : 0)
  for (const s of subs) items.push({ label: s.description, nowCents: s.monthlyCents, saveCents: s.monthlyCents, how: 'cancelar (se sentir falta, assina de novo depois)' })
  const monthlyCents = items.reduce((a, i) => a + i.saveCents, 0)
  return { items: items.filter((i) => i.saveCents > 0), monthlyCents, yearlyCents: monthlyCents * 12 }
}

export type PurchaseVerdict = 'cabe' | 'apertado' | 'nao-cabe'
export type Purchase = {
  priceCents: number
  installments: number
  perInstallmentCents: number
  pctSalary: number | null
  work: string | null
  /** quantos dias do "pode gastar por dia" a compra (ou a parcela) consome */
  dailyDays: number | null
  /** sobra prevista do mês depois da compra (ou da 1ª parcela) */
  freeAfterCents: number
  /** meses de atraso nas caixinhas se o dinheiro sair delas */
  goalDelayMonths: number | null
  /** em quantos meses dá para juntar à vista guardando a sobra de hoje */
  monthsToSave: number | null
  verdict: PurchaseVerdict
}

export function purchaseImpact(input: CoachInput, priceCents: number, installments = 1): Purchase {
  const n = Math.max(1, Math.round(installments))
  const per = Math.ceil(priceCents / n)
  const salary = input.salaryCents ?? input.summary.income
  const freeAfter = input.summary.free - per
  const perMonthGoals = input.goals.reduce((a, g) => a + (g.status.done ? 0 : (g.status.perMonth ?? 0)), 0)
  const daily = input.todayBudget?.dailyAllowance ?? 0
  const monthlyFree = Math.max(0, input.summary.free)
  const verdict: PurchaseVerdict = freeAfter < 0 ? 'nao-cabe' : salary > 0 && freeAfter < salary * 0.05 ? 'apertado' : 'cabe'
  return {
    priceCents,
    installments: n,
    perInstallmentCents: per,
    pctSalary: salary > 0 ? priceCents / salary : null,
    work: workTime(priceCents, input.salaryCents, input.hoursWeek),
    dailyDays: daily > 0 ? per / daily : null,
    freeAfterCents: freeAfter,
    goalDelayMonths: perMonthGoals > 0 ? priceCents / perMonthGoals : null,
    monthsToSave: monthlyFree > 0 ? Math.ceil(priceCents / monthlyFree) : null,
    verdict,
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const one = (x: number) => (Math.round(x * 10) / 10).toLocaleString('pt-BR')

/** Texto da compra (os números que a IA vai usar e que a tela mostra). */
export function purchaseLines(p: Purchase, item: string): string[] {
  const lines = [`Compra: ${item || 'item'} de ${brl(p.priceCents)}${p.installments > 1 ? ` em ${p.installments}x de ${brl(p.perInstallmentCents)} (sem contar juros)` : ' à vista'}.`]
  if (p.pctSalary != null) lines.push(`É ${pct(p.pctSalary)} do salário.`)
  if (p.work) lines.push(`Custa ${p.work} de trabalho.`)
  if (p.dailyDays != null) lines.push(`${p.installments > 1 ? 'Cada parcela' : 'A compra'} equivale a ${one(p.dailyDays)} dias do valor que dá para gastar por dia.`)
  lines.push(p.freeAfterCents >= 0 ? `Depois dela, a sobra prevista do mês fica em ${brl(p.freeAfterCents)}.` : `Ela passa a sobra do mês em ${brl(-p.freeAfterCents)}.`)
  if (p.goalDelayMonths != null && p.goalDelayMonths >= 0.1) lines.push(`Se sair das caixinhas, atrasa as metas em ${p.goalDelayMonths < 2 ? `uns ${Math.round(p.goalDelayMonths * 30)} dias` : `${one(p.goalDelayMonths)} meses`}.`)
  if (p.monthsToSave != null && p.installments > 1) lines.push(`Guardando a sobra do mês, dá para juntar à vista em ${p.monthsToSave} ${p.monthsToSave === 1 ? 'mês' : 'meses'}.`)
  lines.push(`Conclusão do app: ${p.verdict === 'cabe' ? 'cabe no orçamento' : p.verdict === 'apertado' ? 'cabe, mas deixa o mês apertado' : 'não cabe no orçamento deste mês'}.`)
  return lines
}

/** Resumo dos números da pessoa (vai para a IA como dados). */
export function buildFacts(input: CoachInput): string {
  const { summary: s, todayBudget: t, today } = input
  const ym = monthOf(today)
  const L: string[] = []
  L.push(`Hoje: ${today.split('-').reverse().join('/')}. Faltam ${daysInMonth(ym) - dayOf(today) + 1} dias para o fim do mês.`)
  if (input.salaryCents) L.push(`Salário: ${brl(input.salaryCents)} por mês${input.payday ? `, cai todo dia ${input.payday}` : ''}. Vale ${brl(hourlyCents(input.salaryCents, input.hoursWeek))} por hora de trabalho.`)
  else L.push('Salário: não informado.')
  L.push(`Este mês: entrou ${brl(s.income)}; contas fixas ${brl(s.fixed)}; parcelas ${brl(s.installments)}; dia a dia ${brl(s.daily)}; plano de guardar ${brl(s.save)}; sobra prevista ${brl(s.free)}.`)
  if (t) L.push(`Pode gastar hoje: ${brl(t.leftToday)} (valor por dia: ${brl(t.dailyAllowance)}).`)

  const byCat = dailyByCategory(input)
  const cats = input.statuses
    .filter((x) => x.spent > 0 || (byCat.get(x.category.id) ?? 0) > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10)
  if (cats.length) {
    L.push('', 'Gastos por categoria este mês (gasto até agora · limite · média mensal do dia a dia):')
    for (const c of cats) {
      const avg = byCat.get(c.category.id)
      L.push(`- ${c.category.name} (${c.category.grp === 'necessidade' ? 'necessidade' : 'desejo'}): ${brl(c.spent)}${c.limit != null ? ` · limite ${brl(c.limit)}${c.level === 'over' ? ' (estourou)' : c.level === 'warn' ? ' (perto do limite)' : ''}` : ' · sem limite'}${avg ? ` · média ${brl(avg)}` : ''}`)
    }
  }
  if (input.subs.items.length) L.push('', `Gastos que se repetem: ${brl(input.subs.yearlyCents)} por ano. ${input.subs.items.slice(0, 6).map((x) => `${x.description} ${brl(x.monthlyCents)}/mês`).join('; ')}.`)

  const goals = input.goals.filter((g) => !g.status.done)
  if (input.goals.length) {
    L.push('', 'Caixinhas:')
    for (const { goal, status } of input.goals) {
      L.push(`- ${goal.name}: guardado ${brl(status.saved)}${status.target ? ` de ${brl(status.target)} (${pct(status.progress ?? 0)})` : ''}${status.perMonth ? `; plano ${brl(status.perMonth)} por mês` : ''}${status.needThisMonth ? `; falta ${brl(status.needThisMonth)} este mês` : ''}${status.done ? '; concluída' : ''}${status.late ? '; passou do prazo' : ''}`)
    }
  } else L.push('', 'Caixinhas: nenhuma ainda.')
  if (!goals.length && input.goals.length) L.push('Todas as caixinhas com meta estão concluídas.')

  const h = input.health
  L.push('', `Saúde financeira: ${h.score ?? 'sem nota'} de 100 (${h.label}).`)
  for (const p of h.pillars) L.push(`- ${p.title}: ${p.score == null ? 'sem dados' : `${p.score} de ${p.max}`}. ${p.status}`)
  return L.join('\n')
}

/** Resposta automática (sem IA): usada na demonstração e quando a chave do Gemini não está configurada. */
export function localAnswer(kind: CoachKind, input: CoachInput, tone: AiTone, extra?: { purchase?: Purchase; item?: string }): string {
  const h = input.health
  const soft = tone === 'suave'
  if (kind === 'comprar' && extra?.purchase) {
    const p = extra.purchase
    const head = p.verdict === 'cabe' ? 'Cabe no seu orçamento.' : p.verdict === 'apertado' ? 'Cabe, mas o mês fica apertado.' : 'Neste mês, não cabe.'
    const tip = p.verdict === 'nao-cabe'
      ? `Que tal criar uma caixinha para ${extra.item || 'essa compra'} e juntar antes? À vista costuma sair mais barato.`
      : p.installments > 1 ? 'Parcelado parece leve, mas prende o salário dos próximos meses. Se puder, junte e compre à vista.' : 'Se ainda tiver dúvida, coloque na Lista de desejos e espere 30 dias.'
    return [head, '', tip].join('\n')
  }
  if (kind === 'corte') {
    const plan = cutPlan(input, tone)
    if (!plan.items.length) return 'Ainda não há gastos suficientes para montar um plano de corte. Lance seus gastos do dia a dia por algumas semanas e peça de novo.'
    return [
      `${soft ? 'Uma sugestão leve' : 'Plano de corte'}: dá para guardar ${brl(plan.monthlyCents)} por mês, ${brl(plan.yearlyCents)} em um ano.`,
      '',
      ...plan.items.map((i) => `- **${i.label}**: hoje uns ${brl(i.nowCents)} por mês. Cortar ${brl(i.saveCents)}: ${i.how}.`),
      '',
      'Mande o valor economizado para uma caixinha no dia do salário, senão ele some em outros gastos (lição “Guarde primeiro, gaste depois”).',
    ].join('\n')
  }
  if (kind === 'dividas') {
    return [
      'Para sair das dívidas, o caminho que mais funciona:',
      '',
      '- **Pare de usar o rotativo e o cheque especial**: são os juros mais caros do país.',
      '- **Liste as dívidas da menor para a maior** e pague o mínimo em todas.',
      '- **Todo dinheiro extra vai para a menor.** Quitou, passe para a próxima (método bola de neve).',
      '- **Renegocie**: troque dívida cara por mais barata.',
      '',
      `Hoje a sobra prevista do seu mês é ${brl(Math.max(0, input.summary.free))}: esse é o valor que pode ir para a menor dívida.`,
    ].join('\n')
  }
  // Diagnóstico (e perguntas livres sem IA)
  const s = input.summary
  const spentRatio = s.income > 0 ? (s.committed + s.daily) / s.income : null
  const lines = [
    h.score != null ? `Sua saúde financeira está em **${h.score} de 100** (${h.label.toLowerCase()}).` : 'Ainda faltam dados para dar uma nota.',
    '',
    `- Entrou ${brl(s.income)} e já saiu ${brl(s.committed + s.daily)}${spentRatio != null ? ` (${pct(spentRatio)} da renda)` : ''}.`,
    `- A sobra prevista do mês é ${brl(s.free)}.`,
  ]
  const over = input.statuses.filter((x) => x.level === 'over')
  if (over.length) lines.push(`- Passou do limite em: ${over.map((x) => x.category.name).join(', ')}.`)
  if (h.next[0]) lines.push('', `**O próximo passo:** ${h.next[0].tip}`)
  if (kind === 'pergunta') lines.push('', 'Para perguntas livres, o assistente com IA precisa estar ligado. Enquanto isso, use os atalhos acima.')
  return lines.join('\n')
}

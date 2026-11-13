/**
 * Extrato e painel de uma conta: filtros, totais, o arquivo para baixar e os "achados" (onde e quando a pessoa mais gasta).
 * Tudo em centavos; a tela só mostra.
 */
import type { BankAccount, Category, Transaction } from '../types'
import { weekdayOf } from './dates'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---------------------------------------------------------------------------
// Texto do lançamento
// ---------------------------------------------------------------------------

/**
 * O banco manda "tipo|quem" (ex.: "Transferência enviada pelo Pix|MARIA SOUZA"). Na tela, quem vira o título
 * e o tipo vai embaixo, como no app do banco. O texto guardado continua igual ao do banco.
 */
export function txText(description: string): { title: string; detail: string | null } {
  const i = description.indexOf('|')
  if (i < 0) return { title: description, detail: null }
  const head = description.slice(0, i).trim()
  const who = description.slice(i + 1).trim()
  return who ? { title: who, detail: head || null } : { title: head || description, detail: null }
}

// ---------------------------------------------------------------------------
// Como foi pago
// ---------------------------------------------------------------------------

export type Method = 'credito' | 'pix' | 'debito' | 'manual'
export const METHOD_LABEL: Record<Method, string> = { credito: 'Cartão de crédito', pix: 'Pix', debito: 'Débito e conta', manual: 'Lançado à mão' }

/** Crédito, Pix ou débito: só dá para saber no que veio do banco (cartão = crédito; conta = Pix ou débito). */
export function methodOf(t: Pick<Transaction, 'bank_account_id' | 'description'>, accounts: Pick<BankAccount, 'id' | 'type'>[]): Method {
  const account = accounts.find((a) => a.id === t.bank_account_id)
  if (!account) return 'manual'
  if (account.type === 'CREDIT') return 'credito'
  return /pix|transfer/i.test(txText(t.description).detail ?? t.description) ? 'pix' : 'debito'
}

// ---------------------------------------------------------------------------
// Filtros e totais
// ---------------------------------------------------------------------------

/** tudo = o que conta no mês; fora = o que aparece mas não conta (entradas do banco, Pix entre contas próprias, fixo pulado) */
export type StatementView = 'tudo' | 'gastos' | 'entradas' | 'fora'

export function filterStatement<T extends Transaction>(txs: T[], opts: { view: StatementView; query?: string; accountId?: string | null }, categories: Category[]): T[] {
  const q = plain(opts.query ?? '').trim()
  const catName = new Map(categories.map((c) => [c.id, plain(c.name)]))
  return txs
    .filter((t) => (opts.view === 'fora' ? t.skipped : !t.skipped))
    .filter((t) => (opts.view === 'gastos' ? t.kind === 'expense' : opts.view === 'entradas' ? t.kind === 'income' : true))
    .filter((t) => !opts.accountId || t.bank_account_id === opts.accountId)
    .filter((t) => !q || plain(t.description).includes(q) || (catName.get(t.category_id ?? '') ?? '').includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
}

export function statementTotals(txs: Transaction[]): { income: number; expense: number } {
  return {
    income: sum(txs.filter((t) => t.kind === 'income').map((t) => t.amount_cents)),
    expense: sum(txs.filter((t) => t.kind === 'expense').map((t) => t.amount_cents)),
  }
}

// ---------------------------------------------------------------------------
// Arquivo para baixar (abre no Excel, no Google Planilhas e no LibreOffice)
// ---------------------------------------------------------------------------

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const brDate = (iso: string) => iso.split('-').reverse().join('/')
const brMoney = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/**
 * Planilha do extrato em CSV do jeito que o Excel em português abre direto:
 * ponto e vírgula entre as colunas, vírgula nos centavos e gasto com sinal de menos.
 */
export function statementCSV(txs: Transaction[], categories: Category[], accounts: Pick<BankAccount, 'id' | 'type' | 'name'>[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const lines = [['Data', 'Descrição', 'Categoria', 'Tipo', 'Forma', 'Conta', 'Valor (R$)', 'Conta no mês'].join(';')]
  for (const t of [...txs].sort((a, b) => a.date.localeCompare(b.date))) {
    const account = accounts.find((a) => a.id === t.bank_account_id)
    lines.push(
      [
        brDate(t.date),
        `${txText(t.description).title}${t.installment_no ? ` ${t.installment_no}/${t.installment_total}` : ''}`,
        cat.get(t.category_id ?? '') ?? '',
        t.kind === 'income' ? 'Entrada' : 'Gasto',
        METHOD_LABEL[methodOf(t, accounts)],
        account?.name ?? '',
        brMoney(t.kind === 'income' ? t.amount_cents : -t.amount_cents),
        t.skipped ? 'não' : 'sim',
      ]
        .map(cell)
        .join(';'),
    )
  }
  // O "BOM" no começo faz o Excel ler os acentos certo
  return `﻿${lines.join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------------
// Achados de uma conta (ou do mês todo)
// ---------------------------------------------------------------------------

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export type Insights = {
  /** total gasto e número de compras (só o que conta) */
  spent: number
  count: number
  /** valor médio de cada compra */
  ticket: number
  /** a maior compra */
  biggest: { description: string; cents: number; date: string } | null
  /** onde mais gastou: o mesmo lugar junto (ex.: todos os "Ifood") */
  topPlaces: { name: string; cents: number; count: number }[]
  /** gasto por dia da semana (domingo = 0) */
  weekdays: { day: number; label: string; cents: number; count: number }[]
  topWeekday: { label: string; cents: number; share: number } | null
  /** quanto do gasto foi no fim de semana (sábado e domingo) */
  weekendShare: number
  /** sentimento marcado em que mais gastou */
  topEmotion: { emotion: string; cents: number; count: number } | null
  /** compras pequenas (até R$ 30): quantas e quanto somam */
  small: { count: number; cents: number }
}

const SMALL_CENTS = 3000

/** Junta o mesmo lugar: tira números e códigos do fim ("Uber Trip 8842" e "Uber Trip 1120" viram "Uber Trip"). */
const placeKey = (description: string) =>
  plain(txText(description).title)
    .replace(/[^a-z ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .join(' ')

export function insights(txs: Transaction[]): Insights {
  const spends = txs.filter((t) => !t.skipped && t.kind === 'expense')
  const spent = sum(spends.map((t) => t.amount_cents))
  const top = [...spends].sort((a, b) => b.amount_cents - a.amount_cents)[0]

  const places = new Map<string, { name: string; cents: number; count: number }>()
  for (const t of spends) {
    const key = placeKey(t.description) || plain(t.description)
    const p = places.get(key) ?? { name: txText(t.description).title, cents: 0, count: 0 }
    p.cents += t.amount_cents
    p.count++
    places.set(key, p)
  }

  const weekdays = WEEKDAYS.map((label, day) => {
    const of = spends.filter((t) => weekdayOf(t.date) === day)
    return { day, label, cents: sum(of.map((t) => t.amount_cents)), count: of.length }
  })
  const best = [...weekdays].sort((a, b) => b.cents - a.cents)[0]

  const emotions = new Map<string, { cents: number; count: number }>()
  for (const t of spends) {
    if (!t.emotion) continue
    const e = emotions.get(t.emotion) ?? { cents: 0, count: 0 }
    e.cents += t.amount_cents
    e.count++
    emotions.set(t.emotion, e)
  }
  const emo = [...emotions.entries()].sort((a, b) => b[1].cents - a[1].cents)[0]
  const small = spends.filter((t) => t.amount_cents <= SMALL_CENTS)

  return {
    spent,
    count: spends.length,
    ticket: spends.length ? Math.round(spent / spends.length) : 0,
    biggest: top ? { description: txText(top.description).title, cents: top.amount_cents, date: top.date } : null,
    topPlaces: [...places.values()].sort((a, b) => b.cents - a.cents).slice(0, 5),
    weekdays,
    topWeekday: best && best.cents > 0 ? { label: best.label, cents: best.cents, share: spent ? best.cents / spent : 0 } : null,
    weekendShare: spent ? (weekdays[0].cents + weekdays[6].cents) / spent : 0,
    topEmotion: emo ? { emotion: emo[0], ...emo[1] } : null,
    small: { count: small.length, cents: sum(small.map((t) => t.amount_cents)) },
  }
}

const reais = (cents: number) => `R$ ${Math.round(cents / 100).toLocaleString('pt-BR')}`

/**
 * Dicas do porquinho a partir dos achados (no máximo 3, as mais úteis primeiro).
 * São frases sobre o que os números mostram: sem culpa e sem inventar nada.
 */
export function insightTips(i: Insights, topCategory: { name: string; cents: number; pct: number } | null): string[] {
  const tips: string[] = []
  if (!i.count) return tips
  if (topCategory && topCategory.pct >= 0.3) tips.push(`${topCategory.name} leva ${Math.round(topCategory.pct * 100)}% do que saiu daqui (${reais(topCategory.cents)}). Se for para mexer em algum lugar, é onde um corte pequeno mais aparece.`)
  const place = i.topPlaces[0]
  if (place && place.count >= 3) tips.push(`Você passou ${place.count} vezes em ${place.name}: ${reais(place.cents)} no total. Repetição pequena é o que mais passa despercebido.`)
  if (i.small.count >= 8) tips.push(`Foram ${i.small.count} compras de até R$ 30, que somam ${reais(i.small.cents)}. Sozinhas parecem nada; juntas pesam.`)
  if (i.weekendShare >= 0.45) tips.push(`${Math.round(i.weekendShare * 100)}% do gasto foi no sábado e no domingo. Decidir antes quanto dá para gastar no fim de semana ajuda mais do que segurar na hora.`)
  else if (i.topWeekday && i.topWeekday.share >= 0.3) tips.push(`${i.topWeekday.label[0].toUpperCase()}${i.topWeekday.label.slice(1)} é o dia em que mais sai dinheiro (${Math.round(i.topWeekday.share * 100)}% do total).`)
  if (i.topEmotion && i.topEmotion.count >= 2) tips.push(`Quando você marcou "${i.topEmotion.emotion}", gastou ${reais(i.topEmotion.cents)}. Vale combinar com você mesmo o que fazer nesses momentos.`)
  if (i.biggest && i.spent && i.biggest.cents / i.spent >= 0.35 && i.count >= 4) tips.push(`Uma compra só (${i.biggest.description}) foi ${Math.round((i.biggest.cents / i.spent) * 100)}% do total.`)
  return tips.slice(0, 3)
}

// Regras puras da conexão com o banco (sem acesso a rede): usadas na Edge Function "bank-sync" e testadas no Vitest.
// Transforma as transações do Open Finance (Pluggy) em lançamentos do app, sem contar nada duas vezes.

export type PluggyTx = {
  id: string
  description: string
  descriptionRaw?: string | null
  amount: number
  date: string
  category?: string | null
  type?: string | null
  status?: string | null
  creditCardMetadata?: { installmentNumber?: number | null; totalInstallments?: number | null; purchaseDate?: string | null } | null
  merchant?: { name?: string | null; businessName?: string | null } | null
}

export type AccountType = 'BANK' | 'CREDIT'

export type MappedTx = {
  external_id: string
  kind: 'income' | 'expense'
  type: 'dia' | 'extra' | 'parcela'
  amount_cents: number
  date: string
  description: string
  /** nome da categoria padrão sugerida (ex.: "Delivery") */
  categoryHint: string | null
  installment_no: number | null
  installment_total: number | null
  /** junta as parcelas da mesma compra */
  installmentKey: string | null
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Chave para aprender a categoria: as 2 primeiras palavras da descrição, sem números ("UBER *TRIP 123" → "uber trip"). */
export function learnKey(description: string): string {
  return normalize(description)
    .split(' ')
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .slice(0, 2)
    .join(' ')
}

/** "IFOOD *RESTAURANTE" → "Ifood Restaurante"; descrições já em maiúsculas e minúsculas ficam como estão. */
export function cleanDescription(raw: string): string {
  const s = raw.replace(/[*_]+/g, ' ').replace(/\s+/g, ' ').replace(/^\W+|\W+$/g, '').trim()
  const titled = s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : s
  return (titled || 'Sem descrição').slice(0, 60)
}

// Movimentações que não são gasto nem renda de verdade (contariam duas vezes)
const INTERNAL = [
  'pagamento de fatura', 'pagamento fatura', 'pagamento recebido', 'credit card payment', 'fatura do cartao', 'pgto fatura',
  'aplicacao', 'resgate', 'investment', 'rdb', 'dinheiro guardado', 'guardado na caixinha', 'caixinha', 'transferencia entre contas',
  'same ownership', 'mesma titularidade', 'estorno de pagamento',
]

export function isInternal(tx: PluggyTx): boolean {
  const text = normalize(`${tx.description} ${tx.descriptionRaw ?? ''} ${tx.category ?? ''}`)
  return INTERNAL.some((w) => text.includes(w))
}

// Palavra (na descrição ou na categoria do Open Finance) → categoria padrão do app
const CATEGORY_HINTS: [string[], string][] = [
  [['ifood', 'rappi', 'ze delivery', 'food delivery', 'delivery', 'aiqfome'], 'Delivery'],
  [['uber', '99app', '99 pop', 'taxi', 'cabify', 'combustivel', 'posto', 'gas station', 'fuel', 'estacionamento', 'parking', 'transport', 'metro', 'onibus', 'bilhete unico', 'sem parar'], 'Transporte'],
  [['netflix', 'spotify', 'youtube', 'disney', 'prime video', 'hbo', 'max ', 'deezer', 'streaming', 'apple com bill', 'google one', 'subscription', 'assinatura'], 'Assinaturas'],
  [['supermerc', 'mercado ', 'atacad', 'assai', 'carrefour', 'pao de acucar', 'padaria', 'hortifruti', 'groceries', 'supermarket'], 'Mercado'],
  [['farmacia', 'drogaria', 'droga raia', 'drogasil', 'pharmacy', 'drugstore', 'hospital', 'clinica', 'laboratorio', 'health', 'academia', 'smart fit', 'gym'], 'Saúde'],
  [['shopee', 'shein', 'mercado livre', 'mercadolivre', 'amazon', 'aliexpress', 'temu', 'magalu', 'online shopping'], 'Compras online'],
  [['vivo', 'claro', 'tim ', 'oi ', 'internet', 'telecom', 'telefone', 'mobile', 'celular'], 'Telefone e internet'],
  [['aluguel', 'condominio', 'enel', 'sabesp', 'cemig', 'copel', 'light ', 'energia', 'agua ', 'electricity', 'water', 'rent', 'housing', 'utilities'], 'Casa'],
  [['faculdade', 'escola', 'curso', 'university', 'school', 'education', 'mensalidade'], 'Educação'],
  [['renner', 'riachuelo', 'cea ', 'zara', 'clothing', 'apparel', 'vestuario', 'calcados'], 'Roupas'],
  [['cinema', 'ingresso', 'show', 'bar ', 'restaurante', 'restaurant', 'lanchonete', 'entertainment', 'leisure', 'lazer'], 'Lazer'],
  [['salao', 'barbearia', 'cabelo', 'beleza', 'beauty', 'personal care', 'cosmetic'], 'Cuidados pessoais'],
  [['livraria', 'livro', 'book', 'udemy', 'alura'], 'Cursos e livros'],
]

export function categoryHint(tx: PluggyTx, kind: 'income' | 'expense'): string | null {
  if (kind === 'income') return /salario|salary|folha|payroll|pagamento de salario/.test(normalize(`${tx.description} ${tx.category ?? ''}`)) ? 'Salário' : 'Renda extra'
  const text = ` ${normalize(`${tx.description} ${tx.descriptionRaw ?? ''} ${tx.merchant?.businessName ?? ''} ${tx.category ?? ''}`)} `
  for (const [words, name] of CATEGORY_HINTS) if (words.some((w) => text.includes(w.endsWith(' ') ? ` ${w}` : w))) return name
  return null
}

/**
 * Uma transação do banco → um lançamento do app (ou null para ignorar).
 * Conta corrente: saída (valor negativo) = gasto; entrada = renda.
 * Cartão de crédito: compra (valor positivo) = gasto; pagamento ou estorno (negativo) = ignorado.
 */
export function mapTransaction(tx: PluggyTx, account: AccountType): MappedTx | null {
  const cents = Math.round(Math.abs(tx.amount) * 100)
  if (!cents || isInternal(tx)) return null
  let kind: 'income' | 'expense'
  if (account === 'CREDIT') {
    if (tx.amount < 0) return null
    kind = 'expense'
  } else kind = tx.amount < 0 ? 'expense' : 'income'

  const meta = tx.creditCardMetadata
  const total = meta?.totalInstallments ?? null
  const isParcel = kind === 'expense' && total != null && total > 1 && meta?.installmentNumber != null
  const description = cleanDescription(tx.merchant?.businessName && tx.description.length < 4 ? tx.merchant.businessName : tx.description)
  return {
    external_id: `pluggy:${tx.id}`,
    kind,
    type: kind === 'income' ? 'extra' : isParcel ? 'parcela' : 'dia',
    amount_cents: cents,
    date: tx.date.slice(0, 10),
    description,
    categoryHint: categoryHint(tx, kind),
    installment_no: isParcel ? meta!.installmentNumber! : null,
    installment_total: isParcel ? total : null,
    installmentKey: isParcel ? `${normalize(description)}|${(meta?.purchaseDate ?? '').slice(0, 10)}|${total}` : null,
  }
}

const daysApart = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

/** A entrada parece ser o salário do mês? (valor até 15% diferente e até 6 dias do dia previsto) */
export function isSalaryMatch(tx: Pick<MappedTx, 'kind' | 'amount_cents' | 'date'>, salary: { amount_cents: number; date: string } | null): boolean {
  if (!salary || tx.kind !== 'income') return false
  return Math.abs(tx.amount_cents - salary.amount_cents) <= salary.amount_cents * 0.15 && daysApart(tx.date, salary.date) <= 6
}

/** O gasto paga um fixo do mês que ainda está em aberto? Escolhe o de valor mais parecido (até 10% e 7 dias). */
export function findFixedMatch<T extends { id: string; amount_cents: number; date: string; paid: boolean; external_id: string | null }>(
  tx: Pick<MappedTx, 'kind' | 'amount_cents' | 'date'>,
  fixed: T[],
): T | null {
  if (tx.kind !== 'expense') return null
  const candidates = fixed
    .filter((f) => !f.paid && !f.external_id && Math.abs(f.amount_cents - tx.amount_cents) <= f.amount_cents * 0.1 && daysApart(f.date, tx.date) <= 7)
    .sort((a, b) => Math.abs(a.amount_cents - tx.amount_cents) - Math.abs(b.amount_cents - tx.amount_cents))
  return candidates[0] ?? null
}

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
  /** tipo da operação no Open Finance (ex.: PIX, PAGAMENTO_FATURA, RESGATE_APLIC_FINANCEIRA) */
  operationType?: string | null
  /** quem pagou e quem recebeu (nem todo banco manda) */
  paymentData?: { payer?: Party | null; receiver?: Party | null; paymentMethod?: string | null } | null
}

type Party = { name?: string | null; documentNumber?: { type?: string | null; value?: string | null } | null }

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
  /** transferência entre contas da própria pessoa: aparece no extrato, mas não conta */
  own: boolean
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Palavras que não identificam quem recebeu (o aprendizado usa o nome da pessoa ou da loja)
const GENERIC = new Set(['pix', 'para', 'de', 'do', 'da', 'transferencia', 'enviada', 'recebida', 'pelo', 'pela', 'compra', 'no', 'na', 'debito', 'credito', 'pagamento', 'boleto', 'via', 'nupay', 'efetuado', 'ted', 'doc'])

/** Chave para aprender a categoria: as 2 primeiras palavras que identificam a loja ou pessoa ("Pix para Maria Souza" → "maria souza"). */
export function learnKey(description: string): string {
  return normalize(description)
    .split(' ')
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !GENERIC.has(w))
    .slice(0, 2)
    .join(' ')
}

const title = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : s)

/**
 * Descrição legível:
 *  "IFOOD *RESTAURANTE" → "Ifood Restaurante"
 *  "Transferência enviada pelo Pix|MARIA SOUZA" → "Pix para Maria Souza"
 *  "Transferência recebida pelo Pix|JOÃO" → "Pix de João"
 *  "Compra no débito|PADARIA X" → "Padaria X"
 */
export function cleanDescription(raw: string): string {
  const tidy = (s: string) => s.replace(/[*_]+/g, ' ').replace(/^[\d.\-/\s#]+(?=\D)/, '').replace(/\s+/g, ' ').replace(/^\W+|\W+$/g, '').trim()
  let out: string
  const [head, ...rest] = raw.split('|')
  const who = tidy(rest.join(' '))
  if (who) {
    const h = normalize(head)
    if (h.includes('pix') && h.includes('enviad')) out = `Pix para ${title(who)}`
    else if (h.includes('pix') && h.includes('recebid')) out = `Pix de ${title(who)}`
    else if (h.includes('transferencia') && h.includes('recebid')) out = `Transferência de ${title(who)}`
    else if (h.includes('transferencia') && h.includes('enviad')) out = `Transferência para ${title(who)}`
    else if (h.includes('boleto')) out = `Boleto ${title(who)}`
    else out = title(who)
  } else out = title(tidy(head))
  return (out || 'Sem descrição').slice(0, 60)
}

// Movimentações que não são gasto nem renda de verdade (contariam duas vezes): nem entram no app
const INTERNAL = [
  'pagamento de fatura', 'pagamento fatura', 'pagamento recebido', 'credit card payment', 'fatura do cartao', 'pgto fatura',
  'aplicacao', 'resgate', 'investment', 'rdb', 'dinheiro guardado', 'guardado na caixinha', 'caixinha', 'estorno de pagamento',
]
const INTERNAL_OPERATIONS = new Set(['PAGAMENTO_FATURA', 'RESGATE_APLIC_FINANCEIRA', 'APLICACAO_FINANCEIRA'])

export function isInternal(tx: PluggyTx): boolean {
  if (tx.operationType && INTERNAL_OPERATIONS.has(tx.operationType)) return true
  const text = normalize(`${tx.description} ${tx.descriptionRaw ?? ''} ${tx.category ?? ''}`)
  return INTERNAL.some((w) => text.includes(w))
}

// Transferência entre contas da própria pessoa, do jeito que o Open Finance descreve
const OWN_TRANSFER = ['same person transfer', 'same ownership', 'mesma titularidade', 'mesmo titular', 'transferencia entre contas', 'entre contas proprias']

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/** O nome aparece no texto? Precisa bater o primeiro e o último nome (só o primeiro nome não basta). */
export function mentionsName(text: string, fullName: string | null | undefined): boolean {
  const parts = normalize(fullName ?? '').split(' ').filter((w) => w.length > 1)
  if (parts.length < 2) return false
  const words = new Set(normalize(text).split(' '))
  return words.has(parts[0]) && words.has(parts[parts.length - 1])
}

/**
 * Transferência entre contas da própria pessoa (ex.: Pix do Neon para o Nubank):
 * não é renda nem gasto, é o mesmo dinheiro mudando de lugar.
 * Sinais: a categoria do Open Finance, o mesmo CPF dos dois lados, ou o nome da pessoa no Pix.
 */
export function isOwnTransfer(tx: PluggyTx, ownerNames: (string | null | undefined)[] = []): boolean {
  const text = `${tx.description} ${tx.descriptionRaw ?? ''}`
  const labels = normalize(`${text} ${tx.category ?? ''}`)
  if (OWN_TRANSFER.some((w) => labels.includes(w))) return true
  const payer = digits(tx.paymentData?.payer?.documentNumber?.value)
  const receiver = digits(tx.paymentData?.receiver?.documentNumber?.value)
  if (payer.length >= 11 && payer === receiver) return true
  if (!/\b(pix|ted|doc|transf\w*)\b/.test(normalize(`${text} ${tx.paymentData?.paymentMethod ?? ''} ${tx.operationType ?? ''}`))) return false
  const counterpart = `${text} ${tx.paymentData?.payer?.name ?? ''} ${tx.paymentData?.receiver?.name ?? ''}`
  return ownerNames.some((n) => mentionsName(counterpart, n))
}

// Palavra (na descrição ou na categoria do Open Finance) → categoria padrão do app
const CATEGORY_HINTS: [string[], string][] = [
  [['ifood', 'rappi', 'ze delivery', 'food delivery', 'delivery', 'aiqfome'], 'Delivery'],
  [['uber', '99app', '99 pop', 'taxi', 'cabify', 'combustivel', 'posto', 'gas station', 'fuel', 'estacionamento', 'parking', 'transport', 'metro', 'onibus', 'bilhete unico', 'sem parar'], 'Transporte'],
  [['netflix', 'spotify', 'youtube', 'disney', 'prime video', 'hbo', 'max ', 'deezer', 'streaming', 'apple com bill', 'google one', 'subscription', 'assinatura'], 'Assinaturas'],
  [['supermerc', 'mercado ', 'atacad', 'assai', 'carrefour', 'pao de acucar', 'companhia brasileira de distr', 'mercato', 'padaria', 'hortifruti', 'acougue', 'groceries', 'supermarket'], 'Mercado'],
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
  if (kind === 'income') return tx.operationType === 'FOLHA_PAGAMENTO' || /salario|salary|folha|payroll|pagamento de salario/.test(normalize(`${tx.description} ${tx.category ?? ''}`)) ? 'Salário' : 'Renda extra'
  const text = ` ${normalize(`${tx.description} ${tx.descriptionRaw ?? ''} ${tx.merchant?.businessName ?? ''} ${tx.category ?? ''}`)} `
  for (const [words, name] of CATEGORY_HINTS) if (words.some((w) => text.includes(w.endsWith(' ') ? ` ${w}` : w))) return name
  return null
}

/**
 * Uma transação do banco → um lançamento do app (ou null para ignorar).
 * Conta corrente: saída (valor negativo) = gasto; entrada = renda.
 * Cartão de crédito: compra (valor positivo) = gasto; pagamento ou estorno (negativo) = ignorado.
 * `ownerNames` (nome da pessoa no banco e no app) ajuda a reconhecer o Pix entre contas próprias.
 */
export function mapTransaction(tx: PluggyTx, account: AccountType, ownerNames: (string | null | undefined)[] = []): MappedTx | null {
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
    own: account === 'BANK' && isOwnTransfer(tx, ownerNames),
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

/**
 * A pessoa já tinha lançado esse gasto à mão? (mesmo valor, até 2 dias de diferença, ainda sem ligação com o banco)
 * Aí o lançamento do banco só confirma o dela, em vez de contar duas vezes. Escolhe o de data mais próxima.
 */
export function findManualMatch<T extends { id: string; amount_cents: number; date: string }>(tx: Pick<MappedTx, 'kind' | 'amount_cents' | 'date' | 'type'>, manual: T[]): T | null {
  if (tx.kind !== 'expense' || tx.type !== 'dia') return null
  const candidates = manual.filter((m) => m.amount_cents === tx.amount_cents && daysApart(m.date, tx.date) <= 2).sort((a, b) => daysApart(a.date, tx.date) - daysApart(b.date, tx.date))
  return candidates[0] ?? null
}

// ---------------------------------------------------------------------------
// O que conta no mês
// ---------------------------------------------------------------------------

/** Regras que a pessoa ensinou ao app (ficam em category_rules, com um prefixo que a chave da categoria nunca tem). */
export const countKey = (description: string) => {
  const k = learnKey(description)
  return k ? `conta:${k}` : ''
}
export const ignoreKey = (description: string) => {
  const k = learnKey(description)
  return k ? `ignora:${k}` : ''
}

/**
 * O lançamento que veio do banco entra na conta do mês?
 *  - transferência entre contas próprias: não;
 *  - entrada (Pix recebido etc.): só se a pessoa já disse que as entradas daquela origem contam.
 *    A renda do mês é o salário do cadastro mais o que a pessoa lança à mão;
 *  - gasto: sim, a não ser que a pessoa tenha dito para não contar os daquele destino.
 */
export function countsInMonth(m: Pick<MappedTx, 'kind' | 'own' | 'description'>, rules: { has(pattern: string): boolean }): boolean {
  if (m.own) return false
  if (m.kind === 'income') return rules.has(countKey(m.description))
  return !rules.has(ignoreKey(m.description))
}

const lastDayOf = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()

/** "2026-11" + 1 → "2026-12" */
export const shiftMonth = (month: string, n: number) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7)

/** Dia do pagamento naquele mês ("2026-02", dia 31 → "2026-02-28"), igual ao que o app usa para lançar o salário. */
export const paydayIn = (month: string, payday: number) => `${month}-${String(Math.min(Math.max(payday, 1), lastDayOf(month))).padStart(2, '0')}`

/**
 * De qual mês essa entrada pode ser o salário (o mais próximo primeiro).
 * O salário pode cair uns dias antes ou depois da virada do mês, por isso olha também os meses vizinhos.
 */
export function salaryMonths(tx: Pick<MappedTx, 'kind' | 'amount_cents' | 'date'>, salaryCents: number | null | undefined, payday: number | null | undefined): string[] {
  if (!salaryCents || !payday) return []
  const month = tx.date.slice(0, 7)
  return [month, shiftMonth(month, -1), shiftMonth(month, 1)]
    .filter((m) => isSalaryMatch(tx, { amount_cents: salaryCents, date: paydayIn(m, payday) }))
    .sort((a, b) => daysApart(tx.date, paydayIn(a, payday)) - daysApart(tx.date, paydayIn(b, payday)))
}

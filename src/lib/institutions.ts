/**
 * Bancos conhecidos: nome curto, cor e logo (ícones oficiais servidos pela Pluggy).
 * A conexão via Meu Pluggy não diz qual é o banco, então reconhecemos pelo nome da conta ou da conexão
 * (ex.: "Nu Pagamentos S.A." → Nubank).
 */
import BANKS from './banks.json'

export type Institution = { key: string; name: string; color: string; logo: string }

const CDN = 'https://cdn.pluggy.ai/assets/connector-icons'

const LIST: (Institution & { match: RegExp })[] = [
  { key: 'nubank', name: 'Nubank', color: '#8A0FBE', logo: `${CDN}/212.svg`, match: /\bnu ?bank\b|\bnu pagamentos\b|\bnu financeira\b/i },
  { key: 'neon', name: 'Neon', color: '#00A5E3', logo: `${CDN}/689.svg`, match: /\bneon\b/i },
  { key: 'inter', name: 'Inter', color: '#FB6910', logo: `${CDN}/215.svg`, match: /\binter\b/i },
  { key: 'itau', name: 'Itaú', color: '#EC7000', logo: `${CDN}/201.svg`, match: /\bitau\b/i },
  { key: 'bb', name: 'Banco do Brasil', color: '#1194F6', logo: `${CDN}/211.svg`, match: /banco do brasil|\bbb\b/i },
  { key: 'bradesco', name: 'Bradesco', color: '#E5173F', logo: `${CDN}/203.svg`, match: /bradesco/i },
  { key: 'santander', name: 'Santander', color: '#CC0000', logo: `${CDN}/208.svg`, match: /santander/i },
  { key: 'caixa', name: 'Caixa', color: '#296FA7', logo: `${CDN}/219.svg`, match: /\bcaixa\b/i },
  { key: 'c6', name: 'C6 Bank', color: '#242424', logo: `${CDN}/726.svg`, match: /\bc6\b/i },
  { key: 'picpay', name: 'PicPay', color: '#238662', logo: `${CDN}/651.svg`, match: /picpay/i },
  { key: 'mercadopago', name: 'Mercado Pago', color: '#009EE3', logo: `${CDN}/206.svg`, match: /mercado ?pago/i },
  { key: 'pagbank', name: 'PagBank', color: '#1BB99A', logo: `${CDN}/692.svg`, match: /pagbank|pagseguro/i },
  { key: 'next', name: 'Next', color: '#00C853', logo: `${CDN}/656.svg`, match: /\bnext\b/i },
  { key: 'btg', name: 'BTG Pactual', color: '#66768F', logo: `${CDN}/214.svg`, match: /\bbtg\b/i },
  { key: 'sicoob', name: 'Sicoob', color: '#00AE9D', logo: `${CDN}/228.svg`, match: /sicoob/i },
  { key: 'sicredi', name: 'Sicredi', color: '#3FA110', logo: `${CDN}/661.svg`, match: /sicredi/i },
]

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const pick = (i: Institution): Institution => ({ key: i.key, name: i.name, color: i.color, logo: i.logo })

/**
 * Todos os bancos que dá para conectar pelo Open Finance (lista da Pluggy, gerada por scripts/bancos.mjs),
 * em ordem alfabética. Os conhecidos usam o nome curto e a cor da lista acima.
 */
export const ALL_BANKS: Institution[] = (() => {
  const used = new Set<string>()
  const out: Institution[] = []
  for (const b of BANKS) {
    const known = LIST.find((i) => !used.has(i.key) && i.match.test(plain(b.name)) && plain(b.name).length <= plain(i.name).length + 18)
    const inst = known ? pick(known) : { key: `of-${b.id}`, name: b.name, color: b.color, logo: b.logo }
    used.add(inst.key)
    out.push(inst)
  }
  for (const i of LIST) if (!used.has(i.key)) out.push(pick(i))
  return out.sort((x, y) => plain(x.name).localeCompare(plain(y.name)))
})()

/**
 * Acha o banco pelos nomes que temos, na ordem em que vêm (o primeiro que der certo ganha).
 * Passe o nome da conta antes do nome da conexão: uma conexão do Meu Pluggy pode trazer contas de vários bancos.
 */
export function findInstitution(...names: (string | null | undefined)[]): Institution | null {
  for (const n of names) {
    if (!n) continue
    const text = n.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const hit = LIST.find((i) => i.match.test(text))
    if (hit) return pick(hit)
    const exact = ALL_BANKS.find((i) => plain(i.name) === plain(n))
    if (exact) return exact
  }
  return null
}

/** Busca pelo nome (sem acento, qualquer parte): "nu" acha Nubank, "caixa" acha as da Caixa. */
export function searchBanks(query: string): Institution[] {
  const q = plain(query)
  if (!q) return ALL_BANKS
  const hits = ALL_BANKS.filter((i) => plain(i.name).includes(q))
  // quem começa com o que foi digitado vem primeiro
  return [...hits.filter((i) => plain(i.name).startsWith(q)), ...hits.filter((i) => !plain(i.name).startsWith(q))]
}

/** Nome amigável de uma conta: "Nubank · Conta" em vez de "Nu Pagamentos S.A. - Instituição de Pagamento". */
export function accountTitle(inst: Institution | null, type: 'BANK' | 'CREDIT' | 'INVESTMENT', fallback: string): string {
  if (type === 'INVESTMENT') return inst ? `${inst.name} · ${fallback}` : fallback
  if (!inst) return fallback
  return `${inst.name} · ${type === 'CREDIT' ? 'Cartão' : 'Conta'}`
}

/** Banco pela chave (ex.: 'nubank'). */
export function institutionByKey(key: string): Institution | null {
  const hit = LIST.find((i) => i.key === key)
  return hit ? pick(hit) : (ALL_BANKS.find((i) => i.key === key) ?? null)
}

/** Os bancos e carteiras digitais mais usados no Brasil, para a pessoa escolher ao conectar. */
export const POPULAR_BANKS = ['nubank', 'caixa', 'itau', 'bradesco', 'bb', 'santander', 'inter', 'mercadopago', 'picpay', 'c6', 'neon', 'pagbank']
  .map((k) => institutionByKey(k))
  .filter((i): i is Institution => i != null)

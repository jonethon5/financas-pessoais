/**
 * Bancos conhecidos: nome curto, cor e logo (ícones oficiais servidos pela Pluggy).
 * A conexão via Meu Pluggy não diz qual é o banco, então reconhecemos pelo nome da conta ou da conexão
 * (ex.: "Nu Pagamentos S.A." → Nubank).
 */
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

/** Acha o banco pelos nomes que temos (nome da conexão primeiro, depois o nome da conta). */
export function findInstitution(...names: (string | null | undefined)[]): Institution | null {
  for (const n of names) {
    if (!n) continue
    const plain = n.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const hit = LIST.find((i) => i.match.test(plain))
    if (hit) return { key: hit.key, name: hit.name, color: hit.color, logo: hit.logo }
  }
  return null
}

/** Nome amigável de uma conta: "Nubank · Conta" em vez de "Nu Pagamentos S.A. - Instituição de Pagamento". */
export function accountTitle(inst: Institution | null, type: 'BANK' | 'CREDIT', fallback: string): string {
  if (!inst) return fallback
  return `${inst.name} · ${type === 'CREDIT' ? 'Cartão' : 'Conta'}`
}

/** Banco pela chave (ex.: 'nubank'). */
export function institutionByKey(key: string): Institution | null {
  const hit = LIST.find((i) => i.key === key)
  return hit ? { key: hit.key, name: hit.name, color: hit.color, logo: hit.logo } : null
}

/** Os bancos e carteiras digitais mais usados no Brasil, para a pessoa escolher ao conectar. */
export const POPULAR_BANKS = ['nubank', 'caixa', 'itau', 'bradesco', 'bb', 'santander', 'inter', 'mercadopago', 'picpay', 'c6']
  .map((k) => institutionByKey(k))
  .filter((i): i is Institution => i != null)

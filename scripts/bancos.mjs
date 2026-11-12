// Gera src/lib/banks.json: os bancos que dá para conectar pelo Open Finance (nome, cor e logo), direto da Pluggy.
// Uso: node scripts/bancos.mjs   (lê PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET de supabase/functions/.env; nada é impresso)
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../supabase/functions/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^"|"$/g, '')]),
)
const API = 'https://api.pluggy.ai'
const auth = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }) })
if (!auth.ok) throw new Error(`A Pluggy recusou as chaves (${auth.status}).`)
const { apiKey } = await auth.json()

const res = await fetch(`${API}/connectors?countries=BR&isOpenFinance=true&pageSize=500`, { headers: { 'X-API-KEY': apiKey } })
if (!res.ok) throw new Error(`Não consegui listar os bancos (${res.status}).`)
const { results } = await res.json()

const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const seen = new Set()
const banks = results
  // só contas de pessoa física (o app é pessoal)
  .filter((c) => c.isOpenFinance && c.type === 'PERSONAL_BANK' && !c.isSandbox)
  .map((c) => ({ id: c.id, name: c.name.replace(/\s*\(?open finance\)?/i, '').trim(), color: `#${String(c.primaryColor ?? '5B6B7A').replace('#', '')}`, logo: c.imageUrl ?? '' }))
  .filter((b) => (seen.has(plain(b.name)) ? false : seen.add(plain(b.name))))
  .sort((a, b) => plain(a.name).localeCompare(plain(b.name)))

writeFileSync(new URL('../src/lib/banks.json', import.meta.url), `${JSON.stringify(banks, null, 1)}\n`)
console.log(`${banks.length} bancos gravados em src/lib/banks.json`)

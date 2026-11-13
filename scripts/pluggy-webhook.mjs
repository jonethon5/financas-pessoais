// Registra na Pluggy o aviso "item/updated" apontando para a função bank-webhook do Supabase.
// Assim, quando o Meu Pluggy termina de atualizar um banco (1 vez por dia), o app busca os lançamentos na hora.
// Roda no deploy (GitHub Actions). Variáveis: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, SUPABASE_URL.
// Não imprime chaves.
import { createHash } from 'node:crypto'

const { PLUGGY_CLIENT_ID: id, PLUGGY_CLIENT_SECRET: secret, SUPABASE_URL: base } = process.env
if (!id || !secret || !base) {
  console.log('Sem chaves da Pluggy ou endereço do Supabase: aviso não registrado.')
  process.exit(0)
}
const API = 'https://api.pluggy.ai'
const key = createHash('sha256').update(`${secret}:poupei-webhook`).digest('hex').slice(0, 40)
const prefix = `${base.replace(/\/$/, '')}/functions/v1/bank-webhook`
const url = `${prefix}?chave=${key}`

const auth = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id, clientSecret: secret }) })
if (!auth.ok) throw new Error(`A Pluggy recusou as chaves (${auth.status}).`)
const { apiKey } = await auth.json()
const call = async (method, path, body) => {
  const r = await fetch(`${API}${path}`, { method, headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data?.message ?? ''}`)
  return data
}

const { results = [] } = await call('GET', '/webhooks')
const ours = results.filter((w) => String(w.url ?? '').startsWith(prefix))
const ok = ours.find((w) => w.url === url && w.event === 'item/updated')
for (const w of ours) if (w !== ok) await call('DELETE', `/webhooks/${w.id}`)
if (ok) console.log('Aviso da Pluggy já registrado.')
else {
  await call('POST', '/webhooks', { event: 'item/updated', url })
  console.log('Aviso da Pluggy registrado (item/updated → bank-webhook).')
}

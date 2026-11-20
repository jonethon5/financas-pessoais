// Avisos de ponta a ponta, contra o Supabase LOCAL e um "serviço de push de mentira" (servidor HTTP local,
// no lugar do Google/Apple). Só roda quando o supabase/functions/.env de teste tem as chaves:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e NOTIFY_CRON_SECRET=segredo-de-teste-cron
import { createECDH, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `PUSH-${run.toUpperCase()}`
const SECRET = 'segredo-de-teste-cron'
const MOCK = 'http://host.docker.internal:55397'

// ---- Serviço de push de mentira -------------------------------------------------
type Hit = { path: string; encoding: string | undefined; auth: string | undefined; ttl: string | undefined; bytes: number }
const hits: Hit[] = []
let server: Server
function startMock(): Promise<void> {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (d) => chunks.push(d))
    req.on('end', () => {
      hits.push({ path: req.url ?? '', encoding: req.headers['content-encoding'] as string, auth: req.headers.authorization, ttl: req.headers.ttl as string, bytes: Buffer.concat(chunks).length })
      // "/sumiu/...": o navegador desfez a inscrição
      res.writeHead(req.url?.startsWith('/sumiu/') ? 410 : 201)
      res.end()
    })
  })
  return new Promise((r) => server.listen(55397, '0.0.0.0', () => r()))
}

/** Uma inscrição de navegador de verdade (chave P-256 e segredo de 16 bytes), apontando para o mock. */
function fakeSubscription(path: string) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { endpoint: `${MOCK}/${path}/${randomBytes(6).toString('hex')}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
}

const cron = (body: Record<string, unknown>, secret = SECRET) =>
  fetch(`${URL}/functions/v1/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret }, body: JSON.stringify({ action: 'run', ...body }) })

let user: { id: string; client: SupabaseClient }
let configured = false

beforeAll(async () => {
  await startMock()
  await admin.from('beta_codes').insert({ code: CODE, max_uses: 2 })
  const email = `push-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'senha-de-teste-123', email_confirm: true, user_metadata: { name: 'Ana Souza', beta_code: CODE } })
  if (error) throw error
  const client = createClient(URL, ANON, opts)
  await client.auth.signInWithPassword({ email, password: 'senha-de-teste-123' })
  user = { id: data.user.id, client }
  await admin.from('profiles').update({ ai_tone: 'suave', payday: 30, last_seen_on: '2026-11-19', onboarded_at: new Date().toISOString(), prefs: { tz: 'America/Sao_Paulo' } }).eq('id', user.id)
  const status = await client.functions.invoke('notify', { body: { action: 'status' } })
  configured = status.data?.configured === true
}, 60_000)

afterAll(async () => {
  server?.close()
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => undefined)
  await admin.from('beta_codes').delete().eq('code', CODE)
})

type Planned = { user: string; kind: string; title: string; body: string }
const mine = (planned: Planned[]) => planned.filter((p) => p.user === user.id)

describe('avisos (push de mentira)', () => {
  it('a rodada de hora em hora precisa do segredo', async () => {
    const r = await cron({}, 'errado')
    expect(r.status).toBe(401)
  })

  it('inscrição: precisa estar logado e só aceita uma inscrição válida', async () => {
    const anon = createClient(URL, ANON, opts)
    expect((await anon.functions.invoke('notify', { body: { action: 'subscribe', subscription: fakeSubscription('ok') } })).error).toBeTruthy()
    if (!configured) return
    expect((await user.client.functions.invoke('notify', { body: { action: 'subscribe', subscription: { endpoint: 'nada', keys: {} } } })).error).toBeTruthy()
    const { error } = await user.client.functions.invoke('notify', { body: { action: 'subscribe', subscription: fakeSubscription('ok'), userAgent: 'teste' } })
    expect(error).toBeNull()
    // a pessoa vê a própria inscrição (e só ela)
    const { data } = await user.client.from('push_subscriptions').select('endpoint, user_agent')
    expect(data).toHaveLength(1)
    expect(data![0].user_agent).toBe('teste')
  })

  it('aviso de teste chega criptografado e assinado (Web Push de verdade)', async () => {
    if (!configured) return
    hits.length = 0
    const { data, error } = await user.client.functions.invoke('notify', { body: { action: 'test' } })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: true, devices: 1 })
    expect(hits).toHaveLength(1)
    expect(hits[0].encoding).toBe('aes128gcm')
    expect(hits[0].auth).toMatch(/^vapid t=.+, k=.+/)
    expect(Number(hits[0].ttl)).toBeGreaterThan(0)
    expect(hits[0].bytes).toBeGreaterThan(100)
  })

  it('à noite, quem não abriu o app recebe o lembrete do porquinho (uma vez só)', async () => {
    if (!configured) return
    // sexta, 20:30 em Brasília
    const now = '2026-11-20T23:30:00Z'
    const dry = await (await cron({ now, dryRun: true })).json()
    const planned = mine(dry.planned)
    expect(planned).toHaveLength(1)
    expect(planned[0]).toMatchObject({ kind: 'lembrete', title: 'Poupinho' })
    expect(planned[0].body).toMatch(/Ana/)

    hits.length = 0
    const real = await (await cron({ now })).json()
    expect(real.ok).toBe(true)
    expect(hits.filter((h) => h.path.startsWith('/ok/'))).toHaveLength(1)
    const { data: log } = await admin.from('notification_log').select('ref, kind').eq('user_id', user.id)
    expect(log).toEqual([{ ref: 'lembrete:2026-11-20', kind: 'lembrete' }])

    // de novo na mesma noite: não repete
    hits.length = 0
    await cron({ now: '2026-11-21T00:30:00Z' })
    expect(hits).toHaveLength(0)
  })

  it('de manhã, a conta que vence em 2 dias (gasto fixo com aviso 3 dias antes)', async () => {
    if (!configured) return
    const { error } = await admin.from('recurrings').insert({ user_id: user.id, description: 'Telefone', amount_cents: 3900, day: 22, remind: true, remind_days: 3, start_month: '2026-11' })
    expect(error).toBeNull()
    const dry = await (await cron({ now: '2026-11-20T12:30:00Z', dryRun: true })).json()
    expect(mine(dry.planned)).toEqual([expect.objectContaining({ kind: 'vencimentos', title: 'Telefone vence em 2 dias' })])
    // pago: não avisa
    await admin.from('transactions').insert({ user_id: user.id, kind: 'expense', type: 'fixo', description: 'Telefone', amount_cents: 3900, date: '2026-11-22', recurring_id: (await admin.from('recurrings').select('id').eq('user_id', user.id).single()).data!.id, paid: true })
    const after = await (await cron({ now: '2026-11-20T12:30:00Z', dryRun: true })).json()
    expect(mine(after.planned)).toEqual([])
  })

  it('aviso desligado em Ajustes não sai; aparelho que desfez a inscrição some da lista', async () => {
    if (!configured) return
    // segunda, 20:30 em Brasília (domingo teria a revisão da semana)
    await admin.from('profiles').update({ last_seen_on: '2026-11-22', prefs: { tz: 'America/Sao_Paulo', notify: { lembrete: false } } }).eq('id', user.id)
    const dry = await (await cron({ now: '2026-11-23T23:30:00Z', dryRun: true })).json()
    expect(mine(dry.planned)).toEqual([])

    await admin.from('profiles').update({ prefs: { tz: 'America/Sao_Paulo' } }).eq('id', user.id)
    await user.client.functions.invoke('notify', { body: { action: 'subscribe', subscription: fakeSubscription('sumiu') } })
    hits.length = 0
    await cron({ now: '2026-11-23T23:30:00Z' })
    expect(hits.some((h) => h.path.startsWith('/sumiu/'))).toBe(true)
    const { data } = await admin.from('push_subscriptions').select('endpoint').eq('user_id', user.id)
    expect(data!.every((s) => s.endpoint.includes('/ok/'))).toBe(true)
  })
})

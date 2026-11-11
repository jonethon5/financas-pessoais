// Assistente de ponta a ponta, contra o Supabase LOCAL e um "Gemini de mentira" (servidor HTTP local).
// Só roda quando o supabase/functions/.env aponta para este servidor:
//   GEMINI_API_KEY=chave-de-teste
//   GEMINI_API_BASE=http://host.docker.internal:55398
// Sem isso (IA desligada), confere só que a função responde que a IA não está ligada.
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `ASK-${run.toUpperCase()}`

// ---- Gemini de mentira ---------------------------------------------------------
type Call = { model: string; key: string | undefined; system: string; last: string; turns: number }
const calls: Call[] = []
let failAll = false
let server: Server
function startMock(): Promise<void> {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const model = decodeURIComponent(/models\/([^:]+):generateContent/.exec(req.url ?? '')?.[1] ?? '')
      calls.push({ model, key: req.headers['x-goog-api-key'] as string | undefined, system: body.systemInstruction?.parts?.[0]?.text ?? '', last: body.contents?.at(-1)?.parts?.[0]?.text ?? '', turns: body.contents?.length ?? 0 })
      res.writeHead(failAll ? 503 : 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(failAll ? { error: { status: 'UNAVAILABLE', message: 'overloaded' } } : { candidates: [{ content: { parts: [{ text: 'pensando...', thought: true }, { text: 'Seu mês está **no caminho certo**.' }] } }] }))
    })
  })
  return new Promise((r) => server.listen(55398, '0.0.0.0', () => r()))
}

let user: { id: string; client: SupabaseClient }
let configured = false

beforeAll(async () => {
  await startMock()
  await admin.from('beta_codes').insert({ code: CODE, max_uses: 2 })
  const email = `ask-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'senha-de-teste-123', email_confirm: true, user_metadata: { name: 'Teste', beta_code: CODE } })
  if (error) throw error
  const client = createClient(URL, ANON, opts)
  await client.auth.signInWithPassword({ email, password: 'senha-de-teste-123' })
  user = { id: data.user.id, client }
  await admin.from('profiles').update({ ai_tone: 'suave' }).eq('id', user.id)
  const usage = await client.functions.invoke('ask', { body: { action: 'usage' } })
  configured = usage.data?.configured === true
}, 60_000)

afterAll(async () => {
  server?.close()
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => undefined)
  await admin.from('beta_codes').delete().eq('code', CODE)
})

const ask = (body: Record<string, unknown>) => user.client.functions.invoke('ask', { body: { action: 'ask', ...body } })

describe('assistente (Gemini de mentira)', () => {
  it('precisa estar logado', async () => {
    const anon = createClient(URL, ANON, opts)
    const r = await anon.functions.invoke('ask', { body: { action: 'usage' } })
    expect(r.error).toBeTruthy()
  })

  it('sem a chave, avisa que a IA não está ligada', async () => {
    if (configured) return
    const r = await ask({ kind: 'diagnostico', facts: 'x' })
    expect(r.error).toBeTruthy()
  })

  it('responde no tom da pessoa, com a base do Aprender e os números do app', async () => {
    if (!configured) return
    const { data, error } = await ask({ kind: 'comprar', facts: 'Salário: R$ 3.000,00 por mês.', extra: 'Conclusão do app: cabe no orçamento.', history: [{ role: 'user', text: 'oi' }, { role: 'model', text: 'olá' }] })
    expect(error).toBeNull()
    expect(data).toEqual({ answer: 'Seu mês está **no caminho certo**.', used: 1, limit: 20 })
    const c = calls.at(-1)!
    expect(c.key).toBe('chave-de-teste')
    expect(c.system).toContain('Tom SUAVE')
    expect(c.system).toContain('Lição "Guarde primeiro, gaste depois"')
    expect(c.system).toContain('NUNCA recomende investimentos')
    expect(c.last).toContain('Salário: R$ 3.000,00 por mês.')
    expect(c.last).toContain('# Cálculo do app')
    expect(c.turns).toBe(3)
  })

  it('Google fora do ar: tenta o modelo reserva e devolve a pergunta (não gasta a cota)', async () => {
    if (!configured) return
    failAll = true
    const before = calls.length
    const r = await ask({ kind: 'diagnostico', facts: 'x' })
    failAll = false
    expect(r.error).toBeTruthy()
    expect(calls.slice(before).map((c) => c.model)).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest'])
    const usage = await user.client.functions.invoke('ask', { body: { action: 'usage' } })
    expect(usage.data.used).toBe(1)
  })

  it('limite de 20 perguntas por dia', async () => {
    if (!configured) return
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    await admin.from('ai_usage').update({ questions: 20 }).eq('user_id', user.id).eq('day', today)
    const r = await ask({ kind: 'diagnostico', facts: 'x' })
    expect(r.error).toBeTruthy()
    expect(await r.error.context.json()).toEqual({ error: 'Você já fez as 20 perguntas de hoje. Amanhã libera de novo.' })
  })

  it('pergunta livre vazia é recusada e ninguém lê a cota direto pelo app', async () => {
    const r = await ask({ kind: 'pergunta', question: '   ' })
    expect(r.error).toBeTruthy()
    const { data } = await user.client.from('ai_usage').select('*')
    expect(data ?? []).toEqual([])
  })
})

// Teste de integração contra o Supabase LOCAL: confere que o RLS isola cada pessoa.
// Rodar: npm run db:start   e depois   npm run test:db
// (as chaves vêm do "supabase status" local; nada aqui toca no projeto de verdade)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `RLS-${run.toUpperCase()}`
const PASSWORD = 'senha-de-teste-123'

type User = { id: string; email: string; client: SupabaseClient }
const created: string[] = []

async function newUser(label: string, extra: Record<string, unknown> = {}): Promise<User> {
  const email = `${label}-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name: label, beta_code: CODE, ...extra } })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(URL, ANON, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw signInError
  return { id: data.user.id, email, client }
}

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })

let a: User
let b: User
let anon: SupabaseClient

beforeAll(async () => {
  expect(URL, 'rode via "npm run test:db" (precisa do Supabase local)').toBeTruthy()
  const { error } = await admin.from('beta_codes').insert({ code: CODE, max_uses: 10, note: 'teste automático' })
  if (error) throw error
  a = await newUser('ana')
  b = await newUser('bruno')
  anon = createClient(URL, ANON, opts)

  await a.client.from('profiles').update({ salary_cents: 350000, payday: 5 }).eq('id', a.id)
  await b.client.from('profiles').update({ salary_cents: 990000, payday: 10 }).eq('id', b.id)
  await a.client.from('feedback').insert({ kind: 'sugestao', message: 'mensagem da Ana' })
  await b.client.from('feedback').insert({ kind: 'problema', message: 'mensagem do Bruno' })
  await a.client.storage.from('fotos').upload(`${a.id}/avatar.jpg`, jpeg(), { contentType: 'image/jpeg' })
  await b.client.storage.from('fotos').upload(`${b.id}/avatar.jpg`, jpeg(), { contentType: 'image/jpeg' })
})

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined)
  await admin.storage.from('fotos').remove(created.map((id) => `${id}/avatar.jpg`))
  await admin.from('beta_codes').delete().eq('code', CODE)
})

describe('cadastro com código do beta', () => {
  it('confere o código antes do cadastro (visitante sem login)', async () => {
    expect((await anon.rpc('check_beta_code', { p_code: CODE.toLowerCase() })).data).toBe(true)
    expect((await anon.rpc('check_beta_code', { p_code: 'NAO-EXISTE' })).data).toBe(false)
  })

  it('recusa cadastro sem código válido e aceita com código', async () => {
    const bad = await anon.auth.signUp({ email: `sem-codigo-${run}@teste.local`, password: PASSWORD, options: { data: { beta_code: 'ERRADO' } } })
    expect(bad.error).toBeTruthy()
    const good = await anon.auth.signUp({ email: `com-codigo-${run}@teste.local`, password: PASSWORD, options: { data: { name: 'Caio', beta_code: CODE } } })
    expect(good.error).toBeNull()
    if (good.data.user) created.push(good.data.user.id)
    const { data } = await admin.from('beta_codes').select('uses').eq('code', CODE).single()
    expect(data!.uses).toBe(3) // Ana, Bruno e Caio
  })
})

describe('cada pessoa só vê o que é dela', () => {
  it('perfis', async () => {
    const { data } = await a.client.from('profiles').select('id, salary_cents')
    expect(data).toEqual([{ id: a.id, salary_cents: 350000 }])
  })

  it('não altera o perfil de outra pessoa', async () => {
    const { data } = await a.client.from('profiles').update({ name: 'invadido' }).eq('id', b.id).select()
    expect(data).toEqual([])
    const check = await admin.from('profiles').select('name').eq('id', b.id).single()
    expect(check.data!.name).toBe('bruno')
  })

  it('não vira administrador sozinho', async () => {
    const { error } = await a.client.from('profiles').update({ is_admin: true }).eq('id', a.id)
    expect(error).toBeTruthy()
    expect((await a.client.rpc('admin_stats')).error).toBeTruthy()
  })

  it('sugestões', async () => {
    const { data } = await a.client.from('feedback').select('message')
    expect(data).toEqual([{ message: 'mensagem da Ana' }])
    const forged = await a.client.from('feedback').insert({ kind: 'sugestao', message: 'fingindo ser o Bruno', user_id: b.id })
    expect(forged.error).toBeTruthy()
  })

  it('códigos do beta e configurações são só do administrador', async () => {
    expect((await a.client.from('beta_codes').select('code')).data).toEqual([])
    expect((await a.client.from('beta_codes').insert({ code: `HACK-${run.toUpperCase()}` })).error).toBeTruthy()
    const upd = await a.client.from('app_settings').update({ value: false }).eq('key', 'beta_code_required').select()
    expect(upd.data ?? []).toEqual([])
  })

  it('fotos: não baixa nem grava na pasta de outra pessoa', async () => {
    expect((await a.client.storage.from('fotos').download(`${a.id}/avatar.jpg`)).error).toBeNull()
    expect((await a.client.storage.from('fotos').download(`${b.id}/avatar.jpg`)).error).toBeTruthy()
    expect((await a.client.storage.from('fotos').upload(`${b.id}/intruso.jpg`, jpeg(), { contentType: 'image/jpeg' })).error).toBeTruthy()
  })

  it('visitante sem login não lê nada', async () => {
    expect((await anon.from('profiles').select('id')).data ?? []).toEqual([])
    expect((await anon.from('feedback').select('id')).data ?? []).toEqual([])
    expect((await anon.storage.from('fotos').download(`${a.id}/avatar.jpg`)).error).toBeTruthy()
  })
})

describe('administrador', () => {
  it('vê todas as sugestões e os números do beta, mas não os perfis dos testadores', async () => {
    await admin.from('profiles').update({ is_admin: true }).eq('id', b.id)
    const fb = await b.client.rpc('admin_feedback')
    expect(fb.error).toBeNull()
    expect((fb.data as { message: string }[]).map((f) => f.message)).toEqual(expect.arrayContaining(['mensagem da Ana', 'mensagem do Bruno']))
    expect((await b.client.rpc('admin_stats')).error).toBeNull()
    const { data } = await b.client.from('profiles').select('id')
    expect(data).toEqual([{ id: b.id }])
    await admin.from('profiles').update({ is_admin: false }).eq('id', b.id)
  })
})

describe('excluir conta', () => {
  it('apaga perfil, sugestões e fotos da pessoa, sem tocar nos outros', async () => {
    const { error } = await a.client.functions.invoke('delete-account', { body: { confirm: 'EXCLUIR' } })
    expect(error).toBeNull()
    expect((await admin.from('profiles').select('id').eq('id', a.id)).data).toEqual([])
    expect((await admin.from('feedback').select('id').eq('user_id', a.id)).data).toEqual([])
    expect((await admin.storage.from('fotos').list(a.id)).data).toEqual([])
    expect((await admin.auth.admin.getUserById(a.id)).data.user).toBeNull()
    expect((await admin.from('profiles').select('id').eq('id', b.id)).data).toHaveLength(1)
  })
})

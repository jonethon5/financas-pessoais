// "Avalie esta tela" contra o Supabase LOCAL: cada pessoa só grava e vê as próprias notas,
// o banco recusa nota fora de 1 a 5 e só o administrador vê as notas de todo mundo.
// Rodar: npm run db:start   e depois   npm run test:db
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `NOTA-${run.toUpperCase()}`
const PASSWORD = 'senha-de-teste-123'
const created: string[] = []

type User = { id: string; client: SupabaseClient }

async function newUser(label: string): Promise<User> {
  const email = `${label}-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name: label, beta_code: CODE } })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(URL, ANON, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw signInError
  return { id: data.user.id, client }
}

let a: User
let b: User

beforeAll(async () => {
  expect(URL, 'rode via "npm run test:db" (precisa do Supabase local)').toBeTruthy()
  const { error } = await admin.from('beta_codes').insert({ code: CODE, max_uses: 10, note: 'teste automático' })
  if (error) throw error
  a = await newUser('ana')
  b = await newUser('bruno')
})

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined)
  await admin.from('beta_codes').delete().eq('code', CODE)
})

describe('avaliação de tela', () => {
  it('grava a nota com o que melhorar e o comentário', async () => {
    const { error } = await a.client
      .from('screen_ratings')
      .insert({ screen: 'extrato', rating: 2, problems: ['Valor ou conta errada'], message: 'o saldo não bateu', context: { versao: 'teste' } })
    expect(error).toBeNull()
    expect((await b.client.from('screen_ratings').insert({ screen: 'inicio', rating: 5 })).error).toBeNull()
  })

  it('cada pessoa só vê as próprias notas', async () => {
    const { data } = await a.client.from('screen_ratings').select('screen, rating, user_id')
    expect(data).toEqual([{ screen: 'extrato', rating: 2, user_id: a.id }])
  })

  it('não dá para gravar em nome de outra pessoa, nem sem login', async () => {
    expect((await a.client.from('screen_ratings').insert({ user_id: b.id, screen: 'mes', rating: 1 })).error).toBeTruthy()
    const anon = createClient(URL, ANON, opts)
    expect((await anon.from('screen_ratings').insert({ screen: 'mes', rating: 1 })).error).toBeTruthy()
  })

  it('recusa nota fora de 1 a 5 e nome de tela estranho', async () => {
    expect((await a.client.from('screen_ratings').insert({ screen: 'mes', rating: 6 })).error).toBeTruthy()
    expect((await a.client.from('screen_ratings').insert({ screen: 'mes', rating: 0 })).error).toBeTruthy()
    expect((await a.client.from('screen_ratings').insert({ screen: '<script>', rating: 3 })).error).toBeTruthy()
  })

  it('ninguém altera nem apaga uma nota depois de enviada', async () => {
    await a.client.from('screen_ratings').update({ rating: 5 }).eq('screen', 'extrato')
    await a.client.from('screen_ratings').delete().eq('screen', 'extrato')
    const { data } = await admin.from('screen_ratings').select('rating').eq('user_id', a.id)
    expect(data).toEqual([{ rating: 2 }])
  })

  it('só o administrador vê as notas de todo mundo (com nome de quem mandou)', async () => {
    expect((await a.client.rpc('admin_screen_ratings')).error).toBeTruthy()
    await admin.from('profiles').update({ is_admin: true }).eq('id', b.id)
    const { data, error } = await b.client.rpc('admin_screen_ratings')
    await admin.from('profiles').update({ is_admin: false }).eq('id', b.id)
    expect(error).toBeNull()
    const mine = (data as { screen: string; rating: number; sender_name: string; problems: string[] }[]).filter((r) => ['ana', 'bruno'].includes(r.sender_name))
    expect(mine.map((r) => [r.sender_name, r.screen, r.rating]).sort()).toEqual([
      ['ana', 'extrato', 2],
      ['bruno', 'inicio', 5],
    ])
    expect(mine.find((r) => r.sender_name === 'ana')!.problems).toEqual(['Valor ou conta errada'])
  })
})

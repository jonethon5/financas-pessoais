// Porquinho contra o Supabase LOCAL: moedas com valor fixo, sem repetir, e loja que confere o saldo no banco.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE, opts)
const run = Math.random().toString(36).slice(2, 8)
const CODE = `PIG-${run.toUpperCase()}`
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const daysAgo = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

type User = { id: string; client: SupabaseClient }
const created: string[] = []
async function newUser(label: string): Promise<User> {
  const email = `${label}-${run}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'senha-de-teste-123', email_confirm: true, user_metadata: { name: label, beta_code: CODE } })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(URL, ANON, opts)
  await client.auth.signInWithPassword({ email, password: 'senha-de-teste-123' })
  return { id: data.user.id, client }
}

let a: User
let b: User
beforeAll(async () => {
  await admin.from('beta_codes').insert({ code: CODE, max_uses: 5 })
  a = await newUser('porco-a')
  b = await newUser('porco-b')
}, 60_000)

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined)
  await admin.from('beta_codes').delete().eq('code', CODE)
})

describe('porquinho: moedas e loja', () => {
  it('meta do dia vale 1 moeda; ninguém se dá 1.000 moedas', async () => {
    expect((await a.client.from('pig_coins').insert({ day: today, kind: 'lancou', coins: 1 })).error).toBeNull()
    expect((await a.client.from('pig_coins').insert({ day: today, kind: 'guardou', coins: 1000 })).error).toBeTruthy()
  })

  it('a mesma meta no mesmo dia não rende duas vezes', async () => {
    expect((await a.client.from('pig_coins').insert({ day: today, kind: 'lancou', coins: 1 })).error).toBeTruthy()
  })

  it('não vale moeda para o futuro nem para muito tempo atrás', async () => {
    expect((await a.client.from('pig_coins').insert({ day: daysAgo(-1), kind: 'guardou', coins: 1 })).error).toBeTruthy()
    expect((await a.client.from('pig_coins').insert({ day: daysAgo(60), kind: 'guardou', coins: 1 })).error).toBeTruthy()
  })

  it('a loja confere o saldo no banco', async () => {
    // a tem 1 moeda; óculos custa 20
    const fail = await a.client.from('pig_purchases').insert({ item: 'oculos', price: 20 })
    expect(fail.error?.message).toMatch(/Moedas insuficientes/)
    await a.client.from('pig_coins').insert([{ day: daysAgo(1), kind: 'semana', ref: '', coins: 10 }, { day: daysAgo(2), kind: 'marco', ref: 'g:25', coins: 5 }, { day: daysAgo(2), kind: 'marco', ref: 'g:50', coins: 5 }])
    expect((await a.client.from('pig_purchases').insert({ item: 'oculos', price: 20 })).error).toBeNull()
    expect((await a.client.from('pig_purchases').insert({ item: 'oculos', price: 20 })).error).toBeTruthy() // não compra duas vezes
  })

  it('cada um só vê as próprias moedas e compras', async () => {
    expect((await b.client.from('pig_coins').select('id')).data).toEqual([])
    expect((await b.client.from('pig_purchases').select('id')).data).toEqual([])
    expect((await b.client.from('pig_coins').insert({ user_id: a.id, day: today, kind: 'guardou', coins: 1 })).error).toBeTruthy()
  })
})

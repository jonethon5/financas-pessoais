// Utilitários compartilhados pelas Edge Functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Erro com mensagem que pode ser mostrada para a pessoa. */
export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof UserError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Algo deu errado. Tente de novo em instantes.' }, 500)
    }
  }
}

/** Cliente com a chave de serviço. Só existe aqui no servidor, nunca no app. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Usuário logado que chamou a função (pelo token enviado no cabeçalho Authorization). */
export async function callerUserId(req: Request, admin: SupabaseClient): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new UserError('Faça login primeiro.', 401)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new UserError('Sua sessão expirou. Entre de novo.', 401)
  return data.user.id
}

export function normalizeEmail(input: unknown): string {
  return String(input ?? '').trim().toLowerCase()
}

export function assertEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) throw new UserError('Digite um e-mail válido.')
}

export function assertPassword(password: unknown): string {
  const p = String(password ?? '')
  if (p.length < 8) throw new UserError('A senha precisa ter pelo menos 8 caracteres.')
  if (p.length > 72) throw new UserError('Senha muito longa.')
  return p
}

/** Compara segredos sem vazar pelo tempo de resposta. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export function friendlyAuthError(message: string): string {
  if (/already been registered|already exists|duplicate/i.test(message)) return 'Já existe uma conta com esse e-mail.'
  if (/password/i.test(message)) return 'Senha fraca ou inválida. Use pelo menos 8 caracteres.'
  return 'Não foi possível criar a conta. Tente de novo.'
}

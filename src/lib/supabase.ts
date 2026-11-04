import { createClient, FunctionsHttpError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// A anon key é pública por natureza; quem protege os dados é o RLS no banco.
// NUNCA coloque a service_role key no front-end.
export const supabase = createClient(url || 'https://nao-configurado.supabase.co', anonKey || 'nao-configurado', {
  // Os links dos e-mails (confirmar, nova senha) são tratados pelo próprio app (src/lib/authLink.ts)
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/** Chama uma Edge Function e devolve a mensagem de erro dela em português. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Não foi possível falar com o servidor. Tente de novo.')
  }
  return data as T
}

/** Traduz mensagens comuns para português. */
export function friendlyError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String(err.message)
        : String(err)
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar: procure o link que enviamos (veja também o spam).'
  if (/already registered|already been registered|already exists/i.test(msg)) return 'Já existe uma conta com esse e-mail. Tente entrar ou use “Esqueci a senha”.'
  if (/database error saving new user/i.test(msg)) return 'Código de acesso do beta inválido ou esgotado.'
  if (/signups? not allowed|signup.*disabled/i.test(msg)) return 'O cadastro está fechado no momento.'
  if (/email rate limit|over_email_send_rate_limit/i.test(msg)) return 'Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (/password should be at least|at least \d+ characters/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/weak.?password|pwned|known to be weak/i.test(msg)) return 'Essa senha é fácil de adivinhar. Escolha outra.'
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da anterior.'
  if (/invalid format|unable to validate email/i.test(msg)) return 'Digite um e-mail válido.'
  if (/expired|invalid.*(token|otp)|otp_expired/i.test(msg)) return 'Esse link expirou ou já foi usado. Peça um novo.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com a internet. Tente de novo.'
  if (/JWT|session.*(expired|missing)|not authenticated/i.test(msg)) return 'Sua sessão expirou. Entre de novo.'
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return 'A imagem é grande demais.'
  // Mensagens que o próprio app/banco já escrevem em português
  if (/[ãçéêáíóõúâô]/i.test(msg) && msg.length < 200) return msg
  return 'Algo deu errado. Tente de novo em instantes.'
}

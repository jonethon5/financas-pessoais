// Primeira configuração: cria a conta do ADMINISTRADOR do beta (uma vez só).
//   { action: 'bootstrap', code, name, email, password }
// Protegida pelo secret SETUP_CODE (definido no GitHub e copiado pelo workflow do Supabase).
// Depois disso o administrador cria os códigos de acesso dos testadores dentro do app (Você › Beta).
import {
  UserError,
  adminClient,
  assertEmail,
  assertPassword,
  friendlyAuthError,
  handle,
  json,
  normalizeEmail,
  sameSecret,
} from '../_shared/common.ts'

Deno.serve(
  handle(async (req) => {
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'bootstrap') throw new UserError('Ação inválida.')

    const expected = Deno.env.get('SETUP_CODE')
    if (!expected) throw new UserError('O app ainda não foi configurado: falta o secret SETUP_CODE.', 503)
    // Ignora espaços nas pontas e maiúsculas/minúsculas (o teclado do celular e o copiar/colar costumam mexer nisso)
    const norm = (v: string) => v.trim().toLowerCase()
    if (!sameSecret(norm(String(body.code ?? '')), norm(expected))) throw new UserError('Código de configuração incorreto.', 401)

    const admin = adminClient()
    const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true)
    if (countError) throw countError
    if ((count ?? 0) > 0) throw new UserError('O administrador já foi configurado. Entre com seu e-mail e senha.', 409)

    const email = normalizeEmail(body.email)
    assertEmail(email)
    const password = assertPassword(body.password)
    const name = String(body.name ?? '').trim().slice(0, 60)
    if (!name) throw new UserError('Digite seu nome.')

    // O cadastro sempre exige um código do beta (gatilho no banco): criamos um de uso único para o administrador.
    const code = `ADMIN-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
    const { error: codeError } = await admin.from('beta_codes').insert({ code, max_uses: 1, note: 'Conta do administrador' })
    if (codeError) throw codeError

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, beta_code: code },
    })
    if (error || !data.user) {
      await admin.from('beta_codes').delete().eq('code', code)
      throw new UserError(friendlyAuthError(error?.message ?? ''))
    }

    const { error: adminError } = await admin.from('profiles').update({ is_admin: true }).eq('id', data.user.id)
    if (adminError) throw adminError
    return json({ ok: true })
  }),
)

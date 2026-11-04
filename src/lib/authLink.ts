// Links dos e-mails do Supabase (confirmar cadastro, criar nova senha, trocar e-mail, convite).
// O e-mail aponta para  https://.../financas-pessoais/?token_hash=XXX&type=recovery
// Lemos e tiramos esses parâmetros da barra de endereço logo ao abrir o app.

export type AuthLinkType = 'email' | 'signup' | 'recovery' | 'email_change' | 'invite' | 'magiclink'
export type AuthLink = { tokenHash: string; type: AuthLinkType } | { error: string }

const TYPES: AuthLinkType[] = ['email', 'signup', 'recovery', 'email_change', 'invite', 'magiclink']

/** Lê o link (sem mexer na URL). Exportado para teste. */
export function parseAuthLink(href: string): AuthLink | null {
  const url = new URL(href)
  // Parâmetros podem vir antes do # (padrão) ou dentro dele (#/?token_hash=…)
  const params = new URLSearchParams(url.search)
  const hashQuery = url.hash.includes('?') ? new URLSearchParams(url.hash.slice(url.hash.indexOf('?') + 1)) : null
  const get = (k: string) => params.get(k) ?? hashQuery?.get(k) ?? null

  const errorDescription = get('error_description')
  if (errorDescription) return { error: errorDescription }

  const tokenHash = get('token_hash')
  const type = get('type') as AuthLinkType | null
  if (!tokenHash || !type || !TYPES.includes(type)) return null
  return { tokenHash, type }
}

let pending: AuthLink | null = null

/** Chamada uma vez no início (main.tsx): guarda o link e limpa a barra de endereço. */
export function captureAuthLink() {
  pending = parseAuthLink(window.location.href)
  if (!pending) return
  const url = new URL(window.location.href)
  for (const k of ['token_hash', 'type', 'error', 'error_code', 'error_description']) url.searchParams.delete(k)
  window.history.replaceState(null, '', `${url.pathname}${url.search}#/`)
}

/** Entrega o link capturado (uma vez só). */
export function takeAuthLink(): AuthLink | null {
  const link = pending
  pending = null
  return link
}

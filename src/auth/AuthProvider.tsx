import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { friendlyError, isSupabaseConfigured, supabase } from '../lib/supabase'
import { takeAuthLink } from '../lib/authLink'

export type Mode = 'supabase' | 'demo'

/** O que aconteceu ao abrir um link de e-mail (para mostrar o aviso certo). */
export type LinkEvent = { kind: 'confirmed' | 'email_changed' | 'recovery' | 'invite' } | { kind: 'error'; message: string }

export type SignUpInput = { name: string; email: string; password: string; betaCode: string }

type AuthState = {
  mode: Mode
  /** O Supabase está configurado (dá para criar conta de verdade)? */
  configured: boolean
  session: Session | null
  userId: string | null
  email: string | null
  loading: boolean
  /** A pessoa abriu o link de "nova senha" (ou de convite) e precisa definir a senha agora. */
  mustSetPassword: boolean
  linkEvent: LinkEvent | null
  clearLinkEvent: () => void
  signIn: (email: string, password: string) => Promise<void>
  /** Devolve true quando falta confirmar o e-mail. */
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>
  resendConfirmation: (email: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateEmail: (email: string) => Promise<void>
  /** local: só neste aparelho (usado depois de excluir a conta, quando a sessão já não vale no servidor) */
  signOut: (opts?: { local?: boolean }) => Promise<void>
  enterDemo: () => void
  exitDemo: () => void
}

const AuthContext = createContext<AuthState | null>(null)
const DEMO_KEY = 'poupei:modo'

function demoChosen(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === 'demo'
  } catch {
    return false
  }
}

async function clearOfflineCache() {
  // Apaga os dados guardados para uso offline neste aparelho.
  if ('caches' in window) await caches.delete('supabase-api').catch(() => undefined)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [demo, setDemo] = useState(() => !isSupabaseConfigured || demoChosen())
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [mustSetPassword, setMustSetPassword] = useState(false)
  const [linkEvent, setLinkEvent] = useState<LinkEvent | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return
      setSession(s)
      if (event === 'SIGNED_OUT') {
        setMustSetPassword(false)
        queryClient.clear()
      }
    })

    ;(async () => {
      const link = takeAuthLink()
      if (link) {
        // Abriu um link do e-mail: sai da demonstração para usar a conta
        setDemo(false)
        try {
          localStorage.removeItem(DEMO_KEY)
        } catch {
          /* ok */
        }
        if ('error' in link) {
          setLinkEvent({ kind: 'error', message: 'Esse link expirou ou já foi usado. Peça um novo.' })
        } else {
          const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type as EmailOtpType })
          if (error) setLinkEvent({ kind: 'error', message: friendlyError(error) })
          else if (link.type === 'recovery' || link.type === 'invite') {
            setMustSetPassword(true)
            setLinkEvent({ kind: link.type })
          } else if (link.type === 'email_change') setLinkEvent({ kind: 'email_changed' })
          else setLinkEvent({ kind: 'confirmed' })
        }
      }
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })()

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const enterDemo = useCallback(() => {
    try {
      localStorage.setItem(DEMO_KEY, 'demo')
    } catch {
      /* segue só nesta visita */
    }
    queryClient.clear()
    setDemo(true)
  }, [queryClient])

  const exitDemo = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_KEY)
    } catch {
      /* ok */
    }
    queryClient.clear()
    setDemo(false)
  }, [queryClient])

  const value = useMemo<AuthState>(() => {
    const mode: Mode = demo ? 'demo' : 'supabase'
    return {
      mode,
      configured: isSupabaseConfigured,
      session,
      userId: mode === 'demo' ? 'demo' : (session?.user.id ?? null),
      email: mode === 'demo' ? 'voce@exemplo.com' : (session?.user.email ?? null),
      loading: mode === 'supabase' && loading,
      mustSetPassword: mode === 'supabase' && mustSetPassword,
      linkEvent,
      clearLinkEvent: () => setLinkEvent(null),

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) throw error
      },

      async signUp({ name, email, password, betaCode }) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim(), beta_code: betaCode.trim() } },
        })
        if (error) throw error
        // E-mail já cadastrado: o Supabase devolve um usuário sem identidades (para não expor quem tem conta)
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('Já existe uma conta com esse e-mail. Tente entrar ou use “Esqueci a senha”.')
        }
        return { needsConfirmation: !data.session }
      },

      async resendConfirmation(email) {
        const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
        if (error) throw error
      },

      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
        if (error) throw error
      },

      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMustSetPassword(false)
      },

      async updateEmail(email) {
        const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
        if (error) throw error
      },

      async signOut(opts) {
        if (mode === 'demo') {
          exitDemo()
          return
        }
        await supabase.auth.signOut(opts?.local ? { scope: 'local' } : undefined)
        queryClient.clear()
        await clearOfflineCache()
      },

      enterDemo,
      exitDemo,
    }
  }, [demo, session, loading, mustSetPassword, linkEvent, queryClient, enterDemo, exitDemo])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { APP_NAME } from '../../brand'
import { Button, ErrorBox, Field, IconTile, Notice } from '../../components/ui'
import { friendlyError, supabase } from '../../lib/supabase'
import { AuthShell, PasswordField, isEmail, useAppStatus } from './AuthShell'

type Errors = Partial<Record<'name' | 'email' | 'password' | 'code' | 'terms', string>>

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const status = useAppStatus()
  const needsCode = status.data?.beta_code_required ?? true
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Errors = {}
    if (!name.trim()) errs.name = 'Como você se chama?'
    if (!isEmail(email)) errs.email = 'Digite um e-mail válido.'
    if (password.length < 8) errs.password = 'Use pelo menos 8 caracteres.'
    if (needsCode && !code.trim()) errs.code = 'Digite o código que você recebeu.'
    if (!terms) errs.terms = 'Para criar a conta, aceite os termos.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    setError(null)
    try {
      if (needsCode) {
        const { data: valid, error: rpcError } = await supabase.rpc('check_beta_code', { p_code: code })
        if (rpcError) throw rpcError
        if (!valid) {
          setErrors({ code: 'Código inválido ou já esgotado. Confira com quem te convidou.' })
          return
        }
      }
      const { needsConfirmation } = await signUp({ name, email, password, betaCode: code })
      if (needsConfirmation) setSentTo(email.trim().toLowerCase())
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) return <CheckEmail email={sentTo} onBack={() => navigate('/entrar')} />

  return (
    <AuthShell
      title="Criar conta"
      subtitle={`O ${APP_NAME} está em teste fechado (beta). Use o código que você recebeu.`}
      footer={
        <p className="text-muted">
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-primary">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="shadow-soft flex flex-col gap-4 rounded-[1.25rem] bg-surface p-5">
        {error && <ErrorBox message={error} />}
        <Field label="Nome" autoComplete="name" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField label="Senha" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="Pelo menos 8 caracteres. Misture letras e números." />
        {needsCode && (
          <Field
            label="Código de acesso do beta"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ex.: BETA-7KQ2M9XD"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={errors.code}
          />
        )}
        <div>
          <label className="flex items-start gap-3 px-1 text-[0.9375rem] leading-snug">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
            <span>
              Li e aceito os{' '}
              <Link to="/termos" className="font-medium text-primary underline underline-offset-2">
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" className="font-medium text-primary underline underline-offset-2">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {errors.terms && (
            <p role="alert" className="mt-1.5 px-1 text-[0.875rem] font-medium text-danger-strong">
              {errors.terms}
            </p>
          )}
        </div>
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Criar conta
        </Button>
      </form>
    </AuthShell>
  )
}

/** Depois do cadastro: falta confirmar o e-mail. */
function CheckEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const { resendConfirmation } = useAuth()
  const [wait, setWait] = useState(60)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function resend() {
    setError(null)
    try {
      await resendConfirmation(email)
      setMessage('Enviamos de novo. Veja também a caixa de spam.')
      setWait(60)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <AuthShell title="Confirme seu e-mail">
      <div className="shadow-soft flex flex-col items-center gap-4 rounded-[1.25rem] bg-surface p-6 text-center">
        <IconTile size="lg">
          <MailCheck strokeWidth={1.8} />
        </IconTile>
        <p className="text-[1.0625rem] leading-snug">
          Enviamos um link para <strong className="break-all">{email}</strong>. Abra o e-mail e toque em <strong>Confirmar e-mail</strong> para entrar.
        </p>
        {message && <Notice tone="primary">{message}</Notice>}
        {error && <ErrorBox message={error} />}
        <Button variant="secondary" className="w-full" disabled={wait > 0} onClick={resend}>
          {wait > 0 ? `Reenviar e-mail (${wait}s)` : 'Reenviar e-mail'}
        </Button>
        <Button variant="ghost" size="md" onClick={onBack}>
          Voltar para entrar
        </Button>
      </div>
    </AuthShell>
  )
}

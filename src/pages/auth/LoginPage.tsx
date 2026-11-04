import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { APP_TAGLINE } from '../../brand'
import { Button, ErrorBox, Field, Notice } from '../../components/ui'
import { friendlyError } from '../../lib/supabase'
import { AuthShell, PasswordField, isEmail, useAppStatus } from './AuthShell'

export function LoginPage() {
  const { signIn, enterDemo, linkEvent, clearLinkEvent } = useAuth()
  const navigate = useNavigate()
  const status = useAppStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!isEmail(email)) errs.email = 'Digite seu e-mail.'
    if (!password) errs.password = 'Digite sua senha.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setError(null)
    clearLinkEvent()
    try {
      await signIn(email, password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      subtitle={APP_TAGLINE}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="secondary" className="w-full" onClick={() => navigate('/criar-conta')}>
            Criar conta
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={enterDemo}>
            Ver demonstração sem conta
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="shadow-soft flex flex-col gap-4 rounded-[1.25rem] bg-surface p-5">
        {linkEvent?.kind === 'error' && <ErrorBox message={linkEvent.message} />}
        {status.data && !status.data.has_admin && (
          <Notice tone="primary">
            Primeira vez abrindo o app?{' '}
            <Link to="/configurar" className="font-semibold text-primary-strong underline underline-offset-2">
              Configure a conta de administrador
            </Link>
            .
          </Notice>
        )}
        {error && <ErrorBox message={error} />}
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Entrar
        </Button>
        <Link to="/esqueci" className="-mb-1 self-center py-1 text-[0.9375rem] font-medium text-primary">
          Esqueci a senha
        </Link>
      </form>
    </AuthShell>
  )
}

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { Button, ErrorBox, Field, Notice } from '../../components/ui'
import { friendlyError } from '../../lib/supabase'
import { AuthShell, isEmail } from './AuthShell'

export function ForgotPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) {
      setFieldError('Digite o e-mail da sua conta.')
      return
    }
    setFieldError(undefined)
    setError(null)
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Esqueci a senha"
      subtitle="Digite seu e-mail e enviamos um link para criar uma nova senha."
      footer={
        <Link to="/entrar" className="font-semibold text-primary">
          Voltar para entrar
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="shadow-soft flex flex-col gap-4 rounded-[1.25rem] bg-surface p-5">
        {sent ? (
          <Notice tone="primary">
            Se existir uma conta com <strong className="break-all">{email.trim()}</strong>, o link chega em instantes. Veja também a caixa de spam. O link vale por 1 hora.
          </Notice>
        ) : (
          <>
            {error && <ErrorBox message={error} />}
            <Field
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldError}
            />
            <Button type="submit" loading={loading} className="w-full">
              Enviar link
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  )
}

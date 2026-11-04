import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useToast } from '../../components/Toast'
import { Button, ErrorBox } from '../../components/ui'
import { friendlyError } from '../../lib/supabase'
import { AuthShell, PasswordField } from './AuthShell'

/** Aberto pelo link de "nova senha" (ou de convite): a pessoa já está logada e define a senha. */
export function NewPasswordPage() {
  const { updatePassword, signOut, linkEvent, clearLinkEvent, email } = useAuth()
  const toast = useToast()
  const invite = linkEvent?.kind === 'invite'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (password.length < 8) errs.password = 'Use pelo menos 8 caracteres.'
    else if (confirm !== password) errs.confirm = 'As senhas não são iguais.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setError(null)
    try {
      await updatePassword(password)
      clearLinkEvent()
      toast(invite ? 'Senha criada. Bem-vindo!' : 'Senha alterada')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={invite ? 'Crie sua senha' : 'Criar nova senha'}
      subtitle={email ? `Conta: ${email}` : undefined}
      footer={
        <Button variant="ghost" size="md" onClick={() => signOut()}>
          Sair
        </Button>
      }
    >
      <form onSubmit={onSubmit} noValidate className="shadow-soft flex flex-col gap-4 rounded-[1.25rem] bg-surface p-5">
        {error && <ErrorBox message={error} />}
        <PasswordField label="Nova senha" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="Pelo menos 8 caracteres." />
        <PasswordField label="Repita a senha" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Salvar senha
        </Button>
      </form>
    </AuthShell>
  )
}

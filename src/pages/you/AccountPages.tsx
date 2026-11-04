import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { useToast } from '../../components/Toast'
import { BackButton, Button, ErrorBox, Field, List, NavBar, Notice, Row } from '../../components/ui'
import { useBackend } from '../../data/backend'
import { friendlyError } from '../../lib/supabase'
import { PasswordField, isEmail } from '../auth/AuthShell'

export function PasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { updatePassword } = useAuth()
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
      toast('Senha alterada')
      navigate('/voce')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar title="Trocar senha" large={false} left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pt-4">
        {error && <ErrorBox message={error} />}
        <PasswordField label="Nova senha" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="Pelo menos 8 caracteres." />
        <PasswordField label="Repita a nova senha" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <Button type="submit" loading={loading} className="mt-2">
          Salvar nova senha
        </Button>
      </form>
    </>
  )
}

export function EmailPage() {
  const navigate = useNavigate()
  const { email, updateEmail } = useAuth()
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(value)) return setFieldError('Digite um e-mail válido.')
    if (value.trim().toLowerCase() === email) return setFieldError('Esse já é o seu e-mail.')
    setFieldError(undefined)
    setError(null)
    setLoading(true)
    try {
      await updateEmail(value)
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar title="E-mail" large={false} left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
      <div className="flex flex-col gap-5 pt-4">
        <List>
          <Row title="E-mail atual" trailing={<span className="max-w-[55vw] truncate text-muted">{email}</span>} />
        </List>
        {sent ? (
          <Notice tone="primary">
            Enviamos um link de confirmação para <strong className="break-all">{value.trim()}</strong>. A troca só acontece depois que você tocar nele. Seu e-mail atual também recebe um aviso.
          </Notice>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {error && <ErrorBox message={error} />}
            <Field label="Novo e-mail" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} error={fieldError} />
            <Button type="submit" loading={loading}>
              Trocar e-mail
            </Button>
          </form>
        )}
      </div>
    </>
  )
}

/** Exclusão definitiva da conta (LGPD e Play Store). No modo demonstração, apaga os dados de exemplo. */
export function DeleteAccountPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const backend = useBackend()
  const { mode, signOut } = useAuth()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const demo = mode === 'demo'
  const ready = demo || typed.trim().toUpperCase() === 'EXCLUIR'

  async function onDelete() {
    setLoading(true)
    setError(null)
    try {
      await backend.deleteAccount()
      if (demo) {
        toast('Dados da demonstração apagados')
        window.location.reload()
        return
      }
      await signOut({ local: true })
      toast('Sua conta foi excluída')
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar title={demo ? 'Apagar demonstração' : 'Excluir conta'} large={false} left={<BackButton label="Você" onClick={() => navigate('/voce')} />} />
      <div className="flex flex-col gap-5 pt-4">
        {demo ? (
          <Notice>Os dados de exemplo deste aparelho voltam ao começo. Nada é enviado para lugar nenhum.</Notice>
        ) : (
          <>
            <div className="shadow-soft rounded-[1.25rem] bg-surface p-5">
              <h2 className="text-[1.25rem] font-bold">Isso não tem volta</h2>
              <p className="mt-2 leading-snug text-muted">Ao excluir a conta, apagamos na hora e para sempre:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 leading-snug">
                <li>seu login e seu perfil (nome, foto, salário e preferências);</li>
                <li>todos os gastos, rendas, orçamentos e caixinhas;</li>
                <li>as sugestões e imagens que você enviou.</li>
              </ul>
              <p className="mt-3 text-[0.9375rem] leading-snug text-muted">O dinheiro que está no seu banco não é afetado: o app só registra, não movimenta dinheiro.</p>
            </div>
            <Field label="Para confirmar, digite EXCLUIR" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
          </>
        )}
        {error && <ErrorBox message={error} />}
        <Button variant="danger-fill" disabled={!ready} loading={loading} onClick={onDelete}>
          {demo ? 'Apagar dados de exemplo' : 'Excluir minha conta'}
        </Button>
      </div>
    </>
  )
}

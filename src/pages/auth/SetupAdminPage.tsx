import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { Button, ErrorBox, Field } from '../../components/ui'
import { callFunction, friendlyError } from '../../lib/supabase'
import { AuthShell, PasswordField, isEmail } from './AuthShell'

type Errors = Partial<Record<'code' | 'name' | 'email' | 'password', string>>

/** Primeiro acesso: cria a conta do administrador do beta (só funciona uma vez, com o SETUP_CODE). */
export function SetupAdminPage() {
  const { signIn } = useAuth()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Errors = {}
    if (!code.trim()) errs.code = 'Digite o código de configuração (o secret SETUP_CODE).'
    if (!name.trim()) errs.name = 'Digite seu nome.'
    if (!isEmail(email)) errs.email = 'Digite um e-mail válido.'
    if (password.length < 8) errs.password = 'Use pelo menos 8 caracteres.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setError(null)
    try {
      await callFunction('setup', { action: 'bootstrap', code: code.trim(), name: name.trim(), email: email.trim(), password })
      await qc.invalidateQueries({ queryKey: ['app_status'] })
      await signIn(email, password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Configurar o app"
      subtitle="Crie a conta de administrador. Depois você gera os códigos de acesso dos testadores em Você › Painel do beta."
      footer={
        <Link to="/entrar" className="font-semibold text-primary">
          Voltar para entrar
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="shadow-soft flex flex-col gap-4 rounded-[1.25rem] bg-surface p-5">
        {error && <ErrorBox message={error} />}
        <Field label="Código de configuração" autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} hint="É o secret SETUP_CODE que você cadastrou no GitHub." />
        <Field label="Seu nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField label="Senha" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="Pelo menos 8 caracteres." />
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Criar administrador
        </Button>
      </form>
    </AuthShell>
  )
}

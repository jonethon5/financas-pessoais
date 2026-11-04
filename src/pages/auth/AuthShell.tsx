import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { APP_NAME } from '../../brand'
import { BetaBadge, Field } from '../../components/ui'
import { supabase } from '../../lib/supabase'

/** Estado público do app: já tem administrador? O cadastro pede código do beta? */
export function useAppStatus() {
  return useQuery({
    queryKey: ['app_status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('app_status')
      if (error) throw error
      return data as { has_admin: boolean; beta_code_required: boolean }
    },
    staleTime: 60_000,
  })
}

export function AuthShell({ title, subtitle, children, footer }: { title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4">
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="mb-7 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="shadow-soft mx-auto mb-4 size-[4.25rem] rounded-[1.05rem]" />
          <p className="text-[1.0625rem] font-semibold">
            {APP_NAME} <BetaBadge />
          </p>
          {title && <h1 className="mt-3 text-[1.75rem] leading-tight font-bold tracking-tight text-balance">{title}</h1>}
          {subtitle && <p className="mx-auto mt-2 max-w-sm text-[1.0625rem] text-muted text-balance">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center">{footer}</div>}
      </div>
      <p className="pb-5 text-center text-[0.8125rem] text-muted">
        <Link to="/termos" className="underline-offset-2 active:underline">
          Termos de uso
        </Link>
        {' · '}
        <Link to="/privacidade" className="underline-offset-2 active:underline">
          Privacidade
        </Link>
      </p>
    </div>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  autoComplete: string
  hint?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field
      label={label}
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="grid size-11 place-items-center rounded-xl text-muted active:bg-surface-2"
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  )
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

import { Link } from 'react-router'
import { Check, ChevronRight } from 'lucide-react'
import { ProfileAvatar, displayName } from '../components/Avatar'
import { Button, Card, ErrorBox, List, NavBar, Row, Spinner } from '../components/ui'
import { useProfile } from '../data/hooks'
import { formatDayLong, greeting, todayISO } from '../lib/dates'
import { friendlyError } from '../lib/supabase'

/** Tela inicial. Na etapa da Base ganha o "quanto posso gastar hoje" e o resumo do mês. */
export function HomePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.isError) return <ErrorBox message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />
  const p = profile.data
  const name = displayName(p)
  const today = formatDayLong(todayISO())

  const steps = [
    { done: Boolean(p.name), label: 'Seu nome e foto', to: '/voce/perfil' },
    { done: p.payday != null, label: 'Dia do pagamento', to: '/voce' },
    { done: p.salary_cents != null, label: 'Salário', to: '/voce' },
  ]

  return (
    <>
      <NavBar
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
        right={
          <Link to="/voce" aria-label="Você">
            <ProfileAvatar profile={p} size="sm" />
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <Card>
          <p className="text-[0.9375rem] font-medium text-muted">Bem-vindo ao beta</p>
          <p className="mt-1 text-[1.25rem] leading-snug font-semibold">Seu dinheiro com plano, sem planilha.</p>
          <p className="mt-2 leading-snug text-muted">Você está entre as primeiras pessoas a testar. Se algo parecer estranho ou faltar, conte para a gente.</p>
          <Link to="/voce/sugestao" className="mt-4 block">
            <Button variant="soft" size="md" className="w-full">
              Enviar sugestão
            </Button>
          </Link>
        </Card>

        <List header="Primeiros passos" footer="Com o salário e o dia do pagamento, o app calcula quanto você pode gastar por dia.">
          {steps.map((s) => (
            <Row
              key={s.label}
              title={s.label}
              as={(content, className) => (
                <Link to={s.to} className={className}>
                  {content}
                </Link>
              )}
              trailing={
                s.done ? (
                  <span className="grid size-6 place-items-center rounded-full bg-grow text-white" aria-label="Feito">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                ) : (
                  <ChevronRight className="size-5 text-faint" aria-hidden />
                )
              }
            />
          ))}
        </List>
      </div>
    </>
  )
}

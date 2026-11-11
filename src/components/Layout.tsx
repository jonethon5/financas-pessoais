import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Plus, WifiOff } from 'lucide-react'
import { CalendarDots, House, PiggyBank, UserCircle, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { useBankAutoSync, useRealtime } from '../data/finance'
import { useToast } from './Toast'
import { AddSheet } from './AddSheet'

type Tab = { to: string; label: string; icon: PhosphorIcon }

const TABS: Tab[] = [
  { to: '/', label: 'Início', icon: House },
  { to: '/mes', label: 'Mês', icon: CalendarDots },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { to: '/voce', label: 'Você', icon: UserCircle },
]

/** Telas de formulário ocupam a tela toda, sem a barra de abas (como as telas de "Novo" do iPhone). */
const FULL_SCREEN = [/^\/voce\/(perfil|senha|email|excluir|sugestao)$/, /^\/lancar/, /^\/lancamento\//, /^\/separar/, /^\/caixinhas\/(nova|.+\/editar)$/, /^\/(termos|privacidade)$/]

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function TabItem({ to, label, icon: Icon }: Tab) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex h-[3.25rem] flex-col items-center justify-center gap-[3px] text-[0.625rem] font-medium tracking-wide transition active:opacity-60 ${
          isActive ? 'text-primary' : 'text-faint'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={26} weight={isActive ? 'fill' : 'regular'} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  )
}

/**
 * Estrutura de app de celular (também no computador: uma coluna com largura de celular).
 * Barra de abas translúcida embaixo com o "+" no meio, que abre o menu de lançar.
 */
export function Layout() {
  const { mode, configured, exitDemo } = useAuth()
  const online = useOnline()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  useRealtime()
  const toast = useToast()
  useBankAutoSync((n) => toast(`${n} ${n === 1 ? 'lançamento novo' : 'lançamentos novos'} do banco`))
  const fullScreen = FULL_SCREEN.some((re) => re.test(pathname))

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[30rem] bg-bg">
      {mode === 'demo' && (
        <p className="pt-safe px-4 pt-1.5 text-center text-[0.75rem] font-medium text-muted">
          Demonstração · dados de exemplo só neste aparelho
          {configured && (
            <>
              {' · '}
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  exitDemo()
                  navigate('/criar-conta')
                }}
              >
                Criar conta
              </button>
            </>
          )}
        </p>
      )}
      {!online && (
        <div role="status" className="pt-safe flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-[0.8125rem] font-medium text-on-ink">
          <WifiOff className="size-4" aria-hidden /> Sem internet · mostrando os últimos dados
        </div>
      )}

      <main className={`px-4 ${fullScreen ? 'pb-10' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]'}`}>
        <div key={pathname} className="animate-page">
          <Outlet />
        </div>
      </main>

      {!fullScreen && (
        <nav
          aria-label="Principal"
          className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-line bg-bg/90 backdrop-blur-xl backdrop-saturate-150"
        >
          <ul className="grid grid-cols-5 items-center px-1">
            <li>
              <TabItem {...TABS[0]} />
            </li>
            <li>
              <TabItem {...TABS[1]} />
            </li>
            <li className="flex justify-center">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Lançar"
                className="-mt-6 grid size-[3.5rem] place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_-6px_rgb(47_111_235/0.55)] transition active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.4} aria-hidden />
              </button>
            </li>
            <li>
              <TabItem {...TABS[2]} />
            </li>
            <li>
              <TabItem {...TABS[3]} />
            </li>
          </ul>
        </nav>
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

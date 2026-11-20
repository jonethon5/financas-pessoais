import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Plus, WifiOff } from 'lucide-react'
import { type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { useBankAutoSync, useRealtime } from '../data/finance'
import { useToast } from './Toast'
import { RadialAdd } from './RadialAdd'
import { MenuContext } from './MenuContext'
import { MenuSheet } from './MenuSheet'
import { RateScreen } from './RateScreen'
import { screenOf } from '../lib/ratings'
import { useDesktop } from '../lib/useDesktop'
import { DesktopSidebar, MAIN_TABS } from './DesktopSidebar'

type Tab = { to: string; label: string; icon: PhosphorIcon }

// As 4 coisas que a pessoa olha todo dia: hoje, o extrato (como no banco), o mês e o que guardou
const TABS: Tab[] = MAIN_TABS


/** Telas de formulário ocupam a tela toda, sem a barra de abas (como as telas de "Novo" do iPhone). */
const FULL_SCREEN = [/^\/voce\/(perfil|senha|email|excluir|sugestao)$/, /^\/lancar/, /^\/lancamento\//, /^\/separar/, /^\/caixinhas\/(nova|.+\/editar)$/, /^\/(termos|privacidade)$/, /^\/assistente$/]

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
        `relative z-10 flex h-[3.25rem] flex-col items-center justify-center gap-[3px] text-[0.75rem] font-semibold transition-colors duration-200 active:opacity-60 ${
          isActive ? 'text-ink' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  )
}

/**
 * Celular: uma coluna, com a barra de abas translúcida embaixo e o "+" no meio, que abre o menu de lançar.
 * Computador: menu lateral azul (perfil, Lançar, abas e o resto do app), como o internet banking, e a tela ao lado.
 */
export function Layout() {
  const { mode, configured, exitDemo } = useAuth()
  const desktop = useDesktop()
  const addAnchor = useRef<HTMLButtonElement>(null)
  const online = useOnline()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const closeAdd = useCallback(() => setAddOpen(false), [])
  // Trocou de tela (inclusive pelo voltar do celular): fecha o menu e o "+"
  useEffect(() => {
    setMenuOpen(false)
    setAddOpen(false)
  }, [pathname])
  const [menuOpen, setMenuOpen] = useState(false)
  useRealtime()
  const toast = useToast()
  useBankAutoSync((n) => toast(`${n} ${n === 1 ? 'lançamento novo' : 'lançamentos novos'} do banco`))
  const fullScreen = FULL_SCREEN.some((re) => re.test(pathname))
  // O Início do computador ocupa a área toda (coluna principal + painel cinza à direita, de cima a baixo)
  const home = desktop && pathname === '/'
  // "Avalie esta tela" no fim de cada tela (formulários e painel do beta ficam de fora)
  const screen = fullScreen ? null : screenOf(pathname)
  // Vidro sob a aba ativa: posição na grade de 5 (o "+" fica no meio)
  const activeTab = TABS.findIndex((t) => (t.to === '/' ? pathname === '/' : pathname === t.to || pathname.startsWith(`${t.to}/`)))
  const slot = activeTab < 0 ? -1 : [0, 1, 3, 4][activeTab]

  return (
    // No computador o menu já está sempre à vista (na lateral): sem botão ☰
    <MenuContext.Provider value={fullScreen || desktop ? null : () => setMenuOpen(true)}>
    {desktop && <DesktopSidebar ref={addAnchor} onAdd={() => setAddOpen((v) => !v)} addOpen={addOpen} />}
    <div className="mx-auto min-h-dvh w-full max-w-[30rem] bg-bg lg:max-w-none lg:pl-60">
      {mode === 'demo' && (
        <p className="pt-safe px-4 pt-1.5 text-center text-[0.8125rem] font-medium text-muted">
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

      <main className={home ? '' : `px-4 lg:px-12 lg:pt-4 ${fullScreen ? 'pb-10' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12'}`}>
        {/* Computador: as telas usam a largura (sem coluna estreita com branco dos lados); formulários um pouco mais estreitos */}
        <div key={pathname} className={`animate-page ${home ? '' : `lg:mx-auto ${fullScreen ? 'lg:max-w-[52rem]' : 'lg:max-w-[76rem] 2xl:max-w-[88rem]'}`}`}>
          <Outlet />
          {screen && !home && <RateScreen screen={screen} search={search} />}
        </div>
      </main>

      {!fullScreen && !desktop && (
        <nav
          aria-label="Principal"
          className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] print:hidden"
        >
          {/* Barra flutuante de vidro (como a do WhatsApp) */}
          <div className="tab-bar-glass pointer-events-auto rounded-[1.75rem]">
          <ul className="relative grid grid-cols-5 items-center px-1 py-1">
            <span
              aria-hidden
              className={`tab-glass absolute top-1 left-[0.375rem] h-[3.25rem] transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(.32,.72,0,1)] ${slot < 0 ? 'opacity-0' : 'opacity-100'}`}
              style={{ width: 'calc((100% - 0.5rem) / 5 - 0.25rem)', transform: `translateX(calc(${Math.max(0, slot)} * (100% + 0.25rem)))` }}
            />
            <li>
              <TabItem {...TABS[0]} />
            </li>
            <li>
              <TabItem {...TABS[1]} />
            </li>
            <li className="flex justify-center">
              <button
                type="button"
                data-tour="mais"
                onClick={() => setAddOpen(true)}
                aria-label="Lançar"
                className="grid size-12 place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_-6px_rgb(47_111_235/0.55)] transition active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.4} aria-hidden />
              </button>
            </li>
            <li data-tour="aba-mes">
              <TabItem {...TABS[2]} />
            </li>
            <li>
              <TabItem {...TABS[3]} />
            </li>
          </ul>
          </div>
        </nav>
      )}

      <RadialAdd open={addOpen} onClose={closeAdd} anchor={desktop ? addAnchor : null} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
    </MenuContext.Provider>
  )
}

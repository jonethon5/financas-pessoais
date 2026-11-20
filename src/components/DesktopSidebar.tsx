import { forwardRef } from 'react'
import { Link, useLocation } from 'react-router'
import { Plus } from 'lucide-react'
import { CalendarDots, Eye, EyeSlash, House, PiggyBank, Question, Receipt, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { useProfile } from '../data/hooks'
import { toggleHidden, useHiddenValues } from '../lib/privacy'
import { ProfileAvatar, displayName } from './Avatar'
import { MENU_GROUPS } from './MenuSheet'

type Tab = { to: string; label: string; icon: PhosphorIcon }

/** As 4 abas do app (as mesmas da barra de baixo do celular). */
export const MAIN_TABS: Tab[] = [
  { to: '/', label: 'Início', icon: House },
  { to: '/extrato', label: 'Extrato', icon: Receipt },
  { to: '/mes', label: 'Mês', icon: CalendarDots },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
]

/** O resto do app (o que no celular fica no menu ☰), menos o perfil, que fica no topo do menu. */
const MORE = MENU_GROUPS.flatMap((g) => g.items).filter((it) => it.to && it.to !== '/voce')

function useIsActive() {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  return (to: string, prefix: boolean) => {
    const [path, query] = to.split('?')
    const want = new URLSearchParams(query ?? '')
    if ([...want].some(([k, v]) => params.get(k) !== v)) return false
    // "Mês" não fica marcado quando a aba aberta é a dos gráficos (ela tem o próprio item)
    if (!query && path === '/mes' && params.get('aba') === 'graficos') return false
    if (path === '/') return pathname === '/'
    return pathname === path || (prefix && pathname.startsWith(`${path}/`))
  }
}

const row = (active: boolean) =>
  `relative flex items-center gap-3 px-6 text-white transition-colors duration-150 outline-none focus-visible:bg-white/15 ${
    active ? 'bg-[#1B4DBF] font-bold before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-white' : 'hover:bg-white/10'
  }`

/**
 * Menu do computador, no azul da marca (como o internet banking): foto e nome no topo, o botão Lançar,
 * as abas, o resto do app e, embaixo, o logo com esconder valores e ajuda.
 */
export const DesktopSidebar = forwardRef<HTMLButtonElement, { onAdd: () => void; addOpen: boolean }>(function DesktopSidebar({ onAdd, addOpen }, addRef) {
  const isActive = useIsActive()
  const profile = useProfile()
  const hidden = useHiddenValues()
  const p = profile.data
  const youActive = isActive('/voce', true)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-gradient-to-b from-[#2F6FEB] to-[#2159D4] text-white print:hidden">
      <Link to="/voce" aria-current={youActive ? 'page' : undefined} className={`flex items-center gap-3 px-6 pt-7 pb-6 outline-none focus-visible:bg-white/15 ${youActive ? 'bg-[#1B4DBF]' : 'hover:bg-white/10'}`}>
        <span className="rounded-full ring-2 ring-white/40">
          <ProfileAvatar profile={p} size="md" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[1rem] font-bold">{displayName(p) || 'Você'}</span>
          <span className="block text-[0.8125rem] text-white">Perfil e ajustes</span>
        </span>
      </Link>

      <div className="px-6 pb-5">
        <button
          ref={addRef}
          type="button"
          data-tour="mais"
          onClick={onAdd}
          aria-haspopup="menu"
          aria-expanded={addOpen}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[0.9375rem] font-bold text-[#1D5FD6] shadow-[0_8px_18px_-10px_rgb(8_25_70/0.7)] transition hover:bg-[#EEF4FF] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Plus className="size-5" strokeWidth={2.8} aria-hidden /> Lançar
        </button>
      </div>

      <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 [scrollbar-width:thin]">
        <ul>
          {MAIN_TABS.map((t) => {
            const active = isActive(t.to, true)
            return (
              <li key={t.to}>
                <Link to={t.to} aria-current={active ? 'page' : undefined} className={`${row(active)} h-11 text-[0.9375rem] font-semibold`}>
                  <t.icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <div aria-hidden className="mx-6 my-3 h-px bg-white/20" />
        <ul data-tour="menu">
          {MORE.map((it) => {
            const active = isActive(it.to!, false)
            return (
              <li key={it.label}>
                <Link to={it.to!} aria-current={active ? 'page' : undefined} className={`${row(active)} h-10 text-[0.875rem] font-medium`}>
                  <it.icon size={19} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {it.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-white/15 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 rounded-[0.6rem] outline-none focus-visible:outline-2 focus-visible:outline-white">
          <svg viewBox="0 0 512 512" className="size-8" aria-hidden>
            <rect width="512" height="512" rx="116" fill="#fff" />
            <path d="M196 382V146h78a72 72 0 0 1 0 144h-78" fill="none" stroke="#2F6FEB" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="338" cy="370" r="26" fill="#FF6B4A" />
          </svg>
          <span className="text-[1.125rem] font-extrabold tracking-[-0.02em]">{APP_NAME}</span>
        </Link>
        <span className="flex">
          <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
            {hidden ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
          <Link to="/ajuda" aria-label="Ajuda" className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
            <Question size={20} />
          </Link>
        </span>
      </div>
    </aside>
  )
})

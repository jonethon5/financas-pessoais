import { forwardRef } from 'react'
import { Link, useLocation } from 'react-router'
import { Plus } from 'lucide-react'
import { CalendarDots, House, PiggyBank, Receipt, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { useProfile } from '../data/hooks'
import { ProfileAvatar, displayName } from './Avatar'
import { MENU_GROUPS } from './MenuSheet'

type Tab = { to: string; label: string; icon: PhosphorIcon }

export const MAIN_TABS: Tab[] = [
  { to: '/', label: 'Início', icon: House },
  { to: '/extrato', label: 'Extrato', icon: Receipt },
  { to: '/mes', label: 'Mês', icon: CalendarDots },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
]

/** O link está aberto agora? Abas: a tela e as de dentro. Itens do menu: a tela exata (e a aba, se tiver). */
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

/**
 * Menu do computador: fica sempre à esquerda, com tudo do app num lugar só
 * (as 4 abas do celular, o botão de lançar e o que no celular fica no menu ☰).
 */
export const Sidebar = forwardRef<HTMLButtonElement, { onAdd: () => void; addOpen: boolean }>(function Sidebar({ onAdd, addOpen }, addRef) {
  const isActive = useIsActive()
  const profile = useProfile()
  const p = profile.data
  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-[0.75rem] px-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? 'bg-primary-soft text-primary-strong' : 'text-ink hover:bg-surface-2'
    }`

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-line bg-surface print:hidden">
      <Link to="/" className="flex items-center gap-2.5 px-6 pt-6 pb-5 outline-none focus-visible:underline">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-8 rounded-[0.6rem]" />
        <span className="text-[1.25rem] font-extrabold tracking-[-0.02em]">{APP_NAME}</span>
      </Link>

      <div className="px-4">
        <button
          ref={addRef}
          type="button"
          data-tour="mais"
          onClick={onAdd}
          aria-haspopup="menu"
          aria-expanded={addOpen}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgb(47_111_235/0.6)] transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-5" strokeWidth={2.6} aria-hidden /> Lançar
        </button>
      </div>

      <nav aria-label="Principal" className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-0.5">
          {MAIN_TABS.map((t) => {
            const active = isActive(t.to, true)
            return (
              <li key={t.to}>
                <Link to={t.to} aria-current={active ? 'page' : undefined} className={`${item(active)} h-11 text-[0.9375rem] font-semibold`}>
                  <t.icon size={22} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div data-tour="menu" className="mt-2 flex flex-col">
          {MENU_GROUPS.map((g) => {
            const items = g.items.filter((it) => it.to && it.to !== '/voce')
            if (!items.length) return null
            return (
              <section key={g.title} className="mt-5">
                <h2 className="mb-1 px-3 text-[0.75rem] font-semibold tracking-wide text-muted uppercase">{g.title}</h2>
                <ul className="flex flex-col gap-0.5">
                  {items.map((it) => {
                    const active = isActive(it.to!, false)
                    return (
                      <li key={it.label}>
                        <Link to={it.to!} aria-current={active ? 'page' : undefined} className={`${item(active)} h-10 text-[0.9375rem] font-medium`}>
                          <it.icon size={20} weight={active ? 'fill' : 'regular'} className={active ? '' : 'text-muted'} aria-hidden />
                          {it.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </nav>

      <Link
        to="/voce"
        aria-current={isActive('/voce', false) ? 'page' : undefined}
        className={`m-3 mt-0 ${item(isActive('/voce', false))} gap-3 py-2.5`}
      >
        <ProfileAvatar profile={p} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold">{displayName(p) || 'Você'}</span>
          <span className="block text-[0.8125rem] text-muted">Perfil e ajustes</span>
        </span>
      </Link>
    </aside>
  )
})

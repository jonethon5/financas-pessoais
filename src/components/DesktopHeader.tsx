import { forwardRef, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ChevronDown, Plus } from 'lucide-react'
import { CalendarDots, Eye, EyeSlash, House, PiggyBank, Question, Receipt, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { APP_NAME } from '../brand'
import { useProfile } from '../data/hooks'
import { toggleHidden, useHiddenValues } from '../lib/privacy'
import { ProfileAvatar } from './Avatar'
import { MENU_GROUPS } from './MenuSheet'

type Tab = { to: string; label: string; icon: PhosphorIcon }

/** As 4 abas do app (as mesmas da barra de baixo do celular). */
export const MAIN_TABS: Tab[] = [
  { to: '/', label: 'Início', icon: House },
  { to: '/extrato', label: 'Extrato', icon: Receipt },
  { to: '/mes', label: 'Mês', icon: CalendarDots },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
]

function tabActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

/** Botão redondo do topo azul (olho, ajuda). */
const roundBtn = 'grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/** "Mais": o resto do app (o que no celular fica no menu ☰), aberto como um painel abaixo do botão. */
function MoreMenu() {
  const [open, setOpen] = useState(false)
  const { pathname, search } = useLocation()
  const box = useRef<HTMLDivElement>(null)
  const here = `${pathname}${search}`
  const active = MENU_GROUPS.some((g) => g.items.some((it) => it.to && (it.to.includes('?') ? here === it.to : pathname === it.to)))

  useEffect(() => setOpen(false), [pathname, search])
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', out)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="relative" data-tour="menu">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          active || open ? 'bg-white/20' : 'hover:bg-white/15'
        }`}
      >
        Mais <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2.6} aria-hidden />
      </button>
      {open && (
        <div className="animate-pop absolute top-[calc(100%+0.75rem)] left-0 z-40 grid w-[44rem] grid-cols-3 gap-6 rounded-[1.25rem] bg-bg p-6 text-ink shadow-[0_24px_60px_-20px_rgb(15_36_51/0.45)]">
          {MENU_GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="mb-2 px-2 text-[0.75rem] font-semibold tracking-wide text-muted uppercase">{g.title}</h2>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) =>
                  it.to ? (
                    <li key={it.label}>
                      <Link to={it.to} className="flex items-center gap-3 rounded-[0.75rem] px-2 py-2 text-[0.9375rem] font-semibold transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none">
                        <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-primary-soft text-primary-strong">
                          <it.icon size={20} weight="duotone" aria-hidden />
                        </span>
                        {it.label}
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Topo do computador (como o internet banking): logo, as abas, "Mais", e à direita
 * esconder valores, ajuda, o botão Lançar e a foto (perfil e ajustes).
 */
export const DesktopHeader = forwardRef<HTMLButtonElement, { onAdd: () => void; addOpen: boolean }>(function DesktopHeader({ onAdd, addOpen }, addRef) {
  const { pathname } = useLocation()
  const hidden = useHiddenValues()
  const profile = useProfile()

  return (
    <header className="desk-top sticky top-0 z-30 print:hidden">
      <div className="mx-auto flex h-[4.5rem] max-w-[76rem] items-center gap-8 px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-[0.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <svg viewBox="0 0 512 512" className="size-9" aria-hidden>
            <rect width="512" height="512" rx="116" fill="#fff" />
            <path d="M196 382V146h78a72 72 0 0 1 0 144h-78" fill="none" stroke="#2F6FEB" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="338" cy="370" r="26" fill="#FF6B4A" />
          </svg>
          <span className="text-[1.375rem] font-extrabold tracking-[-0.02em]">{APP_NAME}</span>
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-1">
          {MAIN_TABS.map((t) => {
            const active = tabActive(pathname, t.to)
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? 'bg-white text-[#1D5FD6]' : 'hover:bg-white/15'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
          <MoreMenu />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className={roundBtn}>
            {hidden ? <EyeSlash size={22} /> : <Eye size={22} />}
          </button>
          <Link to="/ajuda" aria-label="Ajuda" className={roundBtn}>
            <Question size={22} />
          </Link>
          <button
            ref={addRef}
            type="button"
            data-tour="mais"
            onClick={onAdd}
            aria-haspopup="menu"
            aria-expanded={addOpen}
            className="ml-2 flex h-10 items-center gap-1.5 rounded-full bg-white pr-5 pl-4 text-[0.9375rem] font-bold text-[#1D5FD6] shadow-[0_6px_16px_-8px_rgb(10_30_80/0.6)] transition hover:bg-[#EEF4FF] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Plus className="size-5" strokeWidth={2.8} aria-hidden /> Lançar
          </button>
          <Link to="/voce" aria-label="Perfil e ajustes" className="ml-2 rounded-full ring-2 ring-white/30 transition hover:ring-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <ProfileAvatar profile={profile.data} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  )
})

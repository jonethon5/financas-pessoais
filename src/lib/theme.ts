import { useSyncExternalStore } from 'react'

// Tema claro ou escuro (escolha guardada neste aparelho). O padrão é claro.
export type ThemePref = 'claro' | 'escuro' | 'sistema'

const KEY = 'poupei:tema'
const dark = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'escuro' || v === 'sistema') return v
  } catch {
    /* sem armazenamento */
  }
  return 'claro'
}

export function applyTheme(pref = getThemePref()) {
  const isDark = pref === 'escuro' || (pref === 'sistema' && dark.matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#000000' : '#FFFFFF')
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* segue só nesta visita */
  }
  applyTheme(pref)
}

// "Igual ao celular": acompanha quando o sistema troca de tema
dark.addEventListener('change', () => applyTheme())

/** Está no modo escuro agora? (acompanha a troca de tema) */
const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === 'dark')
}

/** No escuro, clareia cores muito escuras (ex.: azul-marinho) para continuarem visíveis. */
export function liftForDark(hex: string, isDark: boolean): string {
  if (!isDark || !/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  const mix = lum < 0.2 ? 0.55 : lum < 0.4 ? 0.3 : lum < 0.55 ? 0.12 : 0
  return `#${rgb.map((v) => Math.round(v + (255 - v) * mix).toString(16).padStart(2, '0')).join('')}`
}

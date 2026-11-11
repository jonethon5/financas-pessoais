// Esconder os valores (o "olho" do topo), como nos apps de banco. Fica salvo neste aparelho.
import { useSyncExternalStore } from 'react'

const KEY = 'poupei:ocultar-valores'
const listeners = new Set<() => void>()
let hidden = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

export function toggleHidden() {
  hidden = !hidden
  try {
    localStorage.setItem(KEY, hidden ? '1' : '0')
  } catch {
    /* segue só nesta visita */
  }
  listeners.forEach((l) => l())
}

export function useHiddenValues(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => hidden,
  )
}

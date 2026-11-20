// Avisos no celular (Web Push): ligar e desligar neste aparelho. Quem manda é a função notify, no servidor.
import { useCallback, useEffect, useState } from 'react'
import { callFunction } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export type PushState =
  | 'carregando'
  /** Este navegador não recebe avisos */
  | 'indisponivel'
  /** iPhone: só recebe com o app adicionado à tela de início */
  | 'iphone-instalar'
  /** A pessoa bloqueou os avisos no navegador */
  | 'negado'
  /** Falta a chave pública no site (o servidor ainda não foi configurado) */
  | 'sem-chave'
  | 'desligado'
  | 'ligado'

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isIphoneBrowser(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return ios && !installed
}

/** A chave pública vem em base64url; o navegador quer os bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null
  // O service worker é registrado pelo vite-plugin-pwa; em desenvolvimento pode não existir
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
  return reg
}

async function readState(): Promise<PushState> {
  if (!supported()) return isIphoneBrowserSafe() ? 'iphone-instalar' : 'indisponivel'
  if (isIphoneBrowser()) return 'iphone-instalar'
  if (!VAPID) return 'sem-chave'
  if (Notification.permission === 'denied') return 'negado'
  const reg = await registration()
  if (!reg) return 'indisponivel'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

function isIphoneBrowserSafe(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/** Pede permissão, inscreve o aparelho e manda a inscrição para o servidor. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Os avisos foram bloqueados no navegador.' : 'Os avisos não foram liberados.')
  const reg = await registration()
  if (!reg) throw new Error('Este navegador não recebe avisos. Abra o app instalado ou pelo Chrome.')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) })
  await callFunction('notify', { action: 'subscribe', subscription: sub.toJSON(), userAgent: navigator.userAgent })
}

export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await callFunction('notify', { action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => undefined)
  await sub.unsubscribe()
}

export async function testPush(): Promise<void> {
  await callFunction('notify', { action: 'test' })
}

/** Estado dos avisos neste aparelho (e um jeito de reler depois de ligar/desligar). */
export function usePushState(): [PushState, () => void] {
  const [state, setState] = useState<PushState>('carregando')
  const refresh = useCallback(() => {
    readState()
      .then(setState)
      .catch(() => setState('indisponivel'))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return [state, refresh]
}

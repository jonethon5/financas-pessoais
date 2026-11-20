/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Chave pública dos avisos (Web Push/VAPID). A privada fica só no servidor. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

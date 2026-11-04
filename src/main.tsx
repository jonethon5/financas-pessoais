import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { BackendContext } from './data/backend'
import { localBackend } from './data/localBackend'
import { supabaseBackend } from './data/supabaseBackend'
import { captureAuthLink } from './lib/authLink'
import { ToastProvider } from './components/Toast'
import { CelebrationProvider } from './components/Celebration'
import { App } from './App'
import './index.css'

// Link do e-mail (confirmar cadastro, nova senha…): lê e limpa a barra de endereço antes de tudo.
captureAuthLink()

// Service worker do PWA: atualiza sozinho quando sai versão nova.
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Deixa a requisição chegar ao service worker, que responde com o cache quando está offline.
      networkMode: 'offlineFirst',
    },
  },
})

/** Conta de verdade usa o Supabase; a demonstração guarda dados de exemplo só neste aparelho. */
function BackendProvider({ children }: { children: ReactNode }) {
  const { mode } = useAuth()
  return <BackendContext.Provider value={mode === 'demo' ? localBackend : supabaseBackend}>{children}</BackendContext.Provider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <BackendProvider>
            <ToastProvider>
              <CelebrationProvider>
                <App />
              </CelebrationProvider>
            </ToastProvider>
          </BackendProvider>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)

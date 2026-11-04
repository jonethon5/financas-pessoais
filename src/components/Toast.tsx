import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

type ToastAction = { label: string; run: () => void }
type Show = (message: string, action?: ToastAction) => void

const ToastContext = createContext<Show>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

/** Avisos rápidos no rodapé ("Gasto lançado", "Código copiado"…), com uma ação opcional (ex.: Desfazer). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback<Show>((message, action) => {
    clearTimeout(timer.current)
    setToast({ message, action })
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 2400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        {toast && (
          <div className="animate-toast absolute bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-ink/90 py-3 pr-3 pl-5 text-[0.9375rem] font-medium text-white shadow-lg backdrop-blur-xl">
            <CheckCircle2 className="size-5 shrink-0 text-[#4ade9b]" aria-hidden />
            <span className="truncate">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="pointer-events-auto ml-1 rounded-full bg-white/15 px-3 py-1 font-semibold whitespace-nowrap active:bg-white/25"
                onClick={() => {
                  clearTimeout(timer.current)
                  setToast(null)
                  toast.action!.run()
                }}
              >
                {toast.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

/** Copia texto para a área de transferência (com plano B para navegadores antigos). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

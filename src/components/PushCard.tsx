import { useState } from 'react'
import { Bell, BellSlash } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { usePigColor, mascotSrc } from './Pig'
import { useToast } from './Toast'
import { Button } from './ui'
import { disablePush, enablePush, testPush, usePushState } from '../lib/push'
import { friendlyError } from '../lib/supabase'

/** O que dizer em cada situação do aparelho (sempre com o que fazer para resolver). */
const HINT: Record<string, string> = {
  indisponivel: 'Este navegador não recebe avisos. No celular, use o app instalado ou o Chrome.',
  'iphone-instalar': 'No iPhone, os avisos só chegam com o app na tela de início: toque em Compartilhar › Adicionar à Tela de Início, abra o Poupei por lá e volte aqui.',
  negado: 'Os avisos foram bloqueados neste navegador. Libere em Configurações do site › Notificações e volte aqui.',
  'sem-chave': 'Os avisos ainda não foram ligados no servidor do app.',
  desligado: 'Contas vencendo, dia do salário e o lembrete do dia, do jeito do seu porquinho.',
  ligado: 'Ligados neste aparelho. Ele avisa no máximo 2 vezes de manhã e 1 à noite.',
}

/**
 * Ligar os avisos neste aparelho (como o Duolingo pede para a coruja lembrar você).
 * `onEnabled`: guarda o fuso do aparelho no perfil, para os avisos saírem na hora certa.
 */
export function PushCard({ onEnabled }: { onEnabled?: () => void }) {
  const { mode } = useAuth()
  const [state, refresh] = usePushState()
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const color = usePigColor()

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast(ok)
    } catch (err) {
      toast(err instanceof Error && !('status' in err) ? err.message : friendlyError(err))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const demo = mode === 'demo'
  const on = state === 'ligado'
  return (
    <section className="shadow-soft flex flex-col gap-3 rounded-[1.25rem] bg-surface p-4">
      <div className="flex items-start gap-3">
        <img src={mascotSrc(color, on ? 'rosto-feliz' : 'rosto-pensativo')} alt="" aria-hidden className="size-14 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[1.0625rem] font-bold">
            {on ? <Bell size={18} weight="fill" className="text-primary" aria-hidden /> : <BellSlash size={18} className="text-muted" aria-hidden />}
            {on ? 'Avisos ligados' : 'Avisos neste aparelho'}
          </p>
          <p className="mt-0.5 text-[0.9375rem] leading-snug text-muted">{demo ? 'Na demonstração os avisos ficam desligados. Crie uma conta para receber.' : state === 'carregando' ? 'Conferindo…' : HINT[state]}</p>
        </div>
      </div>
      {!demo && state === 'desligado' && (
        <Button loading={busy} onClick={() => run(async () => { await enablePush(); onEnabled?.() }, 'Avisos ligados')}>
          Ligar os avisos
        </Button>
      )}
      {!demo && on && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" size="md" loading={busy} onClick={() => run(testPush, 'Aviso de teste enviado')}>
            Mandar um teste
          </Button>
          <Button variant="ghost" size="md" disabled={busy} onClick={() => run(disablePush, 'Avisos desligados neste aparelho')}>
            Desligar
          </Button>
        </div>
      )}
    </section>
  )
}

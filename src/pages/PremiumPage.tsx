import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bank, ChartBar, CheckCircle, Sparkle, TShirt, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Pig } from '../components/Pig'
import { useToast } from '../components/Toast'
import { BackButton, Button, NavBar, Notice } from '../components/ui'
import { useBackend } from '../data/backend'
import { APP_NAME } from '../brand'
import { friendlyError } from '../lib/supabase'

const PERKS: { icon: PhosphorIcon; title: string; text: string }[] = [
  { icon: Bank, title: 'Banco conectado', text: 'Gastos da conta e do cartão entram sozinhos, já com categoria.' },
  { icon: Sparkle, title: 'Até 3 bancos', text: 'Conta e cartão de mais de um banco no mesmo lugar, com o painel de cada um.' },
  { icon: ChartBar, title: 'Histórico de 12 meses', text: 'Gráficos do ano inteiro e relatório para baixar.' },
  { icon: TShirt, title: 'Roupas exclusivas', text: 'Peças que só quem assina tem na lojinha do mascote.' },
]

/**
 * /premium: SIMULAÇÃO de como o plano pago vai aparecer. Ainda não existe cobrança:
 * o botão só registra o interesse (vai para as sugestões), para medir quem assinaria.
 */
export function PremiumPage() {
  const navigate = useNavigate()
  const backend = useBackend()
  const toast = useToast()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function interested() {
    setLoading(true)
    try {
      await backend.sendFeedback({ kind: 'sugestao', message: 'Tenho interesse no Premium (toque em "Quero ser avisado").', context: { tela: '/premium' } })
      setSent(true)
      toast('Anotado! Você será avisado quando lançar')
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar title="Premium" large={false} left={<BackButton onClick={() => navigate(-1)} />} />
      <div className="flex flex-col gap-4 pt-2">
        <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#16233F] via-[#1B2F5E] to-[#0E1830] p-5 text-white">
          <span aria-hidden className="absolute -top-20 -right-12 size-60 rounded-full bg-[#F2C14E]/20" />
          <span aria-hidden className="absolute -bottom-16 -left-10 size-44 rounded-full border-[14px] border-white/[0.06]" />
          <div className="relative flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <p className="inline-block rounded-full bg-[#F2C14E] px-2.5 py-0.5 text-[0.75rem] font-extrabold tracking-wide text-[#3A2A00] uppercase">Em breve</p>
              <p className="mt-2 text-[1.75rem] leading-tight font-extrabold tracking-tight">{APP_NAME} Premium</p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-white/80">O app continua de graça para lançar e acompanhar. O Premium é para quem quer tudo no automático.</p>
            </div>
            <Pig art="loja-terno" px={112} className="-mb-2 shrink-0" />
          </div>
          <div className="relative mt-4 flex items-baseline gap-2">
            <p className="num text-[2rem] leading-none font-extrabold">R$ 9,90</p>
            <p className="text-[0.9375rem] text-white/75">por mês</p>
          </div>
          <p className="relative mt-1 text-[0.8125rem] text-white/60">Valor de exemplo: o preço ainda não foi definido.</p>
        </section>

        <ul className="flex flex-col gap-2.5">
          {PERKS.map((p) => (
            <li key={p.title} className="shadow-soft flex items-start gap-3 rounded-[1.1rem] bg-surface p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-[0.8rem] bg-primary-soft text-primary-strong">
                <p.icon size={22} weight="duotone" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{p.title}</span>
                <span className="block text-[0.9375rem] leading-snug text-muted">{p.text}</span>
              </span>
              <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
            </li>
          ))}
        </ul>

        <Notice>Isto é uma prévia: ainda não dá para assinar e nada é cobrado. Se você tocar no botão, só fica registrado que você tem interesse.</Notice>
        <Button onClick={interested} loading={loading} disabled={sent}>
          {sent ? 'Interesse anotado' : 'Quero ser avisado quando lançar'}
        </Button>
      </div>
    </>
  )
}

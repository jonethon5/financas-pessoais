import { useNavigate } from 'react-router'
import {
  Bank, Brain, CalendarCheck, ChartDonut, ChatCircleText, CoinVertical, CreditCard, GearSix, Hourglass, ListBullets, PiggyBank, Repeat,
  Tag, TrendUp, Trophy, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { Sheet } from './Sheet'

type Item = { label: string; icon: PhosphorIcon; to?: string; soon?: boolean }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Seu dinheiro',
    items: [
      { label: 'Conta', icon: Bank, to: '/voce/bancos' },
      { label: 'Cartões', icon: CreditCard, to: '/voce/bancos' },
      { label: 'Caixinhas', icon: PiggyBank, to: '/caixinhas' },
      { label: 'Resumo do mês', icon: ChartDonut, to: '/mes' },
      { label: 'Lançamentos', icon: ListBullets, to: '/mes?aba=lancamentos' },
      { label: 'Gastos fixos', icon: Repeat, to: '/voce/fixos' },
    ],
  },
  {
    title: 'Hábitos',
    items: [
      { label: 'Desafios', icon: Trophy, to: '/habitos' },
      { label: 'Lista de desejos', icon: Hourglass, to: '/habitos' },
      { label: 'Revisão da semana', icon: CalendarCheck, to: '/revisao' },
      { label: 'Categorias e limites', icon: Tag, to: '/voce/categorias' },
    ],
  },
  {
    title: 'Em breve',
    items: [
      { label: 'Assistente', icon: Brain, soon: true },
      { label: 'Investimentos', icon: TrendUp, soon: true },
      { label: 'Cripto', icon: CoinVertical, soon: true },
    ],
  },
  {
    title: 'Ajuda',
    items: [
      { label: 'Ajustes', icon: GearSix, to: '/voce' },
      { label: 'Sugestões', icon: ChatCircleText, to: '/voce/sugestao' },
    ],
  },
]

/** Menu do hambúrguer: todos os cantos do app num lugar só, em grade. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-2 px-1 text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">{g.title}</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {g.items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  disabled={it.soon}
                  onClick={() => {
                    if (!it.to) return
                    onClose()
                    navigate(it.to)
                  }}
                  className="press relative flex min-h-[5.5rem] flex-col items-start justify-between rounded-[1rem] bg-surface p-3 text-left disabled:opacity-60"
                >
                  <it.icon size={26} weight="duotone" className="text-primary" />
                  <span className="text-[0.875rem] leading-tight font-semibold">{it.label}</span>
                  {it.soon && <span className="absolute top-2 right-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-bold text-muted uppercase">Em breve</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  )
}

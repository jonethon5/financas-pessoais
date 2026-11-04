import { CalendarDays, PiggyBank } from 'lucide-react'
import { EmptyState, NavBar } from '../components/ui'

export function MonthPage() {
  return (
    <>
      <NavBar title="Mês" />
      <EmptyState icon={<CalendarDays strokeWidth={1.8} />} title="Rendas, gastos e orçamento">
        Aqui vão ficar o salário, os gastos fixos, do dia a dia e parcelados, e o orçamento de cada categoria.
      </EmptyState>
    </>
  )
}

export function GoalsPage() {
  return (
    <>
      <NavBar title="Caixinhas" />
      <EmptyState icon={<PiggyBank strokeWidth={1.8} />} title="Suas metas para guardar">
        Viagem, reserva de emergência, aquela compra: cada caixinha mostra quanto guardar por mês para chegar lá.
      </EmptyState>
    </>
  )
}

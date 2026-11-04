import { PiggyBank } from 'lucide-react'
import { EmptyState, NavBar } from '../components/ui'

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

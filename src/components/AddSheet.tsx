import { Sheet } from './Sheet'

/** Menu do "+": lançar gasto, renda ou guardar numa caixinha (preenchido na etapa da Base). */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Lançar">
      <p className="py-6 text-center text-muted">Os lançamentos de gastos e rendas entram na próxima etapa.</p>
    </Sheet>
  )
}

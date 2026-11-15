import { Chip } from './ui'

const OPTIONS = [
  { days: 0, label: 'No dia' },
  { days: 1, label: '1 dia antes' },
  { days: 3, label: '3 dias antes' },
  { days: 5, label: '5 dias antes' },
  { days: 7, label: '7 dias antes' },
]

/** Com quantos dias de antecedência a conta aparece em "Contas a pagar". */
export function RemindDays({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Avisar quando</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {OPTIONS.map((o) => (
          <Chip key={o.days} selected={value === o.days} onClick={() => onChange(o.days)}>
            {o.label}
          </Chip>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[0.8125rem] leading-snug text-muted">A conta aparece em “Contas a pagar”, no Início, a partir desse dia.</p>
    </div>
  )
}

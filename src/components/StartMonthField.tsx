import { ChevronLeft, ChevronRight } from 'lucide-react'
import { compareYearMonth, currentYearMonth, monthLabel, type YearMonth } from '../lib/dates'
import { startMonthOptions } from '../lib/recurring'

/**
 * "Começa em" do gasto fixo: este mês ou um dos próximos 11 (para planejar o mês que vem).
 * Setas para os lados, no mesmo jeito do campo de data.
 */
export function StartMonthField({ value, onChange, hint }: { value: YearMonth; onChange: (ym: YearMonth) => void; hint?: string }) {
  const options = startMonthOptions(currentYearMonth())
  const i = Math.max(0, options.findIndex((o) => compareYearMonth(o, value) === 0))
  const first = i === 0
  const last = i === options.length - 1
  return (
    <div>
      <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Começa em</p>
      <div className="shadow-soft flex items-center gap-1 rounded-[0.875rem] bg-surface p-1">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={first}
          onClick={() => onChange(options[i - 1])}
          className="press grid size-11 place-items-center rounded-[0.7rem] text-primary active:bg-surface-2 disabled:text-faint"
        >
          <ChevronLeft className="size-6" />
        </button>
        <p className="flex-1 text-center" aria-live="polite">
          <span className="text-[1.0625rem] font-semibold">{monthLabel(options[i])}</span>
          <span className="block text-[0.8125rem] text-muted">{first ? 'Este mês' : i === 1 ? 'Mês que vem' : `Daqui a ${i} meses`}</span>
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={last}
          onClick={() => onChange(options[i + 1])}
          className="press grid size-11 place-items-center rounded-[0.7rem] text-primary active:bg-surface-2 disabled:text-faint"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
      {hint && <p className="mt-1.5 px-1 text-[0.8125rem] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

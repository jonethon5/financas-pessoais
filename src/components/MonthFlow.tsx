import type { MonthSummary } from '../lib/budget'
import { formatBRL } from '../lib/money'
import { useHiddenValues } from '../lib/privacy'
import { Money } from './ui'

const PARTS = [
  { key: 'gastos', label: 'Gastos', color: 'var(--viz-2)' },
  { key: 'caixinhas', label: 'Caixinhas', color: 'var(--viz-3)' },
  { key: 'sobra', label: 'Sobra', color: 'var(--viz-1)' },
] as const

/**
 * A conta do mês, sempre igual em todo o app: renda − gastos − caixinhas = sobra.
 * Embaixo, uma barra mostra para onde vai cada real da renda (com valor e %, nunca só a cor).
 */
export function MonthFlow({ s }: { s: MonthSummary }) {
  const hidden = useHiddenValues()
  const spent = s.committed + s.daily
  const over = s.free < 0
  const values = { gastos: spent, caixinhas: s.save, sobra: Math.max(0, s.free) }
  const base = Math.max(s.income, spent + s.save)
  const pct = (c: number) => (base ? Math.round((c / base) * 100) : 0)

  const line = (label: string, hint: string | null, cents: number, op: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {hint && <span className="block text-[0.8125rem] text-muted">{hint}</span>}
      </span>
      <span className="num shrink-0 text-[1rem] font-semibold">
        <span className="mr-1 text-muted">{op}</span>
        <Money cents={cents} />
      </span>
    </div>
  )

  return (
    <div>
      {line('Renda do mês', 'salário e rendas que você lançou', s.income, '+')}
      {line('Gastos', 'contas fixas, parcelas e dia a dia', spent, '−')}
      {line('Para as caixinhas', null, s.save, '−')}
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
        <span className="text-[0.9375rem] font-bold">{over ? 'Faltam no mês' : 'Sobra prevista'}</span>
        <span className={`num text-[1.375rem] leading-tight font-extrabold tracking-[-0.02em] ${over ? 'text-danger-strong' : 'text-primary-strong'}`}>
          <Money cents={Math.abs(s.free)} />
        </span>
      </div>

      {base > 0 && (
        <div className="mt-3.5">
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={PARTS.map((p) => `${p.label} ${pct(values[p.key])}%`).join(', ')}>
            {PARTS.map((p) =>
              values[p.key] > 0 ? <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(values[p.key] / base) * 100}%`, background: p.color }} /> : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
            {PARTS.map((p) => (
              <li key={p.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.label} <span className="num font-semibold text-ink">{pct(values[p.key])}%</span>
              </li>
            ))}
          </ul>
          {over && <p className="mt-2 text-[0.875rem] leading-snug text-danger-strong">Os gastos e as caixinhas passam da renda em {hidden ? 'R$ ••••' : formatBRL(-s.free)}. Vale rever o plano do mês.</p>}
        </div>
      )}
    </div>
  )
}

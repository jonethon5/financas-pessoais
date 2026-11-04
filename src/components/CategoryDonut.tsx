import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { liftForDark, useIsDark } from '../lib/theme'
import { AnimatedMoney } from './ui'

export type Slice = { id: string; name: string; color: string; cents: number }

/** Gráfico de rosca por categoria, com o total no meio. As fatias se desenham ao aparecer. */
export function CategoryDonut({ slices, label }: { slices: Slice[]; label: string }) {
  const total = slices.reduce((a, s) => a + s.cents, 0)
  const dark = useIsDark()
  const empty = dark ? '#1F2832' : '#EEF1F4'
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[16.5rem]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices.length ? slices : [{ id: 'vazio', name: '', color: empty, cents: 1 }]}
            dataKey="cents"
            nameKey="name"
            innerRadius="66%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={slices.length > 1 ? 6 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive
            animationDuration={850}
            animationEasing="ease-out"
          >
            {(slices.length ? slices : [{ id: 'vazio', color: empty }]).map((s) => (
              <Cell key={s.id} fill={liftForDark(s.color, dark)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[0.875rem] text-muted">{label}</span>
        <AnimatedMoney cents={total} className="text-[1.5rem] font-bold" />
      </div>
    </div>
  )
}

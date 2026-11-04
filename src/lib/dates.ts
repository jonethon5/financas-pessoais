// Datas sem fuso: o app trabalha com dias do calendário ("2026-11-04") no horário do aparelho.

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export type YearMonth = { year: number; month: number } // month: 1–12

const pad = (n: number) => String(n).padStart(2, '0')

export function currentYearMonth(today = new Date()): YearMonth {
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`
}

export function monthShort({ month }: YearMonth): string {
  return MONTH_NAMES[month - 1].slice(0, 3)
}

export function sameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month
}

/** negativo se a < b, 0 se igual, positivo se a > b */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

/** Quantos meses de a até b (b − a). */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  return compareYearMonth(b, a)
}

/** "2026-11" */
export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`
}

export function parseMonthKey(key: string | null | undefined): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? '')
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month, 0).getDate()
}

/** Dia que existe no mês: dia 31 em fevereiro vira 28 (ou 29). */
export function clampDay(ym: YearMonth, day: number): number {
  return Math.min(Math.max(1, Math.trunc(day)), daysInMonth(ym))
}

/** "2026-11-04" a partir de ano, mês e dia (o dia é ajustado ao tamanho do mês). */
export function isoDate(ym: YearMonth, day: number): string {
  return `${ym.year}-${pad(ym.month)}-${pad(clampDay(ym, day))}`
}

export function firstDayISO(ym: YearMonth): string {
  return isoDate(ym, 1)
}

export function lastDayISO(ym: YearMonth): string {
  return isoDate(ym, daysInMonth(ym))
}

/** Data do aparelho em "AAAA-MM-DD" (sem converter para UTC, que mudaria o dia à noite). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

/** Meio-dia local: evita pular de dia no horário de verão. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return toISODate(parseISODate(iso)) === iso
}

export function monthOf(iso: string): YearMonth {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) }
}

export function dayOf(iso: string): number {
  return Number(iso.slice(8, 10))
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Dias de a até b (b − a). */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(iso: string): number {
  return parseISODate(iso).getDay()
}

/** "04/11" ou "04/11/2025" quando é de outro ano */
export function formatDateShort(iso: string, today = todayISO()): string {
  const base = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return iso.slice(0, 4) === today.slice(0, 4) ? base : `${base}/${iso.slice(0, 4)}`
}

/** "terça, 4 de novembro" */
export function formatDayLong(iso: string): string {
  const d = parseISODate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()].toLowerCase()}`
}

/** "Hoje", "Ontem" ou "terça, 4 de novembro" */
export function relativeDay(iso: string, today = todayISO()): string {
  const diff = daysBetweenISO(iso, today)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff === -1) return 'Amanhã'
  const label = formatDayLong(iso)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

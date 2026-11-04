import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  addMonths,
  clampDay,
  daysBetweenISO,
  daysInMonth,
  formatDateShort,
  isValidISODate,
  isoDate,
  monthKey,
  monthLabel,
  monthsBetween,
  parseMonthKey,
  relativeDay,
  toISODate,
} from './dates'

describe('addMonths', () => {
  it('vira o ano corretamente', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 })
  })
  it('conta meses entre datas', () => {
    expect(monthsBetween({ year: 2026, month: 11 }, { year: 2027, month: 7 })).toBe(8)
  })
})

describe('monthLabel e monthKey', () => {
  it('escreve o mês em português', () => {
    expect(monthLabel({ year: 2026, month: 3 })).toBe('Março de 2026')
  })
  it('chave AAAA-MM vai e volta', () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe('2026-03')
    expect(parseMonthKey('2026-03')).toEqual({ year: 2026, month: 3 })
    expect(parseMonthKey('2026-13')).toBeNull()
    expect(parseMonthKey(null)).toBeNull()
  })
})

describe('dias do mês', () => {
  it('fevereiro bissexto e comum', () => {
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29)
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28)
  })
  it('dia 31 em mês curto vira o último dia', () => {
    expect(clampDay({ year: 2026, month: 2 }, 31)).toBe(28)
    expect(isoDate({ year: 2026, month: 4 }, 31)).toBe('2026-04-30')
  })
})

describe('datas ISO', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('conta dias entre datas (inclusive no horário de verão)', () => {
    expect(daysBetweenISO('2026-11-01', '2026-11-30')).toBe(29)
    expect(daysBetweenISO('2026-10-01', '2026-11-01')).toBe(31)
  })
  it('valida datas', () => {
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('04/11/2026')).toBe(false)
  })
  it('usa o dia local, não o UTC', () => {
    expect(toISODate(new Date(2026, 10, 4, 23, 30))).toBe('2026-11-04')
  })
  it('formata para leitura', () => {
    expect(formatDateShort('2026-11-04', '2026-12-01')).toBe('04/11')
    expect(formatDateShort('2025-11-04', '2026-12-01')).toBe('04/11/2025')
    expect(relativeDay('2026-11-04', '2026-11-04')).toBe('Hoje')
    expect(relativeDay('2026-11-03', '2026-11-04')).toBe('Ontem')
    expect(relativeDay('2026-11-02', '2026-11-04')).toBe('Segunda, 2 de novembro')
  })
})

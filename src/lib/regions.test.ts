import { describe, expect, it } from 'vitest'
import { UFS, referenceIncome, starterSaving, ufInfo } from './regions'

describe('regiões (IBGE)', () => {
  it('tem os 27 estados, sem repetir', () => {
    expect(UFS).toHaveLength(27)
    expect(new Set(UFS.map((u) => u.uf)).size).toBe(27)
  })
  it('renda de referência: salário da pessoa > média do estado > média do Brasil', () => {
    expect(referenceIncome(250000, 'SP')).toBe(250000)
    expect(referenceIncome(null, 'MA')).toBe(221800)
    expect(referenceIncome(null, undefined)).toBe(362100)
    expect(ufInfo('XX')).toBeNull()
  })
  it('sugestão para começar: 5% (mínimo R$ 20)', () => {
    expect(starterSaving(300000)).toBe(15000)
    expect(starterSaving(221800)).toBe(11000)
    expect(starterSaving(20000)).toBe(2000)
  })
})

import { describe, expect, it } from 'vitest'
import { GROUPS, LESSONS, lessonOfDay } from './learn'

// Rotas que existem no app (src/App.tsx)
const ROUTES = [/^\/separar$/, /^\/caixinhas(\/nova)?$/, /^\/habitos$/, /^\/lancar\?tipo=dia$/, /^\/mes\?aba=orcamento$/]

describe('Aprender', () => {
  it('cada lição tem fonte, passos, exemplo com reais e id único', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length)
    for (const l of LESSONS) {
      expect(l.sources.length, l.id).toBeGreaterThan(0)
      expect(l.steps.length, l.id).toBeGreaterThan(0)
      expect(l.example, l.id).toMatch(/R\$/)
      expect(l.short.length, l.id).toBeLessThanOrEqual(90)
      expect(GROUPS.some((g) => g.id === l.group), l.id).toBe(true)
    }
  })
  it('os botões levam para telas que existem', () => {
    for (const l of LESSONS) if (l.cta) expect(ROUTES.some((r) => r.test(l.cta!.to)), l.cta.to).toBe(true)
  })
  it('a lição do dia muda a cada dia e nunca quebra', () => {
    expect(lessonOfDay(0)).toBe(LESSONS[0])
    expect(lessonOfDay(1)).toBe(LESSONS[1])
    expect(lessonOfDay(-1)).toBe(LESSONS[LESSONS.length - 1])
    expect(lessonOfDay(LESSONS.length)).toBe(LESSONS[0])
  })
})

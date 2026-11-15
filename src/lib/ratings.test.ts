import { describe, expect, it } from 'vitest'
import { ratingLabel, screenName, screenOf, summarizeRatings, type ScreenRatingRow } from './ratings'

describe('qual tela está sendo avaliada', () => {
  it('reconhece as abas e as telas de dentro', () => {
    expect(screenOf('/')).toEqual({ key: 'inicio', name: 'Início' })
    expect(screenOf('/mes')?.key).toBe('mes')
    expect(screenOf('/voce/bancos')?.name).toBe('Bancos conectados')
    expect(screenOf('/ajustes/dinheiro')?.name).toBe('Ajustes · Seu dinheiro')
  })

  it('ids viram um nome fixo (todas as caixinhas somam na mesma nota)', () => {
    expect(screenOf('/caixinhas/7f3c2a10-1111-2222-3333-444455556666')?.key).toBe('caixinhas/detalhe')
    expect(screenOf('/voce/bancos/abc')?.key).toBe('voce/bancos/conta')
    expect(screenOf('/aprender/metodo-50-30-20')?.key).toBe('aprender/licao')
  })

  it('formulários, painel do beta e caminhos desconhecidos não têm avaliação', () => {
    expect(screenOf('/caixinhas/nova')).toBeNull()
    expect(screenOf('/caixinhas/abc/editar')).toBeNull()
    expect(screenOf('/lancar')).toBeNull()
    expect(screenOf('/voce/beta')).toBeNull()
    expect(screenOf('/voce/sugestao')).toBeNull()
    expect(screenOf('/qualquer-coisa')).toBeNull()
  })

  it('nomes e notas para mostrar', () => {
    expect(screenName('extrato')).toBe('Extrato')
    expect(screenName('tela-antiga')).toBe('tela-antiga')
    expect(ratingLabel(5)).toBe('Muito satisfeito')
    expect(ratingLabel(1)).toBe('Muito insatisfeito')
  })
})

describe('resumo do painel', () => {
  const row = (screen: string, rating: number, problems: string[] = [], day = '10'): ScreenRatingRow => ({
    screen,
    rating,
    problems,
    message: null,
    created_at: `2026-11-${day}T12:00:00Z`,
  })

  it('média, notas ruins e problemas mais marcados por tela', () => {
    const [extrato] = summarizeRatings([
      row('extrato', 2, ['Valor ou conta errada', 'Difícil de entender']),
      row('extrato', 1, ['Valor ou conta errada'], '12'),
      row('extrato', 5),
    ])
    expect(extrato).toMatchObject({ screen: 'extrato', name: 'Extrato', total: 3, average: 2.7, unhappy: 2, last: '2026-11-12T12:00:00Z' })
    expect(extrato.problems).toEqual([
      { label: 'Valor ou conta errada', count: 2 },
      { label: 'Difícil de entender', count: 1 },
    ])
  })

  it('as piores telas vêm primeiro', () => {
    const list = summarizeRatings([row('inicio', 5), row('inicio', 4), row('mes', 3), row('graficos', 1)])
    expect(list.map((s) => s.screen)).toEqual(['graficos', 'mes', 'inicio'])
    expect(list[2].average).toBe(4.5)
  })

  it('sem respostas, sem resumo', () => {
    expect(summarizeRatings([])).toEqual([])
  })
})

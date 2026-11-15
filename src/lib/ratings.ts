/**
 * "Avalie esta tela": qual tela a pessoa está vendo, as respostas possíveis e o resumo do painel do beta.
 * Funções puras (sem React, sem rede), testadas em ratings.test.ts.
 */

export type ScreenInfo = { key: string; name: string }

/** Telas que podem ser avaliadas: caminho (sem ids) → nome que aparece no painel. */
export const SCREEN_NAMES: Record<string, string> = {
  inicio: 'Início',
  mes: 'Mês',
  caixinhas: 'Caixinhas',
  'caixinhas/detalhe': 'Detalhe da caixinha',
  graficos: 'Gráficos',
  extrato: 'Extrato',
  habitos: 'Hábitos e desafios',
  aprender: 'Aprender',
  'aprender/licao': 'Lição',
  saude: 'Saúde financeira',
  porquinho: 'Porquinho e loja',
  premium: 'Premium',
  ajuda: 'Central de ajuda',
  voce: 'Você',
  'voce/bancos': 'Bancos conectados',
  'voce/bancos/conta': 'Painel da conta',
  'voce/categorias': 'Categorias e limites',
  'voce/fixos': 'Gastos fixos',
  ajustes: 'Ajustes',
  'ajustes/aparencia': 'Ajustes · Aparência',
  'ajustes/dicas': 'Ajustes · Porquinho e dicas',
  'ajustes/avisos': 'Ajustes · Notificações',
  'ajustes/dinheiro': 'Ajustes · Seu dinheiro',
  'ajustes/conta': 'Ajustes · Conta e segurança',
  'ajustes/privacidade': 'Ajustes · Privacidade',
  'ajustes/sobre': 'Ajustes · Sobre o app',
}

/**
 * Qual tela é este caminho. Partes que mudam (id da caixinha, da conta, da lição) viram um nome fixo,
 * para todas as caixinhas somarem na mesma nota. Formulários e o painel do beta não têm avaliação (null).
 */
export function screenOf(pathname: string): ScreenInfo | null {
  const parts = pathname.split('/').filter(Boolean)
  let key: string
  if (parts.length === 0) key = 'inicio'
  else if (parts[0] === 'caixinhas' && parts.length === 2 && parts[1] !== 'nova') key = 'caixinhas/detalhe'
  else if (parts[0] === 'aprender' && parts.length === 2) key = 'aprender/licao'
  else if (parts[0] === 'voce' && parts[1] === 'bancos' && parts.length === 3) key = 'voce/bancos/conta'
  else key = parts.join('/')
  const name = SCREEN_NAMES[key]
  return name ? { key, name } : null
}

/** Nome para mostrar de uma tela guardada (telas que deixarem de existir aparecem pelo caminho). */
export function screenName(key: string): string {
  return SCREEN_NAMES[key] ?? key
}

/** Pergunta 1: satisfação, de 5 (muito satisfeito) a 1 (muito insatisfeito). */
export const RATING_OPTIONS = [
  { value: 5, label: 'Muito satisfeito' },
  { value: 4, label: 'Satisfeito' },
  { value: 3, label: 'Neutro' },
  { value: 2, label: 'Insatisfeito' },
  { value: 1, label: 'Muito insatisfeito' },
] as const

export function ratingLabel(value: number): string {
  return RATING_OPTIONS.find((o) => o.value === value)?.label ?? `${value}`
}

/** Pergunta 2: o que melhorar (pode marcar vários). */
export const PROBLEM_OPTIONS = [
  'Valor ou conta errada',
  'Difícil de entender',
  'Falta alguma coisa',
  'Visual confuso',
  'Lento ou travou',
  'Deu erro',
] as const

export type ScreenRatingRow = { screen: string; rating: number; problems: string[]; message: string | null; created_at: string }

export type ScreenSummary = {
  screen: string
  name: string
  total: number
  /** média de 1 a 5, com uma casa */
  average: number
  /** quantas notas 1 ou 2 */
  unhappy: number
  /** quantas vezes cada problema foi marcado, do mais marcado para o menos */
  problems: { label: string; count: number }[]
  last: string
}

/** Resumo por tela para o painel: as piores primeiro (é por onde começar a melhorar). */
export function summarizeRatings(rows: ScreenRatingRow[]): ScreenSummary[] {
  const by = new Map<string, ScreenRatingRow[]>()
  for (const r of rows) by.set(r.screen, [...(by.get(r.screen) ?? []), r])
  const out: ScreenSummary[] = []
  for (const [screen, list] of by) {
    const counts = new Map<string, number>()
    for (const r of list) for (const p of r.problems) counts.set(p, (counts.get(p) ?? 0) + 1)
    out.push({
      screen,
      name: screenName(screen),
      total: list.length,
      average: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10,
      unhappy: list.filter((r) => r.rating <= 2).length,
      problems: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      last: list.reduce((m, r) => (r.created_at > m ? r.created_at : m), ''),
    })
  }
  return out.sort((a, b) => a.average - b.average || b.total - a.total || a.name.localeCompare(b.name))
}

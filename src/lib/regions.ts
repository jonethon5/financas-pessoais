/**
 * Renda média do trabalho por estado (IBGE, PNAD Contínua, tabela 5436, 2º trimestre de 2026):
 * rendimento médio mensal real habitualmente recebido no trabalho principal, em reais.
 * Usado só para adaptar exemplos e metas à realidade de cada lugar, nunca para comparar a pessoa ("abaixo da média").
 * A média é puxada por quem ganha muito: a pessoa "típica" ganha menos do que isso.
 */
export const INCOME_SOURCE = 'IBGE, PNAD Contínua, 2º trimestre de 2026'
export const BRAZIL_AVG_CENTS = 362100

export type Uf = { uf: string; name: string; avgCents: number }

export const UFS: Uf[] = [
  { uf: 'AC', name: 'Acre', avgCents: 303900 },
  { uf: 'AL', name: 'Alagoas', avgCents: 246600 },
  { uf: 'AP', name: 'Amapá', avgCents: 305800 },
  { uf: 'AM', name: 'Amazonas', avgCents: 270400 },
  { uf: 'BA', name: 'Bahia', avgCents: 246900 },
  { uf: 'CE', name: 'Ceará', avgCents: 263600 },
  { uf: 'DF', name: 'Distrito Federal', avgCents: 600700 },
  { uf: 'ES', name: 'Espírito Santo', avgCents: 350500 },
  { uf: 'GO', name: 'Goiás', avgCents: 384400 },
  { uf: 'MA', name: 'Maranhão', avgCents: 221800 },
  { uf: 'MT', name: 'Mato Grosso', avgCents: 399400 },
  { uf: 'MS', name: 'Mato Grosso do Sul', avgCents: 373100 },
  { uf: 'MG', name: 'Minas Gerais', avgCents: 334100 },
  { uf: 'PA', name: 'Pará', avgCents: 250600 },
  { uf: 'PB', name: 'Paraíba', avgCents: 264400 },
  { uf: 'PR', name: 'Paraná', avgCents: 408300 },
  { uf: 'PE', name: 'Pernambuco', avgCents: 264500 },
  { uf: 'PI', name: 'Piauí', avgCents: 241300 },
  { uf: 'RJ', name: 'Rio de Janeiro', avgCents: 400100 },
  { uf: 'RN', name: 'Rio Grande do Norte', avgCents: 273700 },
  { uf: 'RS', name: 'Rio Grande do Sul', avgCents: 400900 },
  { uf: 'RO', name: 'Rondônia', avgCents: 372000 },
  { uf: 'RR', name: 'Roraima', avgCents: 339500 },
  { uf: 'SC', name: 'Santa Catarina', avgCents: 430100 },
  { uf: 'SP', name: 'São Paulo', avgCents: 433600 },
  { uf: 'SE', name: 'Sergipe', avgCents: 286500 },
  { uf: 'TO', name: 'Tocantins', avgCents: 335100 },
]

export const ufInfo = (uf: string | null | undefined) => UFS.find((u) => u.uf === uf) ?? null

/**
 * Renda de referência para exemplos e sugestões: o salário da pessoa, se ela informou;
 * senão, a média do estado; senão, a do Brasil.
 */
export function referenceIncome(salaryCents: number | null | undefined, uf: string | null | undefined): number {
  if (salaryCents && salaryCents > 0) return salaryCents
  return ufInfo(uf)?.avgCents ?? BRAZIL_AVG_CENTS
}

/** Sugestão de quanto guardar por mês para começar: 5% da renda, arredondado para R$ 10 (mínimo R$ 20). */
export function starterSaving(incomeCents: number): number {
  return Math.max(2000, Math.round((incomeCents * 0.05) / 1000) * 1000)
}

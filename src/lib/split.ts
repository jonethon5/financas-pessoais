// Divisão de contas em CENTAVOS. A soma das partes sempre fecha exatamente com o total.

/**
 * Divide igualmente. Os centavos que sobram vão, um para cada, para os primeiros da lista.
 * Ex.: R$ 100,01 por 4 → 25,01 / 25,00 / 25,00 / 25,00
 * Usado nas parcelas: R$ 100,00 em 3x → 33,34 / 33,33 / 33,33
 */
export function splitEqual(totalCents: number, count: number): number[] {
  assertCents(totalCents)
  if (!Number.isInteger(count) || count <= 0) throw new Error('Informe em quantas partes dividir.')
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * Divide proporcionalmente a pesos inteiros (ex.: percentuais 60/40, ou 2 partes para um e 1 para outro).
 * Usa o método do maior resto: cada um recebe a parte inteira, e os centavos que sobram vão para quem
 * tinha a maior fração (empate: quem vem primeiro na lista).
 */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  assertCents(totalCents)
  if (weights.length === 0) throw new Error('Informe em quantas partes dividir.')
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) throw new Error('Os pesos precisam ser números inteiros positivos.')
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) throw new Error('Pelo menos uma parte precisa ser maior que zero.')

  // totalCents * w cabe com folga em Number (limite ~9 quatrilhões)
  const raw = weights.map((w) => totalCents * w)
  const parts = raw.map((r) => Math.floor(r / sum))
  let leftover = totalCents - parts.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r % sum }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (leftover === 0) break
    parts[i] += 1
    leftover -= 1
  }
  return parts
}

function assertCents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor inválido.')
}

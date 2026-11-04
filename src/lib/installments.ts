// Parcelamentos: dividir no centavo e espalhar pelos meses certos ("3/10").
import { addMonths, dayOf, isoDate, monthOf } from './dates'
import { splitEqual } from './split'

export type Installment = { no: number; total: number; date: string; amountCents: number }

/**
 * Monta as parcelas.
 *  - mode 'total': o valor informado é o total da compra (R$ 1.000 em 3x → 333,34 + 333,33 + 333,33)
 *  - mode 'parcela': o valor informado é o de cada parcela (10x de R$ 150 → total R$ 1.500)
 * A primeira parcela cai na data informada; as seguintes no mesmo dia dos meses seguintes
 * (dia 31 vira o último dia dos meses curtos).
 */
export function buildInstallments(input: { amountCents: number; mode: 'total' | 'parcela'; count: number; firstDate: string }): Installment[] {
  const { amountCents, mode, count, firstDate } = input
  if (!Number.isInteger(count) || count < 2 || count > 120) throw new Error('Parcelas: de 2 a 120.')
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Informe o valor.')
  const amounts = mode === 'total' ? splitEqual(amountCents, count) : Array.from({ length: count }, () => amountCents)
  if (amounts.some((a) => a <= 0)) throw new Error('O valor é pequeno demais para tantas parcelas.')
  const first = monthOf(firstDate)
  const day = dayOf(firstDate)
  return amounts.map((amountCents, i) => ({ no: i + 1, total: count, date: isoDate(addMonths(first, i), day), amountCents }))
}

export const installmentLabel = (no: number | null, total: number | null) => (no && total ? `${no}/${total}` : '')

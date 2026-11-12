import { describe, expect, it } from 'vitest'
import { categoryHint, cleanDescription, countKey, countsInMonth, findFixedMatch, findManualMatch, ignoreKey, isOwnTransfer, isSalaryMatch, learnKey, mapTransaction, mentionsName, paydayIn, salaryMonths, type PluggyTx } from '../../supabase/functions/_shared/bankmap.ts'

const tx = (p: Partial<PluggyTx>): PluggyTx => ({ id: 'abc', description: 'Compra', amount: -10, date: '2026-11-04T00:00:00.000Z', ...p })

describe('conta corrente', () => {
  it('saída vira gasto do dia a dia, entrada vira renda', () => {
    expect(mapTransaction(tx({ description: 'IFOOD *RESTAURANTE', amount: -42.9 }), 'BANK')).toMatchObject({
      external_id: 'pluggy:abc', kind: 'expense', type: 'dia', amount_cents: 4290, date: '2026-11-04', description: 'Ifood Restaurante', categoryHint: 'Delivery',
    })
    expect(mapTransaction(tx({ description: 'Pix recebido Maria', amount: 150 }), 'BANK')).toMatchObject({ kind: 'income', type: 'extra', amount_cents: 15000, categoryHint: 'Renda extra' })
  })
  it('ignora pagamento de fatura e caixinhas do banco (não conta duas vezes)', () => {
    expect(mapTransaction(tx({ description: 'Pagamento de fatura', amount: -1200 }), 'BANK')).toBeNull()
    expect(mapTransaction(tx({ description: 'Aplicação RDB', amount: -300 }), 'BANK')).toBeNull()
    expect(mapTransaction(tx({ description: 'Resgate RDB', amount: 300 }), 'BANK')).toBeNull()
    expect(mapTransaction(tx({ description: 'Pagamento', amount: -900, operationType: 'PAGAMENTO_FATURA' }), 'BANK')).toBeNull()
  })
})

describe('transferência entre contas da própria pessoa', () => {
  const me = ['Ana Paula Ribeiro']
  it('reconhece pela categoria do Open Finance, pelo mesmo CPF dos dois lados ou pelo nome no Pix', () => {
    expect(isOwnTransfer(tx({ description: 'Transferência', category: 'Same person transfer - PIX' }))).toBe(true)
    expect(isOwnTransfer(tx({ description: 'Transferência', category: 'Same ownership transfer' }))).toBe(true)
    const party = (value: string) => ({ name: 'Qualquer', documentNumber: { type: 'CPF', value } })
    expect(isOwnTransfer(tx({ description: 'Pix', paymentData: { payer: party('123.456.789-00'), receiver: party('12345678900') } }))).toBe(true)
    expect(isOwnTransfer(tx({ description: 'Pix', paymentData: { payer: party('123.456.789-00'), receiver: party('987.654.321-00') } }))).toBe(false)
    expect(isOwnTransfer(tx({ description: 'Transferência recebida pelo Pix|ANA PAULA RIBEIRO' }), me)).toBe(true)
    expect(isOwnTransfer(tx({ description: 'Transferência recebida pelo Pix|ANA SOUZA' }), me)).toBe(false)
  })
  it('só o primeiro nome não basta, e uma compra em loja com o mesmo nome não é transferência', () => {
    expect(mentionsName('Pix de Ana Ribeiro', 'Ana')).toBe(false)
    expect(mentionsName('Pix de Ana Carolina', 'Ana Paula Ribeiro')).toBe(false)
    expect(isOwnTransfer(tx({ description: 'Compra no débito|ANA RIBEIRO MODAS' }), me)).toBe(false)
  })
  it('entra no extrato marcada, nos dois sentidos, e só na conta (não no cartão)', () => {
    expect(mapTransaction(tx({ description: 'Transferência enviada pelo Pix|ANA PAULA RIBEIRO', amount: -500 }), 'BANK', me)).toMatchObject({ kind: 'expense', own: true })
    expect(mapTransaction(tx({ description: 'Transferência recebida pelo Pix|ANA PAULA RIBEIRO', amount: 500 }), 'BANK', me)).toMatchObject({ kind: 'income', own: true })
    expect(mapTransaction(tx({ description: 'Transferência recebida pelo Pix|JOÃO SILVA', amount: 500 }), 'BANK', me)).toMatchObject({ own: false })
    expect(mapTransaction(tx({ description: 'Pix ANA PAULA RIBEIRO', amount: 80 }), 'CREDIT', me)).toMatchObject({ own: false })
  })
})

describe('o que conta no mês', () => {
  const none = new Set<string>()
  it('entrada do banco não vira renda sozinha: só conta se a pessoa já disse que conta', () => {
    const pix = { kind: 'income' as const, own: false, description: 'Pix de João Silva' }
    expect(countsInMonth(pix, none)).toBe(false)
    expect(countsInMonth(pix, new Set([countKey('Pix de João Silva')]))).toBe(true)
    // a regra de categoria (sem o prefixo) não faz a entrada contar
    expect(countsInMonth(pix, new Set([learnKey('Pix de João Silva')]))).toBe(false)
  })
  it('gasto conta, a não ser que a pessoa tenha tirado os daquele destino', () => {
    const out = { kind: 'expense' as const, own: false, description: 'Pix para Maria Souza' }
    expect(countsInMonth(out, none)).toBe(true)
    expect(countsInMonth(out, new Set([ignoreKey('Pix para Maria Souza')]))).toBe(false)
  })
  it('transferência entre contas próprias nunca conta', () => {
    expect(countsInMonth({ kind: 'expense', own: true, description: 'Pix para Ana' }, none)).toBe(false)
    expect(countsInMonth({ kind: 'income', own: true, description: 'Pix de Ana' }, new Set([countKey('Pix de Ana')]))).toBe(false)
  })
})

describe('cartão de crédito', () => {
  it('compra vira gasto; pagamento e estorno são ignorados', () => {
    expect(mapTransaction(tx({ description: 'UBER *TRIP', amount: 18.4 }), 'CREDIT')).toMatchObject({ kind: 'expense', type: 'dia', amount_cents: 1840, categoryHint: 'Transporte' })
    expect(mapTransaction(tx({ description: 'Pagamento recebido', amount: -500 }), 'CREDIT')).toBeNull()
    expect(mapTransaction(tx({ description: 'Estorno loja', amount: -30 }), 'CREDIT')).toBeNull()
  })
  it('parcela da compra vira "3/10" e as parcelas da mesma compra se juntam', () => {
    const m = mapTransaction(tx({ description: 'MAGAZINE LUIZA', amount: 150, creditCardMetadata: { installmentNumber: 3, totalInstallments: 10, purchaseDate: '2026-09-02T00:00:00Z' } }), 'CREDIT')
    expect(m).toMatchObject({ type: 'parcela', installment_no: 3, installment_total: 10, installmentKey: 'magazine luiza|2026-09-02|10' })
  })
})

describe('categorias', () => {
  it('sugere pela descrição ou pela categoria do Open Finance', () => {
    expect(categoryHint(tx({ description: 'NETFLIX.COM' }), 'expense')).toBe('Assinaturas')
    expect(categoryHint(tx({ description: 'Compra', category: 'Groceries' }), 'expense')).toBe('Mercado')
    expect(categoryHint(tx({ description: 'SHOPEE *LOJA' }), 'expense')).toBe('Compras online')
    expect(categoryHint(tx({ description: 'Loja qualquer' }), 'expense')).toBeNull()
    expect(categoryHint(tx({ description: 'Salário EMPRESA LTDA' }), 'income')).toBe('Salário')
  })
  it('chave para aprender a categoria corrigida: pela loja ou pessoa, não pelo "Pix para"', () => {
    expect(learnKey('UBER *TRIP 8842 HELP.UBER.COM')).toBe('uber trip')
    expect(learnKey('Pão de Açúcar 123')).toBe('pao acucar')
    expect(learnKey('Pix para Maria Aparecida Coutinho')).toBe('maria aparecida')
    expect(learnKey('Pix para Caren Coutinho')).not.toBe(learnKey('Pix para Maria Aparecida Coutinho'))
  })
  it('limpa a descrição (inclusive o formato do Nubank "tipo|quem")', () => {
    expect(cleanDescription('  PAGTO   CONTA VIVO ')).toBe('Pagto Conta Vivo')
    expect(cleanDescription('Mercado Livre')).toBe('Mercado Livre')
    expect(cleanDescription('Transferência enviada pelo Pix|MARIA APARECIDA COUTINHO')).toBe('Pix para Maria Aparecida Coutinho')
    expect(cleanDescription('Transferência enviada pelo Pix|12.345.678 MARIA APARECIDA GO')).toBe('Pix para Maria Aparecida Go')
    expect(cleanDescription('Transferência recebida pelo Pix|João Silva')).toBe('Pix de João Silva')
    expect(cleanDescription('Compra no débito|PADARIA BOM PAO')).toBe('Padaria Bom Pao')
  })
  it('mercado pelo nome da empresa no Pix', () => {
    expect(categoryHint(tx({ description: 'Transferência enviada pelo Pix|COMPANHIA BRASILEIRA DE DISTR' }), 'expense')).toBe('Mercado')
  })
})

describe('sem duplicar com o que o app já lança sozinho', () => {
  it('reconhece o salário (até 15% e 6 dias de diferença)', () => {
    const salary = { amount_cents: 211300, date: '2026-11-05' }
    expect(isSalaryMatch({ kind: 'income', amount_cents: 211300, date: '2026-11-06' }, salary)).toBe(true)
    expect(isSalaryMatch({ kind: 'income', amount_cents: 15000, date: '2026-11-05' }, salary)).toBe(false)
    expect(isSalaryMatch({ kind: 'income', amount_cents: 211300, date: '2026-11-20' }, salary)).toBe(false)
  })
  it('descobre de qual mês é o salário, mesmo quando cai antes ou depois da virada do mês', () => {
    expect(paydayIn('2026-02', 31)).toBe('2026-02-28')
    expect(paydayIn('2026-11', 5)).toBe('2026-11-05')
    expect(salaryMonths({ kind: 'income', amount_cents: 200000, date: '2026-11-06' }, 210000, 5)).toEqual(['2026-11'])
    // dia do pagamento 30, caiu no dia 2 do mês seguinte: é o salário do mês anterior
    expect(salaryMonths({ kind: 'income', amount_cents: 210000, date: '2026-12-02' }, 210000, 30)).toEqual(['2026-11'])
    // dia do pagamento 1, adiantado para o dia 29: é o salário do mês seguinte
    expect(salaryMonths({ kind: 'income', amount_cents: 210000, date: '2026-11-29' }, 210000, 1)).toEqual(['2026-12'])
    expect(salaryMonths({ kind: 'income', amount_cents: 40000, date: '2026-11-05' }, 210000, 5)).toEqual([])
    expect(salaryMonths({ kind: 'income', amount_cents: 210000, date: '2026-11-05' }, null, 5)).toEqual([])
  })
  it('gasto que a pessoa já lançou à mão não entra de novo (mesmo valor, até 2 dias)', () => {
    const manual = [
      { id: 'a', amount_cents: 4290, date: '2026-11-04' },
      { id: 'b', amount_cents: 4290, date: '2026-11-06' },
      { id: 'c', amount_cents: 1000, date: '2026-11-06' },
    ]
    const buy = { kind: 'expense' as const, type: 'dia' as const, amount_cents: 4290, date: '2026-11-06' }
    expect(findManualMatch(buy, manual)?.id).toBe('b')
    expect(findManualMatch({ ...buy, date: '2026-11-09' }, manual)).toBeNull()
    expect(findManualMatch({ ...buy, amount_cents: 4291 }, manual)).toBeNull()
    // parcela e entrada não se juntam com gasto lançado à mão
    expect(findManualMatch({ ...buy, type: 'parcela' }, manual)).toBeNull()
    expect(findManualMatch({ ...buy, kind: 'income', type: 'extra' }, manual)).toBeNull()
  })
  it('acha o fixo em aberto que o gasto está pagando', () => {
    const fixed = [
      { id: 'tel', amount_cents: 3900, date: '2026-11-15', paid: false, external_id: null },
      { id: 'casa', amount_cents: 50000, date: '2026-11-10', paid: false, external_id: null },
      { id: 'pago', amount_cents: 3900, date: '2026-11-15', paid: true, external_id: null },
    ]
    expect(findFixedMatch({ kind: 'expense', amount_cents: 3990, date: '2026-11-13' }, fixed)?.id).toBe('tel')
    expect(findFixedMatch({ kind: 'expense', amount_cents: 7000, date: '2026-11-13' }, fixed)).toBeNull()
  })
})

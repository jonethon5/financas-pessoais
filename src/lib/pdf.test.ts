import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { statementPDF } from './pdf'

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36), user_id: 'u', kind: 'expense', type: 'dia', amount_cents: 4290, date: '2026-11-06', description: 'IFOOD *RESTAURANTE',
  category_id: null, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, paid: true, skipped: false, note: null, created_at: '', ...p,
})

describe('extrato em PDF', () => {
  it('gera um PDF de verdade, com acentos, entradas, saídas e o que não conta', async () => {
    const blob = await statementPDF({
      txs: [
        tx({ kind: 'income', type: 'salario', amount_cents: 210000, date: '2026-11-05', description: 'Salário' }),
        tx({}),
        tx({ kind: 'income', type: 'extra', amount_cents: 80000, description: 'Transferência Recebida|JOÃO DA SILVA', skipped: true, bank_account_id: 'c' }),
      ],
      categories: [],
      accounts: [{ id: 'c', type: 'BANK', name: 'Conta', short: 'Neon conta' }],
      period: 'Novembro de 2026',
      person: 'Ana',
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)
  })
})

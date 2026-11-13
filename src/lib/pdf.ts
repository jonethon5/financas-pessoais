/**
 * Extrato em PDF, gerado no aparelho (nada vai para a internet). A biblioteca de PDF só é baixada
 * quando a pessoa exporta, para não pesar na abertura do app.
 */
import type { BankAccount, Category, Transaction } from '../types'
import { APP_NAME } from '../brand'
import { METHOD_LABEL, methodOf, statementTotals, txText } from './statement'

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brDate = (iso: string) => iso.split('-').reverse().join('/')

// A fonte padrão do PDF só tem os caracteres do português (Latin-1): travessões viram "-" e o resto que não cabe sai
const DASHES = new Set([0x2212, 0x2013, 0x2014])
const KEEP_EXTRA = new Set([10, 0x2026, 0xb7])
function safe(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (DASHES.has(c)) out += '-'
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || KEEP_EXTRA.has(c)) out += ch
  }
  return out
}

export type StatementPdfInput = {
  txs: Transaction[]
  categories: Category[]
  accounts: (Pick<BankAccount, 'id' | 'type' | 'name'> & { short?: string })[]
  /** ex.: "Novembro de 2026" ou "01/10/2026 a 13/11/2026" */
  period: string
  /** ex.: "Nubank cartão" quando o extrato é de uma conta só */
  accountLabel?: string | null
  person?: string | null
}

export async function statementPDF(input: StatementPdfInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const blue: [number, number, number] = [47, 111, 235]
  const ink: [number, number, number] = [15, 36, 51]
  const muted: [number, number, number] = [91, 107, 122]
  const green: [number, number, number] = [11, 127, 90]

  // Cabeçalho azul
  doc.setFillColor(...blue)
  doc.rect(0, 0, W, 86, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(safe(APP_NAME), M, 38)
  doc.setFontSize(13)
  doc.text('Extrato', M, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(safe(input.period + (input.accountLabel ? ` · ${input.accountLabel}` : '')), W - M, 38, { align: 'right' })
  doc.text(safe(`Gerado em ${new Date().toLocaleDateString('pt-BR')}${input.person ? ` para ${input.person}` : ''}`), W - M, 54, { align: 'right' })

  // Resumo: só o que conta no mês
  const totals = statementTotals(input.txs.filter((t) => !t.skipped))
  const result = totals.income - totals.expense
  const boxes: [string, string, [number, number, number]][] = [
    ['Entrou', `+ R$ ${brl(totals.income)}`, green],
    ['Saiu', `- R$ ${brl(totals.expense)}`, [190, 36, 46]],
    ['Resultado', `${result < 0 ? '- ' : ''}R$ ${brl(Math.abs(result))}`, ink],
  ]
  const bw = (W - 2 * M - 16) / 3
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (bw + 8)
    doc.setDrawColor(222, 228, 235)
    doc.setFillColor(246, 248, 251)
    doc.roundedRect(x, 104, bw, 50, 8, 8, 'FD')
    doc.setTextColor(...muted)
    doc.setFontSize(9)
    doc.text(label, x + 12, 122)
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(value, x + 12, 142)
    doc.setFont('helvetica', 'normal')
  })

  const cat = new Map(input.categories.map((c) => [c.id, c.name]))
  const rows = [...input.txs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map((t) => {
      const text = txText(t.description)
      const account = input.accounts.find((a) => a.id === t.bank_account_id)
      const where = account ? (account.short ?? account.name) : METHOD_LABEL[methodOf(t, input.accounts)]
      const lines = [`${text.title}${t.installment_no ? ` ${t.installment_no}/${t.installment_total}` : ''}`, text.detail, t.skipped ? 'Não conta no mês' : null].filter(Boolean)
      return {
        skipped: t.skipped,
        income: t.kind === 'income',
        cells: [brDate(t.date), safe(lines.join('\n')), safe(t.type === 'salario' ? 'Salário' : (cat.get(t.category_id ?? '') ?? '')), safe(where), `${t.kind === 'income' ? '+' : '-'} ${brl(t.amount_cents)}`],
      }
    })

  autoTable(doc, {
    startY: 172,
    margin: { left: M, right: M, bottom: 44 },
    head: [['Data', 'Descrição', 'Categoria', 'Conta', 'Valor (R$)']],
    body: rows.map((r) => r.cells),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: ink, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }, lineColor: [230, 234, 239], lineWidth: { bottom: 0.6 } },
    headStyles: { textColor: muted, fontStyle: 'bold', fontSize: 8.5, lineWidth: { bottom: 1 }, lineColor: [200, 208, 218] },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 82 }, 3: { cellWidth: 92 }, 4: { cellWidth: 74, halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (r.skipped) data.cell.styles.textColor = [150, 160, 170]
      else if (data.column.index === 4) data.cell.styles.textColor = r.income ? green : ink
    },
    didDrawPage: () => {
      const H = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(...muted)
      doc.text(safe('Itens "não conta" (transferências entre suas contas, entradas do banco, fatura e caixinha) ficam fora dos totais.'), M, H - 22)
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, W - M, H - 22, { align: 'right' })
    },
  })

  if (!rows.length) {
    doc.setTextColor(...muted)
    doc.setFontSize(11)
    doc.text('Nenhum lançamento neste período.', M, 200)
  }
  return doc.output('blob')
}

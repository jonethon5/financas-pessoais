import type { ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAccounts } from '../data/accounts'
import { formatDayLong } from '../lib/dates'
import { isTransfer, movementOf, titleCase, txTitle } from '../lib/statement'
import type { Category, Transaction } from '../types'
import { FromAccount } from './FromAccount'
import { TxIcon } from './TxIcon'
import { Money } from './ui'

/**
 * O lançamento como o banco mostra (inspirado no detalhe do Pix do Nubank): enviado ou recebido, valor,
 * para quem / de quem, dia e hora, de qual conta e o nome original (mesmo se a pessoa renomeou).
 */
export function BankDetail({
  tx,
  category,
  description,
  onUseOriginal,
}: {
  tx: Transaction
  category: Category | undefined
  /** nome que está no campo agora (para saber se foi renomeado) */
  description: string
  onUseOriginal: (name: string) => void
}) {
  const accounts = useAccounts()
  const mv = movementOf(tx, accounts.raw)
  const out = mv.flow === 'saida'
  const Arrow = out ? ArrowUpRight : ArrowDownLeft
  const info = tx.bank_info
  const day = formatDayLong(tx.date)
  const when = `${day.charAt(0).toUpperCase()}${day.slice(1)} de ${tx.date.slice(0, 4)}${info?.time ? `, às ${info.time}` : ''}`
  const original = info?.original ?? null
  const renamed = original != null && description.trim() !== original

  const line = (label: string, value: ReactNode, action?: ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2.5">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-muted">{label}</p>
        <div className="mt-0.5 break-words">{value}</div>
      </div>
      {action}
    </div>
  )

  return (
    <section className="shadow-soft rounded-[1.25rem] bg-surface px-4 pt-4 pb-1.5" aria-label="Detalhes do banco">
      <div className="flex items-start gap-3">
        <TxIcon size="md" description={tx.description} category={category} flow={isTransfer(tx, accounts.raw) ? mv.flow : null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold">{txTitle({ description, bank_info: info })}</p>
          <p className={`num mt-0.5 text-[1.75rem] leading-tight font-bold ${out ? '' : 'text-primary-strong'}`}>
            {out ? '− ' : '+ '}
            <Money cents={tx.amount_cents} />
          </p>
        </div>
      </div>
      <div className="mt-3 mb-3 flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.875rem] font-semibold ${out ? 'bg-surface-2 text-ink' : 'bg-grow/15 text-primary-strong'}`}>
          <Arrow className="size-4" strokeWidth={2.6} aria-hidden />
          {mv.label}
        </span>
        {tx.skipped && <span className="inline-flex items-center rounded-full bg-warn-soft px-2.5 py-1 text-[0.875rem] font-semibold text-warn-strong">Não conta no mês</span>}
      </div>
      {info?.party && line(out ? 'Para quem foi' : 'De quem veio', <span className="font-semibold">{titleCase(info.party)}</span>)}
      {line('Quando', when)}
      {tx.bank_account_id && line('Conta', <FromAccount info={accounts.byId(tx.bank_account_id)} />)}
      {original &&
        line(
          'Nome no banco',
          <span className="text-[0.9375rem]">{original}</span>,
          renamed ? (
            <button type="button" onClick={() => onUseOriginal(original)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[0.875rem] font-semibold text-primary-strong active:bg-line">
              Usar este nome
            </button>
          ) : null,
        )}
    </section>
  )
}

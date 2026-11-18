import type { ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAccounts } from '../data/accounts'
import { useCategories, useMonthTxs, useWrite } from '../data/finance'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../data/hooks'
import { applyAsSalary } from './IncomeTriage'
import { useToast } from './Toast'
import { formatDayLong, monthOf } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { isTransfer, movementOf, partyOf, passThroughOf, readableBankName, txTitle } from '../lib/statement'
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
  counts,
  onNotCount,
}: {
  tx: Transaction
  category: Category | undefined
  /** nome que está no campo agora (para saber se foi renomeado) */
  description: string
  onUseOriginal: (name: string) => void
  /** "Contar como gasto/renda" ligado agora (no formulário) */
  counts?: boolean
  /** desliga o "Contar" (botão do aviso de repasse) */
  onNotCount?: () => void
}) {
  const month = useMonthTxs(monthOf(tx.date))
  const write = useWrite()
  const profile = useProfile()
  const { userId } = useAuth()
  const categories = useCategories()
  const toast = useToast()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const mv = movementOf(tx, accounts.raw)
  const out = mv.flow === 'saida'
  const Arrow = out ? ArrowUpRight : ArrowDownLeft
  const info = tx.bank_info
  const day = formatDayLong(tx.date)
  const when = `${day.charAt(0).toUpperCase()}${day.slice(1)} de ${tx.date.slice(0, 4)}${info?.time ? `, às ${info.time}` : ''}`
  const original = info?.original ?? null
  const renamed = original != null && description.trim() !== original
  const party = partyOf(tx)
  const pass = passThroughOf(tx, (month.data ?? []).filter((t) => !('virtual' in t && t.virtual)))
  const passWho = pass ? partyOf(pass.other) : null
  const passWhen = pass ? (pass.minutes == null ? 'no mesmo dia' : pass.minutes < 60 ? `${pass.minutes} min ${out ? 'antes' : 'depois'}` : `${Math.round(pass.minutes / 60)} h ${out ? 'antes' : 'depois'}`) : ''

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
      {party && line(out ? 'Para quem foi' : 'De quem veio', <span className="font-semibold">{party}</span>)}
      {line('Quando', when)}
      {tx.bank_account_id && line('Conta', <FromAccount info={accounts.byId(tx.bank_account_id)} />)}
      {original &&
        line(
          'Nome no banco',
          <span className="text-[0.9375rem]">{readableBankName(original)}</span>,
          renamed ? (
            <button type="button" onClick={() => onUseOriginal(original)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[0.875rem] font-semibold text-primary-strong active:bg-line">
              Usar este nome
            </button>
          ) : null,
        )}
      {!out && tx.type === 'extra' && userId && (
        <button
          type="button"
          disabled={write.isPending}
          onClick={async () => {
            let how = 'replaced' as 'replaced' | 'added'
            await write.mutateAsync(async (b) => {
              how = await applyAsSalary(b, tx, userId, (categories.data ?? []).find((c) => c.kind === 'income' && c.name === 'Salário')?.id ?? null, profile.data?.payday ?? null)
            })
            toast(how === 'added' ? 'Somado ao salário do mês. Os próximos dessa empresa já entram como salário.' : 'É o salário do mês, no lugar do previsto. Os próximos dessa empresa já entram como salário.')
            navigate(-1)
          }}
          className="mt-1 mb-3 w-full rounded-full bg-surface-2 px-4 py-2.5 text-left text-[0.9375rem] font-semibold active:bg-line"
        >
          Este é o meu salário <span className="font-normal text-muted">(ou parte dele)</span>
        </button>
      )}
      {pass && (
        <div className="mt-1 mb-3 rounded-[1rem] bg-warn-soft p-3.5">
          <p className="font-semibold">Parece um repasse</p>
          <p className="mt-1 text-[0.9375rem] leading-snug">
            {out
              ? `Você recebeu ${formatBRL(pass.other.amount_cents)}${passWho ? ` de ${passWho}` : ''} ${passWhen}${pass.other.bank_info?.time ? ` (às ${pass.other.bank_info.time})` : ''}. Se esse dinheiro só passou por você, não é gasto seu.`
              : `Você mandou o mesmo valor${passWho ? ` para ${passWho}` : ''} ${passWhen}. Se esse dinheiro só passou por você, não é renda sua.`}
          </p>
          {onNotCount && counts && (
            <button type="button" onClick={onNotCount} className="mt-2.5 rounded-full bg-surface px-3.5 py-2 text-[0.9375rem] font-semibold text-ink active:bg-surface-2">
              {out ? 'Não contar como gasto' : 'Não contar como renda'}
            </button>
          )}
          {onNotCount && !counts && <p className="mt-2 text-[0.875rem] font-semibold">Desligado: toque em Salvar para valer.</p>}
        </div>
      )}
    </section>
  )
}

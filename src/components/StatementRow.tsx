import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { AccountInfo } from '../data/accounts'
import { merchantLogo, merchantOf } from '../lib/merchants'
import { installmentLabel } from '../lib/installments'
import { isTransfer, methodShort, movementOf, notCountedShort, txTitle } from '../lib/statement'
import type { BankAccount, Category, Transaction } from '../types'
import { BankLogo } from './BankLogo'
import { DuoIcon } from './CategoryIcon'
import { Money } from './ui'

/** Ícone redondo e grande da linha (logo da empresa ou o da categoria), com a setinha de enviado/recebido. */
function RoundIcon({ t, category, flow }: { t: Transaction; category: Category | undefined; flow: 'saida' | 'entrada' | null }) {
  const merchant = merchantOf(t.bank_info?.original ?? t.description)
  const [failed, setFailed] = useState(false)
  const color = category?.color ?? '#5B6B7A'
  const Arrow = flow === 'saida' ? ArrowUpRight : ArrowDownLeft
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      {merchant && !failed ? (
        <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-line">
          <img src={merchantLogo(merchant)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-[62%] object-contain" />
        </span>
      ) : (
        <span className="grid size-12 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))` }}>
          <DuoIcon name={category?.icon} color={color} size={24} />
        </span>
      )}
      {flow && (
        <span aria-hidden className={`absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full ring-2 ring-bg ${flow === 'saida' ? 'bg-ink text-on-ink' : 'bg-grow text-white'}`}>
          <Arrow className="size-3" strokeWidth={3} />
        </span>
      )}
    </span>
  )
}

/**
 * Uma linha do extrato, no jeito dos apps de banco: ícone redondo, nome, "hora · Pix · banco" embaixo,
 * valor à direita (verde e com "+" só o que entrou) e, embaixo do valor, se não conta no mês (ex.: "Fatura").
 */
export function StatementRow({ t, category, accounts, account }: { t: Transaction; category: Category | undefined; accounts: Pick<BankAccount, 'id' | 'type'>[]; account: AccountInfo | null }) {
  const mv = movementOf(t, accounts)
  const income = t.kind === 'income'
  const method = methodShort(t, accounts)
  const tag = notCountedShort(t)
  const meta = [t.bank_info?.time ?? null, method ?? category?.name ?? 'Lançado à mão'].filter(Boolean).join(' · ')
  return (
    <li>
      <Link to={`/lancamento/${t.id}`} className="flex items-center gap-3.5 py-3.5 transition active:opacity-70">
        <RoundIcon t={t} category={category} flow={isTransfer(t, accounts) ? mv.flow : null} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-medium">
            {txTitle(t)}
            {t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[0.9375rem] text-muted">
            <span className="truncate">{meta}</span>
            {account && (
              <>
                <span aria-hidden>·</span>
                <BankLogo inst={account.inst} credit={account.kind === 'cartao'} size="xs" />
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`num block text-[1.0625rem] whitespace-nowrap ${income ? 'font-semibold text-income' : t.skipped ? 'text-muted' : 'font-semibold'}`}>
            {income ? '+ ' : ''}
            <Money cents={t.amount_cents} />
          </span>
          {tag && <span className="block text-[0.8125rem] text-muted">{tag}</span>}
        </span>
      </Link>
    </li>
  )
}

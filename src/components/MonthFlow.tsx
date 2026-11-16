import { useState } from 'react'
import { Link } from 'react-router'
import { IncomeTriage } from './IncomeTriage'
import { AlertTriangle } from 'lucide-react'
import { useAccounts } from '../data/accounts'
import { cardBills, dueText, spendSplit, uncountedIncome } from '../lib/bills'
import type { MonthSummary } from '../lib/budget'
import { formatDateShort, todayISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { useHiddenValues } from '../lib/privacy'
import type { Transaction } from '../types'
import { BankLogo } from './BankLogo'
import { Money } from './ui'

const PARTS = [
  { key: 'gastos', label: 'Gastos', color: 'var(--viz-2)' },
  { key: 'caixinhas', label: 'Caixinhas', color: 'var(--viz-3)' },
  { key: 'sobra', label: 'Sobra', color: 'var(--viz-1)' },
] as const

/**
 * A conta do mês, sempre igual em todo o app: renda − gastos − caixinhas = sobra.
 * Com os lançamentos (`txs`), os gastos aparecem separados pelo jeito que saem do bolso: fixos, parcelas,
 * cartão de crédito, Pix e débito. Embaixo, uma barra mostra para onde vai cada real da renda e, no mês atual,
 * as faturas dos cartões para pagar (com alerta perto do vencimento).
 */
export function MonthFlow({ s, txs, current = false }: { s: MonthSummary; txs?: Transaction[]; current?: boolean }) {
  const hidden = useHiddenValues()
  const accounts = useAccounts()
  const split = txs ? spendSplit(txs, accounts.raw) : null
  const uncounted = txs ? uncountedIncome(txs) : { cents: 0, count: 0 }
  // Fatura já paga (pagamento nos lançamentos do cartão) não aparece: mostra a próxima
  const bills = current ? cardBills(accounts.raw, todayISO(), txs ?? []) : []
  const [triage, setTriage] = useState(false)
  const spent = s.committed + s.daily
  const over = s.free < 0
  const values = { gastos: spent, caixinhas: s.save, sobra: Math.max(0, s.free) }
  const base = Math.max(s.income, spent + s.save)
  const pct = (c: number) => (base ? Math.round((c / base) * 100) : 0)

  const line = (label: string, hint: string | null, cents: number, op: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {hint && <span className="block text-[0.8125rem] text-muted">{hint}</span>}
      </span>
      <span className="num shrink-0 text-[1rem] font-semibold">
        <span className="mr-1 text-muted">{op}</span>
        <Money cents={cents} />
      </span>
    </div>
  )

  // Enquanto tem dinheiro que entrou sem resposta, a conta ainda não está fechada: nada de vermelho, nada de dois totais
  const pending = uncounted.count > 0
  return (
    <div>
      {pending && (
        <div className="mb-3 rounded-[1rem] bg-warn-soft p-3.5">
          <p className="font-semibold">
            {uncounted.count} {uncounted.count === 1 ? 'entrada para conferir' : 'entradas para conferir'}
          </p>
          <p className="mt-0.5 text-[0.9375rem] leading-snug">
            {hidden ? 'R$ ••••' : formatBRL(uncounted.cents)} entraram pelo banco e o app ainda não sabe o que são: salário, dinheiro da poupança ou repasse. Até você dizer, a conta usa só o salário cadastrado.
          </p>
          <button type="button" onClick={() => setTriage(true)} className="press mt-2.5 rounded-full bg-ink px-4 py-2 text-[0.9375rem] font-semibold text-on-ink">
            Conferir agora
          </button>
        </div>
      )}
      {line('Entra no mês', 'salário e o que você marcou como renda', s.income, '+')}
      {split ? (
        <>
          {split.fixed > 0 && line('Gastos fixos', 'aluguel, contas, assinaturas', split.fixed, '−')}
          {split.installments > 0 && line('Parcelas', 'compras parceladas', split.installments, '−')}
          {split.card > 0 && line('No cartão de crédito', 'compras do mês: você paga na fatura', split.card, '−')}
          {split.account > 0 && line('No Pix e débito', 'saiu da conta na hora', split.account, '−')}
          {split.manual > 0 && line('Lançados à mão', null, split.manual, '−')}
        </>
      ) : (
        line('Gastos', 'contas fixas, parcelas e dia a dia', spent, '−')
      )}
      {s.save > 0 && line('Para as caixinhas', 'o que você combinou guardar', s.save, '−')}
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
        <span className="text-[0.9375rem] font-bold">{pending ? (over ? 'Por enquanto, faltam' : 'Por enquanto, sobram') : over ? 'Faltam no mês' : 'Sobra prevista'}</span>
        <span className={`num text-[1.375rem] leading-tight font-extrabold tracking-[-0.02em] ${pending ? 'text-ink' : over ? 'text-danger-strong' : 'text-primary-strong'}`}>
          <Money cents={Math.abs(s.free)} />
        </span>
      </div>

      {over && !pending && (
        <p className="mt-2 text-[0.9375rem] leading-snug">
          Saiu mais do que entrou este mês.{' '}
          <Link to="/saude" className="font-semibold text-primary-strong">
            Ver onde dá para cortar
          </Link>
        </p>
      )}

      {base > 0 && !over && (
        <div className="mt-3.5">
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={PARTS.map((p) => `${p.label} ${pct(values[p.key])}%`).join(', ')}>
            {PARTS.map((p) =>
              values[p.key] > 0 ? <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(values[p.key] / base) * 100}%`, background: p.color }} /> : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
            {PARTS.map((p) => (
              <li key={p.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.label} <span className="num font-semibold text-ink">{pct(values[p.key])}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bills.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Para pagar</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {bills.map((b) => {
              const info = accounts.byId(b.accountId)
              return (
                <li key={b.accountId}>
                  <Link
                    to={`/voce/bancos/${b.accountId}`}
                    className={`flex items-center gap-3 rounded-[0.875rem] px-3 py-2.5 ${b.urgent ? 'bg-warn-soft' : 'bg-surface-2'}`}
                  >
                    {b.urgent ? <AlertTriangle className="size-5 shrink-0 text-warn-strong" aria-hidden /> : info ? <BankLogo inst={info.inst} credit size="xs" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">Fatura {info ? info.short : 'do cartão'}</span>
                      <span className={`block text-[0.8125rem] ${b.urgent ? 'font-semibold text-warn-strong' : 'text-muted'}`}>
                        {dueText(b.daysUntil)}
                        {b.dueDate ? ` (${formatDateShort(b.dueDate)})` : ''}
                      </span>
                    </span>
                    <span className="num shrink-0 font-bold">
                      <Money cents={b.amountCents} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted">As compras do cartão já estão nos gastos acima. A fatura é o dia de pagar: separe esse dinheiro na conta.</p>
        </div>
      )}
      {triage && txs && <IncomeTriage txs={txs} onClose={() => setTriage(false)} />}
    </div>
  )
}

/**
 * O mês em 3 números para a tela inicial: o que entrou, o que saiu e o que sobra (ou falta).
 * O detalhe (fixos, parcelas, cartão, Pix, faturas) fica na aba Mês.
 */
export function MonthGlance({ s, pending = false }: { s: MonthSummary; pending?: boolean }) {
  const out = s.committed + s.daily + s.save
  const over = s.free < 0
  const row = (label: string, cents: number, op: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[0.9375rem] text-muted">{label}</span>
      <span className="num font-semibold">
        <span className="mr-1 text-muted">{op}</span>
        <Money cents={cents} />
      </span>
    </div>
  )
  return (
    <div>
      {row('Entrou', s.income, '+')}
      {row(s.save > 0 ? 'Saiu (gastos e caixinhas)' : 'Saiu', out, '−')}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <span className="font-bold">{pending ? (over ? 'Por enquanto, falta' : 'Por enquanto, sobra') : over ? 'Falta no mês' : 'Sobra no mês'}</span>
        <span className={`num text-[1.375rem] leading-tight font-extrabold tracking-[-0.02em] ${pending ? 'text-ink' : over ? 'text-danger-strong' : 'text-primary-strong'}`}>
          <Money cents={Math.abs(s.free)} />
        </span>
      </div>
    </div>
  )
}

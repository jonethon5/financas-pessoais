import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { AccountInfo } from '../data/accounts'
import { formatDateShort } from '../lib/dates'
import { BankLogo } from './BankLogo'
import { Money } from './ui'

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

type Tile = {
  key: string
  to: string
  info: AccountInfo
  label: string
  kind: string
  cents: number
  /** linha de baixo (vencimento, limite, cheque especial…) */
  foot?: React.ReactNode
  /** 0 a 1: quanto do limite do cartão está usado */
  used?: number | null
}

/**
 * Contas e cartões juntos, como uma carteira: cada conta e cada cartão vira um cartãozinho na cor do banco,
 * lado a lado (arrasta para o lado). Em cima, o resumo separa o que é seu (na conta e guardado)
 * do que você deve (faturas e cheque especial). Limite de crédito não aparece como dinheiro seu.
 */
export function Wallet({ accounts }: { accounts: AccountInfo[] }) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const cartoes = accounts.filter((a) => a.kind === 'cartao')
  const guardados = accounts.filter((a) => a.kind === 'guardado')
  if (!contas.length && !cartoes.length && !guardados.length) return null

  const naConta = sum(contas.map((a) => a.account.balance_cents))
  const guardado = sum(guardados.map((a) => a.account.balance_cents))
  const faturas = sum(cartoes.map((a) => a.account.balance_cents))
  const cheque = sum(contas.map((a) => a.account.overdraft_used_cents))
  const sobra = naConta + guardado - faturas - cheque

  // Guardado: um cartãozinho por banco (o Nubank, por exemplo, tem várias caixinhas)
  const savingsByBank = new Map<string, { info: AccountInfo; cents: number; count: number }>()
  for (const g of guardados) {
    const k = g.inst?.key ?? g.account.connection_id
    const cur = savingsByBank.get(k) ?? { info: g, cents: 0, count: 0 }
    cur.cents += g.account.balance_cents ?? 0
    cur.count++
    savingsByBank.set(k, cur)
  }

  const tiles: Tile[] = [
    ...contas.map((c) => ({
      key: c.account.id,
      to: `/voce/bancos/${c.account.id}`,
      info: c,
      label: 'Saldo',
      kind: 'Conta',
      cents: c.account.balance_cents ?? 0,
      foot: c.account.overdraft_limit_cents ? (
        <>
          Cheque especial: <Money cents={Math.max(0, c.account.overdraft_limit_cents - (c.account.overdraft_used_cents ?? 0))} /> livre
        </>
      ) : c.account.invested_cents ? (
        <>
          <Money cents={c.account.invested_cents} /> rendendo na conta
        </>
      ) : undefined,
    })),
    ...cartoes.map((c) => {
      const limit = c.account.credit_limit_cents
      const used = limit ? Math.max(0, limit - (c.account.available_cents ?? 0)) / limit : null
      return {
        key: c.account.id,
        to: `/voce/bancos/${c.account.id}`,
        info: c,
        label: 'Fatura atual',
        kind: 'Cartão',
        cents: c.account.balance_cents ?? 0,
        used,
        foot: (
          <>
            {c.account.due_date ? `Vence ${formatDateShort(c.account.due_date)}` : 'Cartão de crédito'}
            {c.account.available_cents != null && (
              <>
                {' · '}livre <Money cents={c.account.available_cents} />
              </>
            )}
          </>
        ),
      }
    }),
    ...[...savingsByBank.entries()].map(([k, g]) => ({
      key: `guardado-${k}`,
      to: '/voce/bancos',
      info: g.info,
      label: 'Guardado',
      kind: 'Guardado',
      cents: g.cents,
      foot: g.count === 1 ? g.info.account.name : `${g.count} aplicações e caixinhas`,
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Na conta" cents={naConta} />
        <Stat label="Guardado" cents={guardado} />
        <Stat label={cheque ? 'Faturas e cheque' : 'Faturas'} cents={faturas + cheque} owe />
      </div>
      {(cartoes.length > 0 || cheque > 0) && (
        <p className="-mt-1.5 text-[0.875rem] leading-snug text-muted">
          Se pagasse as faturas hoje, {sobra >= 0 ? 'sobrariam' : 'faltariam'}{' '}
          <strong className={sobra >= 0 ? 'text-ink' : 'text-danger-strong'}>
            <Money cents={Math.abs(sobra)} />
          </strong>
          . Limite do cartão não é dinheiro seu.
        </p>
      )}

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {tiles.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className="press relative flex h-[9.75rem] w-[15rem] shrink-0 snap-start flex-col overflow-hidden rounded-[1.25rem] p-4 text-white shadow-[0_12px_26px_-16px_rgb(15_36_51/0.7)]"
            style={{ background: `linear-gradient(140deg, ${t.info.inst?.color ?? '#3E5468'}, color-mix(in srgb, ${t.info.inst?.color ?? '#3E5468'} 45%, #0B1620))` }}
          >
            <span aria-hidden className="absolute -top-12 -right-10 size-36 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-2">
              <span className="rounded-[0.6rem] bg-white p-0.5">
                <BankLogo inst={t.info.inst} credit={t.info.kind === 'cartao'} size="sm" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{t.info.inst?.name ?? t.info.account.name}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide uppercase">{t.kind}</span>
            </div>
            <div className="relative mt-auto">
              <p className="text-[0.8125rem] text-white/75">{t.label}</p>
              <p className="num text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
                <Money cents={t.cents} />
              </p>
              {t.used != null && (
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/25" role="img" aria-label={`${Math.round(t.used * 100)}% do limite usado`}>
                  <span className="block h-full rounded-full bg-white" style={{ width: `${Math.min(100, t.used * 100)}%` }} />
                </span>
              )}
              {t.foot && <p className="mt-1 truncate text-[0.75rem] text-white/80">{t.foot}</p>}
            </div>
          </Link>
        ))}
        <Link to="/voce/bancos" className="press flex h-[9.75rem] w-[7.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border-2 border-dashed border-line text-center text-[0.875rem] font-semibold text-muted">
          <span className="text-[1.5rem] leading-none text-primary">+</span>
          Conectar outro banco
        </Link>
      </div>
      <Link to="/extrato" className="-mt-1 flex items-center gap-1 self-start text-[0.9375rem] font-semibold text-primary">
        Ver o extrato de tudo <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  )
}

function Stat({ label, cents, owe }: { label: string; cents: number; owe?: boolean }) {
  return (
    <div className="rounded-[1rem] bg-surface px-3 py-2.5">
      <p className="truncate text-[0.8125rem] text-muted">{label}</p>
      <p className={`num truncate text-[1rem] font-bold ${owe && cents > 0 ? 'text-danger-strong' : ''}`}>
        {owe && cents > 0 ? '− ' : ''}
        <Money cents={cents} />
      </p>
    </div>
  )
}

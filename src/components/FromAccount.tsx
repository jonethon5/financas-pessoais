import type { AccountInfo } from '../data/accounts'
import { BankLogo } from './BankLogo'

/** Subtítulo "Hoje · [logo] Nubank cartão": de qual conta ou cartão veio o lançamento. */
export function FromAccount({ day, info, extra }: { day?: string | null; info: AccountInfo | null; extra?: string | null }) {
  const parts = [day, extra].filter(Boolean).join(' · ')
  if (!info) return <>{parts || 'Lançado à mão'}</>
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      {parts && <span className="shrink-0">{parts} ·</span>}
      <BankLogo inst={info.inst} credit={info.kind === 'cartao'} size="xs" />
      <span className="truncate">{info.short}</span>
    </span>
  )
}

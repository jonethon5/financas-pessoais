import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ArrowDown, ArrowUp, Export, MagnifyingGlass } from '@phosphor-icons/react'
import { BankLogo } from '../components/BankLogo'
import { FromAccount } from '../components/FromAccount'
import { MascotArt } from '../components/Pig'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { TxIcon } from '../components/TxIcon'
import { BackButton, Button, Card, ErrorBox, Field, List, Money, NavBar, Notice, Row, Segmented, Spinner } from '../components/ui'
import { useAccounts } from '../data/accounts'
import { useBackend } from '../data/backend'
import { useCategories, useMonthTxs } from '../data/finance'
import { useProfile } from '../data/hooks'
import { addMonths, currentYearMonth, firstDayISO, isValidISODate, lastDayISO, monthKey, monthLabel, parseMonthKey, relativeDay, todayISO } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { statementCSV, statementTotals, txText, filterStatement, type StatementView } from '../lib/statement'
import { friendlyError } from '../lib/supabase'
import { APP_NAME } from '../brand'
import type { Transaction } from '../types'

/** Baixa um arquivo gerado no aparelho (nada vai para a internet). */
function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * /extrato: tudo o que entrou e saiu no mês, de todas as contas e cartões (ou de um só), com busca.
 * "Entrou" e "Saiu" filtram na hora; "Não contam" mostra o que aparece mas não entra na conta do mês.
 */
export function StatementPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ym = parseMonthKey(params.get('mes')) ?? currentYearMonth()
  const viewParam = params.get('ver')
  const view: StatementView = viewParam === 'gastos' || viewParam === 'entradas' || viewParam === 'fora' ? viewParam : 'tudo'
  const accountId = params.get('conta')
  const [query, setQuery] = useState('')
  const [exporting, setExporting] = useState(false)
  const txs = useMonthTxs(ym)
  const categories = useCategories()
  const accounts = useAccounts()
  const today = todayISO()

  const set = (patch: Record<string, string | null>) => {
    const next: Record<string, string> = { mes: monthKey(ym), ver: view }
    if (accountId) next.conta = accountId
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) delete next[k]
      else next[k] = v
    }
    setParams(next, { replace: true })
  }

  const all = useMemo(() => (txs.data ?? []).filter((t) => !t.virtual), [txs.data])
  const cats = categories.data ?? []
  const shown = useMemo(() => filterStatement(all, { view, query, accountId }, cats), [all, view, query, accountId, cats])
  const counted = useMemo(() => filterStatement(all, { view: 'tudo', accountId }, cats), [all, accountId, cats])
  const outCount = useMemo(() => filterStatement(all, { view: 'fora', accountId }, cats).length, [all, accountId, cats])

  if (txs.isPending || categories.isPending) return <Spinner />
  if (txs.isError) return <ErrorBox message={friendlyError(txs.error)} onRetry={() => txs.refetch()} />

  const catOf = (id: string | null) => cats.find((c) => c.id === id)
  const selectable = accounts.list.filter((a) => a.kind !== 'guardado')
  const selected = accounts.byId(accountId)
  const totals = statementTotals(counted)
  const days = [...new Set(shown.map((t) => t.date))]

  const row = (t: Transaction): ReactNode => {
    const text = txText(t.description)
    const extra = [t.type === 'salario' ? 'Salário' : (text.detail ?? catOf(t.category_id)?.name), t.skipped ? 'não conta' : null].filter(Boolean).join(' · ')
    const income = t.kind === 'income'
    return (
      <Row
        key={t.id}
        icon={<TxIcon description={t.description} category={catOf(t.category_id)} />}
        title={`${text.title}${t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}`}
        subtitle={<FromAccount info={accounts.byId(t.bank_account_id)} extra={extra || null} />}
        trailing={
          <span className={`num text-[1.0625rem] whitespace-nowrap ${t.skipped ? 'text-muted' : income ? 'font-semibold text-primary-strong' : ''}`}>
            {income ? '+ ' : '− '}
            <Money cents={t.amount_cents} />
          </span>
        }
        as={(c, cls) => (
          <Link to={`/lancamento/${t.id}`} className={cls}>
            {c}
          </Link>
        )}
      />
    )
  }

  const kpi = (which: 'entradas' | 'gastos', label: string, cents: number) => {
    const on = view === which
    const Icon = which === 'entradas' ? ArrowDown : ArrowUp
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => set({ ver: on ? 'tudo' : which })}
        className={`press flex flex-col gap-1 rounded-[1.1rem] border-2 px-3.5 py-3 text-left transition-colors ${on ? 'border-ink bg-surface' : 'shadow-soft border-transparent bg-surface'}`}
      >
        <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-muted">
          <Icon size={14} weight="bold" className={which === 'entradas' ? 'text-primary-strong' : 'text-danger-strong'} aria-hidden />
          {label}
          {on && <span className="ml-auto text-[0.75rem] text-primary">filtrando</span>}
        </span>
        <span className={`num truncate text-[1.125rem] font-bold ${which === 'entradas' ? 'text-primary-strong' : ''}`}>
          {which === 'entradas' ? '+ ' : '− '}
          <Money cents={cents} />
        </span>
      </button>
    )
  }

  return (
    <>
      <NavBar title="Extrato" left={<BackButton onClick={() => navigate(-1)} />} />
      <div className="flex flex-col gap-4">
        <div className="shadow-soft flex items-center justify-between rounded-[1rem] bg-surface px-1 py-1">
          <button type="button" aria-label="Mês anterior" onClick={() => set({ mes: monthKey(addMonths(ym, -1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronLeft className="size-6" />
          </button>
          <p className="text-[1.0625rem] font-bold">{monthLabel(ym)}</p>
          <button type="button" aria-label="Próximo mês" onClick={() => set({ mes: monthKey(addMonths(ym, 1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronRight className="size-6" />
          </button>
        </div>

        {selectable.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Escolher conta ou cartão">
            <AccountPill on={!accountId} onClick={() => set({ conta: null })}>
              Todas
            </AccountPill>
            {selectable.map((a) => (
              <AccountPill key={a.account.id} on={accountId === a.account.id} onClick={() => set({ conta: a.account.id })}>
                <BankLogo inst={a.inst} credit={a.kind === 'cartao'} size="xs" />
                {a.short}
              </AccountPill>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {kpi('entradas', 'Entrou', totals.income)}
          {kpi('gastos', 'Saiu', totals.expense)}
        </div>

        <div className="flex items-center gap-2">
          <label className="shadow-soft flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface px-4 py-2.5">
            <MagnifyingGlass size={20} className="shrink-0 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar (mercado, Uber, Pix…)" aria-label="Buscar no extrato" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[1rem] outline-none placeholder:text-muted" />
          </label>
          <button
            type="button"
            aria-pressed={view === 'fora'}
            onClick={() => set({ ver: view === 'fora' ? 'tudo' : 'fora' })}
            className={`press shrink-0 rounded-full px-3.5 py-2.5 text-[0.875rem] font-semibold ${view === 'fora' ? 'bg-ink text-on-ink' : 'shadow-soft bg-surface'}`}
          >
            Não contam{outCount ? ` (${outCount})` : ''}
          </button>
        </div>

        {view === 'fora' && (
          <Notice>
            Aqui ficam as movimentações que aparecem no banco mas <strong>não entram na conta do mês</strong>: dinheiro que entrou na conta, transferências entre contas suas, pagamento da fatura e caixinha. Sua renda é o salário mais o que você lançar. Para contar alguma, toque nela.
          </Notice>
        )}
        {selected && <p className="-mt-1 px-1 text-[0.875rem] text-muted">Mostrando só {selected.title}.</p>}

        {days.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 text-center text-muted">
            <MascotArt name="tela-lancamentos" px={120} />
            {query ? `Nada com “${query}” neste mês.` : view === 'fora' ? 'Nada fora da conta neste mês.' : 'Nenhum lançamento neste mês.'}
          </Card>
        ) : (
          days.map((d) => {
            const ofDay = shown.filter((t) => t.date === d)
            const net = ofDay.filter((t) => !t.skipped).reduce((a, t) => a + (t.kind === 'income' ? t.amount_cents : -t.amount_cents), 0)
            return (
              <List key={d} header={`${relativeDay(d, today)}${net && view !== 'fora' ? ` · ${net > 0 ? '+' : '−'} ${formatBRL(Math.abs(net))}` : ''}`}>
                {ofDay.map(row)}
              </List>
            )
          })
        )}

        <Button variant="secondary" onClick={() => setExporting(true)} className="mt-1">
          <Export size={20} weight="bold" aria-hidden /> Exportar extrato
        </Button>
      </div>

      <ExportSheet open={exporting} onClose={() => setExporting(false)} accountId={accountId} />
    </>
  )
}

function AccountPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.875rem] font-semibold whitespace-nowrap ${on ? 'bg-ink text-on-ink' : 'shadow-soft bg-surface'}`}>
      {children}
    </button>
  )
}

type Period = 'atual' | 'anterior' | 'tudo' | 'escolher'

/** Exportar: escolhe o período (como nos apps de banco) e baixa o PDF (ou a planilha). */
function ExportSheet({ open, onClose, accountId }: { open: boolean; onClose: () => void; accountId: string | null }) {
  const backend = useBackend()
  const toast = useToast()
  const accounts = useAccounts()
  const categories = useCategories()
  const profile = useProfile()
  const [period, setPeriod] = useState<Period>('atual')
  const [format, setFormat] = useState<'pdf' | 'planilha'>('pdf')
  const [onlyAccount, setOnlyAccount] = useState(true)
  const today = todayISO()
  const [from, setFrom] = useState(firstDayISO(currentYearMonth()))
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const selected = accounts.byId(accountId)

  const range = (): { gte?: string; lte: string; label: string } | null => {
    const cur = currentYearMonth()
    if (period === 'atual') return { gte: firstDayISO(cur), lte: lastDayISO(cur), label: monthLabel(cur) }
    if (period === 'anterior') {
      const prev = addMonths(cur, -1)
      return { gte: firstDayISO(prev), lte: lastDayISO(prev), label: monthLabel(prev) }
    }
    if (period === 'tudo') return { lte: today, label: `Tudo até ${today.split('-').reverse().join('/')}` }
    if (!isValidISODate(from) || !isValidISODate(to) || from > to) return null
    return { gte: from, lte: to, label: `${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}` }
  }

  async function run() {
    const r = range()
    if (!r) return toast('Escolha uma data inicial antes da final.')
    setBusy(true)
    try {
      let txs = await backend.list('transactions', { ...(r.gte ? { gte: ['date', r.gte] as [string, string] } : {}), lte: ['date', r.lte], order: 'date' })
      const account = onlyAccount && selected ? selected : null
      if (account) txs = txs.filter((t) => t.bank_account_id === account.account.id)
      if (!txs.length) return toast('Não há lançamentos nesse período.')
      const accs = accounts.list.map((a) => ({ ...a.account, short: a.short }))
      const name = `${APP_NAME.toLowerCase()}-extrato-${r.gte ?? 'inicio'}-a-${r.lte}`
      if (format === 'pdf') {
        const { statementPDF } = await import('../lib/pdf')
        const blob = await statementPDF({ txs, categories: categories.data ?? [], accounts: accs, period: r.label, accountLabel: account?.short ?? null, person: profile.data?.name ?? null })
        download(`${name}.pdf`, blob)
        toast('PDF do extrato baixado')
      } else {
        download(`${name}.csv`, new Blob([statementCSV(txs, categories.data ?? [], accs)], { type: 'text/csv;charset=utf-8' }))
        toast('Planilha baixada: abre no Excel e no Google Planilhas')
      }
      onClose()
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const OPTIONS: { value: Period; label: string; hint: string }[] = [
    { value: 'atual', label: 'Mês atual', hint: monthLabel(currentYearMonth()) },
    { value: 'anterior', label: 'Mês anterior', hint: monthLabel(addMonths(currentYearMonth(), -1)) },
    { value: 'tudo', label: 'Período completo', hint: 'Tudo o que está no app' },
    { value: 'escolher', label: 'Escolher as datas', hint: 'De um dia até outro' },
  ]

  return (
    <Sheet open={open} onClose={onClose} title="Exportar extrato">
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Período" className="shadow-soft overflow-hidden rounded-[1.1rem] bg-surface">
          {OPTIONS.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={period === o.value} onClick={() => setPeriod(o.value)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 active:bg-surface-2">
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${period === o.value ? 'border-primary' : 'border-line'}`}>{period === o.value && <span className="size-2.5 rounded-full bg-primary" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-[0.8125rem] text-muted">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
        {period === 'escolher' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="De" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Field label="Até" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <Segmented label="Formato" value={format} onChange={setFormat} options={[{ value: 'pdf', label: 'PDF' }, { value: 'planilha', label: 'Planilha (Excel)' }]} />
        {selected && (
          <label className="flex items-center gap-2.5 px-1 text-[0.9375rem]">
            <input type="checkbox" checked={onlyAccount} onChange={(e) => setOnlyAccount(e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
            Só {selected.title}
          </label>
        )}
        <Button onClick={run} loading={busy}>
          Exportar
        </Button>
        <p className="text-center text-[0.8125rem] leading-snug text-muted">O arquivo é gerado no seu aparelho. O que não conta no mês aparece marcado e fica fora dos totais.</p>
      </div>
    </Sheet>
  )
}

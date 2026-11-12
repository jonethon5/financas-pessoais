import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DownloadSimple, FilePdf, MagnifyingGlass, X } from '@phosphor-icons/react'
import { CategoryIcon } from '../components/CategoryIcon'
import { MascotArt } from '../components/Pig'
import { useToast } from '../components/Toast'
import { BackButton, Card, Chip, ErrorBox, List, Money, NavBar, Notice, Row, Spinner } from '../components/ui'
import { useCategories, useMonthTxs, useTable } from '../data/finance'
import { addMonths, monthKey, monthLabel, parseMonthKey, currentYearMonth, relativeDay, todayISO } from '../lib/dates'
import { installmentLabel } from '../lib/installments'
import { accountTitle, findInstitution } from '../lib/institutions'
import { formatBRL } from '../lib/money'
import { METHOD_LABEL, filterStatement, methodOf, statementCSV, statementTotals, type StatementView } from '../lib/statement'
import { friendlyError } from '../lib/supabase'
import { APP_NAME } from '../brand'

const VIEWS: { value: StatementView; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'entradas', label: 'Entradas' },
  { value: 'fora', label: 'Não contam' },
]

/** Baixa um arquivo gerado no aparelho (nada vai para a internet). */
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * /extrato: todos os lançamentos do mês (do banco e lançados à mão), com busca, filtros e arquivo para baixar.
 * Em "Não contam" ficam as entradas do banco e as transferências entre contas próprias.
 */
export function StatementPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const ym = parseMonthKey(params.get('mes')) ?? currentYearMonth()
  const view = (VIEWS.find((v) => v.value === params.get('ver'))?.value ?? 'tudo') as StatementView
  const accountId = params.get('conta')
  const [query, setQuery] = useState('')
  const txs = useMonthTxs(ym)
  const categories = useCategories()
  const accounts = useTable('bank_accounts')
  const conns = useTable('bank_connections')
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
  const accs = accounts.data ?? []
  const shown = useMemo(() => filterStatement(all, { view, query, accountId }, cats), [all, view, query, accountId, cats])
  const outCount = useMemo(() => filterStatement(all, { view: 'fora', accountId }, cats).length, [all, accountId, cats])

  if (txs.isPending || categories.isPending) return <Spinner />
  if (txs.isError) return <ErrorBox message={friendlyError(txs.error)} onRetry={() => txs.refetch()} />

  const catOf = (id: string | null) => cats.find((c) => c.id === id)
  const account = accs.find((a) => a.id === accountId)
  const accountName = account ? accountTitle(findInstitution(account.name, conns.data?.find((c) => c.id === account.connection_id)?.label), account.type, account.name) : null
  const totals = statementTotals(shown)
  const days = [...new Set(shown.map((t) => t.date))]
  const fileName = `${APP_NAME.toLowerCase()}-extrato-${monthKey(ym)}`

  function exportSheet() {
    // A planilha leva tudo do mês (o que conta e o que não conta, marcado numa coluna)
    const rows = accountId ? all.filter((t) => t.bank_account_id === accountId) : all
    if (!rows.length) return toast('Não há lançamentos neste mês para baixar.')
    download(`${fileName}.csv`, statementCSV(rows, cats, accs), 'text/csv;charset=utf-8')
    toast('Planilha baixada: abre no Excel e no Google Planilhas')
  }

  const row = (t: (typeof shown)[number]): ReactNode => {
    const method = methodOf(t, accs)
    const sub = [t.type === 'salario' ? 'Salário' : catOf(t.category_id)?.name, method === 'manual' ? null : METHOD_LABEL[method], t.skipped ? 'não conta' : null].filter(Boolean).join(' · ')
    return (
      <Row
        key={t.id}
        icon={<CategoryIcon category={catOf(t.category_id)} size="sm" />}
        title={`${t.description}${t.installment_no ? ` ${installmentLabel(t.installment_no, t.installment_total)}` : ''}`}
        subtitle={sub || undefined}
        trailing={
          <span className={`num text-[1.0625rem] whitespace-nowrap ${t.skipped ? 'text-muted' : t.kind === 'income' ? 'font-semibold text-primary-strong' : ''}`}>
            {t.kind === 'income' ? '+ ' : ''}
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

  return (
    <>
      <NavBar title="Extrato" left={<BackButton onClick={() => navigate(-1)} />} />
      <div className="flex flex-col gap-4">
        <div className="shadow-soft flex items-center justify-between rounded-[1rem] bg-surface px-1 py-1 print:hidden">
          <button type="button" aria-label="Mês anterior" onClick={() => set({ mes: monthKey(addMonths(ym, -1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronLeft className="size-6" />
          </button>
          <p className="text-[1.0625rem] font-bold">{monthLabel(ym)}</p>
          <button type="button" aria-label="Próximo mês" onClick={() => set({ mes: monthKey(addMonths(ym, 1)) })} className="press grid size-10 place-items-center rounded-full text-primary active:bg-surface-2">
            <ChevronRight className="size-6" />
          </button>
        </div>
        <p className="hidden text-[1.125rem] font-bold print:block">
          Extrato de {monthLabel(ym)}
          {accountName ? ` · ${accountName}` : ''}
        </p>

        <label className="shadow-soft flex items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 print:hidden">
          <MagnifyingGlass size={20} className="shrink-0 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar (ex.: mercado, Uber, Pix)" aria-label="Buscar no extrato" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[1rem] outline-none placeholder:text-muted" />
        </label>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 print:hidden">
          {VIEWS.map((v) => (
            <Chip key={v.value} selected={view === v.value} onClick={() => set({ ver: v.value })} className="shrink-0">
              {v.label}
              {v.value === 'fora' && outCount > 0 ? ` (${outCount})` : ''}
            </Chip>
          ))}
        </div>
        {accountName && (
          <button type="button" onClick={() => set({ conta: null })} className="press -mt-1 flex items-center gap-2 self-start rounded-full bg-primary-soft px-3 py-1.5 text-[0.875rem] font-semibold text-primary-strong print:hidden">
            Só {accountName} <X size={14} weight="bold" aria-label="Tirar o filtro da conta" />
          </button>
        )}

        {view === 'fora' ? (
          <Notice>
            Aparecem aqui o dinheiro que entrou na conta do banco e as transferências entre contas suas. <strong>Não entram na conta do mês</strong>: sua renda é o salário mais o que você lançar. Para contar algum, toque nele e ligue “Contar”.
          </Notice>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="px-3.5 py-3">
              <p className="text-[0.8125rem] text-muted">Entrou</p>
              <p className="num text-[1.125rem] font-semibold text-primary-strong">
                <Money cents={totals.income} />
              </p>
            </Card>
            <Card className="px-3.5 py-3">
              <p className="text-[0.8125rem] text-muted">Saiu</p>
              <p className="num text-[1.125rem] font-semibold">
                <Money cents={totals.expense} />
              </p>
            </Card>
          </div>
        )}

        {days.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 text-center text-muted">
            <MascotArt name="tela-lancamentos" px={120} />
            {query ? `Nada com “${query}” neste mês.` : view === 'fora' ? 'Nada fora da conta neste mês.' : 'Nenhum lançamento neste mês.'}
          </Card>
        ) : (
          days.map((d) => {
            const ofDay = shown.filter((t) => t.date === d)
            const out = ofDay.filter((t) => t.kind === 'expense').reduce((a, t) => a + t.amount_cents, 0)
            return (
              <List key={d} header={`${relativeDay(d, today)}${out && view !== 'fora' ? ` · ${formatBRL(out)}` : ''}`}>
                {ofDay.map(row)}
              </List>
            )
          })
        )}

        <div className="mt-1 grid grid-cols-2 gap-2.5 print:hidden">
          <button type="button" onClick={exportSheet} className="press flex items-center justify-center gap-2 rounded-[1rem] bg-surface px-3 py-3.5 text-[0.9375rem] font-semibold shadow-soft">
            <DownloadSimple size={20} weight="bold" className="text-primary" /> Planilha (Excel)
          </button>
          <button type="button" onClick={() => window.print()} className="press flex items-center justify-center gap-2 rounded-[1rem] bg-surface px-3 py-3.5 text-[0.9375rem] font-semibold shadow-soft">
            <FilePdf size={20} weight="bold" className="text-primary" /> Salvar em PDF
          </button>
        </div>
        <p className="px-1 text-center text-[0.8125rem] leading-snug text-muted print:hidden">O arquivo é gerado no seu aparelho. No PDF, escolha “Salvar como PDF” na tela de impressão.</p>
      </div>
    </>
  )
}

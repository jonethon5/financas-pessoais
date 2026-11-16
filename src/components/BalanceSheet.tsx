import { useState } from 'react'
import { Link } from 'react-router'
import { savePlan, useRecurrings, useWrite } from '../data/finance'
import { useMonthView } from '../data/monthView'
import { monthlyBalance, MAX_CUT, type Balance } from '../lib/balance'
import { subscriptions } from '../lib/budget'
import { uncountedIncome } from '../lib/bills'
import { currentYearMonth } from '../lib/dates'
import { lessonById } from '../lib/learn'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button, ErrorBox, List, Row, Spinner } from './ui'

const HEADLINE: Record<Balance['verdict'], (b: Balance) => { title: string; text: string; tone: string }> = {
  'sem-renda': () => ({ title: 'Falta o seu salário', text: 'Cadastre o salário em Você para o balanço saber quanto entra.', tone: 'bg-surface-2' }),
  'ja-da': (b) => ({
    title: `Já dá! No seu ritmo sobram ${formatBRL(b.leftCents)} por mês.`,
    text: `O segredo é separar os ${formatBRL(b.targetCents)} no dia do salário, antes de gastar.`,
    tone: 'bg-grow/15',
  }),
  da: (b) => ({ title: `Dá, cortando ${formatBRL(b.cutsCents)} por mês.`, text: 'Só em desejos: nada do essencial muda.', tone: 'bg-primary-soft' }),
  apertado: (b) => ({ title: `Dá, mas fica apertado: ${formatBRL(b.cutsCents)} por mês.`, text: 'Além dos desejos, precisa economizar um pouco em coisas do dia a dia.', tone: 'bg-warn-soft' }),
  'nao-da': (b) =>
    b.leftCents < 0
      ? {
          title: `Hoje sai mais do que entra: faltam ${formatBRL(-b.leftCents)} por mês.`,
          text: 'Antes de guardar, o primeiro passo é sair do vermelho. Veja abaixo o que já tem dono, onde dá para mexer e quanto muda gastando um pouco menos.',
          tone: 'bg-coral-soft',
        }
      : {
    title: `${b.targetPct}% ainda não cabe. Hoje o realista é ${b.maxPct}%.`,
    text:
      b.path && b.path.months > 0
        ? `Comece com ${b.path.startPct}% (${formatBRL(Math.round((b.incomeCents * b.path.startPct) / 100))}) e suba 1% por mês: em ${b.path.months} ${b.path.months === 1 ? 'mês' : 'meses'} você chega a ${b.targetPct}%.`
        : 'Comece pelo que dá e suba aos poucos. Aumentos pequenos e combinados antes funcionam melhor do que tentar tudo de uma vez.',
    tone: 'bg-coral-soft',
  },
}

/** Cartão da Saúde financeira que abre o balanço. */
export function BalanceCard() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-[1.25rem] bg-surface p-4">
      <p className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">Balanço do mês</p>
      <p className="mt-1 text-[1.0625rem] leading-snug font-semibold">Quanto dá para guardar e onde cortar, com base nos seus gastos.</p>
      <Button className="mt-3" onClick={() => setOpen(true)}>
        Fazer meu balanço
      </Button>
      {open && <BalanceSheet onClose={() => setOpen(false)} />}
    </section>
  )
}

function BalanceSheet({ onClose }: { onClose: () => void }) {
  const ym = currentYearMonth()
  const view = useMonthView(ym)
  const recurrings = useRecurrings()
  const write = useWrite()
  const toast = useToast()
  const [pct, setPct] = useState(10)
  const [step, setStep] = useState<'meta' | 'resultado'>('meta')
  const [error, setError] = useState<string | null>(null)
  const [cut, setCut] = useState(30)

  const body = () => {
    if (view.isPending || recurrings.isPending) return <Spinner />
    if (view.error || !view.data) return <ErrorBox message={friendlyError(view.error)} onRetry={view.refetch} />
    const d = view.data
    const subs = subscriptions(recurrings.data ?? [], d.history).items.filter((s) => s.source === 'fixo')
    const b = monthlyBalance(
      { today: d.today, incomeCents: d.summary.income, fixedCents: d.summary.fixed, installmentsCents: d.summary.installments, categories: d.categories, history: d.history, monthTxs: d.txs, subscriptions: subs },
      pct,
    )

    if (step === 'meta') {
      return (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[1.125rem] leading-snug font-bold">Quanto você quer guardar por mês?</p>
            <p className="mt-1 text-[0.9375rem] text-muted">Em porcentagem da sua renda de {formatBRL(b.incomeCents)}.</p>
          </div>
          <div className="text-center">
            <p className="num text-[3rem] leading-none font-extrabold text-primary-strong">{pct}%</p>
            <p className="num mt-1.5 text-[1.0625rem] font-semibold">{formatBRL(b.targetCents)} por mês</p>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label="Porcentagem para guardar"
            className="w-full accent-[var(--primary)]"
          />
          <p className="-mt-2 flex justify-between text-[0.8125rem] text-muted">
            <span>5%</span>
            <span>Para começar, 10% já é ótimo</span>
            <span>30%</span>
          </p>
          <Button onClick={() => setStep('resultado')}>Ver meu balanço</Button>
        </div>
      )
    }

    const h = HEADLINE[b.verdict](b)
    const limits = b.cuts.filter((c) => c.kind === 'limite' && c.categoryId)
    const saveNow = b.path ? Math.round((b.incomeCents * b.path.startPct) / 100) : b.targetCents
    const hasGoals = d.goals.length > 0

    async function applyLimits() {
      setError(null)
      try {
        await write.mutateAsync(async (bk) => {
          for (const c of limits) await bk.update('categories', c.categoryId!, { monthly_limit_cents: c.newCents })
        })
        toast('Limites aplicados: o app avisa quando você chegar perto')
      } catch (err) {
        setError(friendlyError(err))
      }
    }
    async function separate() {
      setError(null)
      try {
        await write.mutateAsync((bk) => savePlan(bk, ym, { save_cents: saveNow }, d.plan))
        toast(`Combinado: ${formatBRL(saveNow)} para guardar este mês`)
        onClose()
      } catch (err) {
        setError(friendlyError(err))
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <div className={`rounded-[1.25rem] p-4 ${h.tone}`}>
          <p className="text-[1.125rem] leading-snug font-bold">{h.title}</p>
          <p className="mt-1.5 leading-snug">{h.text}</p>
        </div>
        {b.verdict !== 'sem-renda' && (
          <p className="-mb-2 px-1 text-[0.8125rem] leading-snug text-muted">
            “Sai por mês” = gastos fixos e parcelas deste mês + a <strong>média</strong> do dia a dia dos últimos 3 meses (não só este mês). O detalhe está logo abaixo.
          </p>
        )}
        {b.verdict !== 'sem-renda' && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Entra', b.incomeCents],
              ['Sai por mês', b.spendCents],
              ['Sobra p/ guardar', b.leftCents],
            ].map(([label, v]) => (
              <div key={label} className="rounded-[1rem] bg-surface px-2 py-2.5">
                <p className="text-[0.75rem] text-muted">{label}</p>
                <p className={`num text-[0.9375rem] font-bold ${(v as number) < 0 ? 'text-danger-strong' : ''}`}>{formatBRL(v as number)}</p>
              </div>
            ))}
          </div>
        )}
        {(() => {
          const u = uncountedIncome(d.txs)
          return u.cents > 0 && b.verdict !== 'ja-da' ? (
            <p className="rounded-[1rem] bg-surface px-4 py-3 text-[0.9375rem] leading-snug">
              “Entra” é só o salário e o que você marcou como renda. Este mês entraram mais <strong>{formatBRL(u.cents)}</strong> pelo banco que não contam. Se algum foi renda sua (um bico, parte do salário), marque como renda e a conta melhora.{' '}
              <Link to="/extrato?ver=entradas" className="font-semibold text-primary-strong">
                Ver o que entrou
              </Link>
            </p>
          ) : null
        })()}
        {b.passThroughs.length > 0 && (
          <List
            header="Isso é gasto mesmo?"
            footer="Você recebeu e mandou o mesmo valor logo em seguida. Se o dinheiro só passou por você, abra e toque em “Não contar como gasto”: a sua sobra melhora."
          >
            {b.passThroughs.map((t) => (
              <Row
                key={t.id}
                title={t.label}
                subtitle="Parece um repasse"
                trailing={<span className="num font-semibold">{formatBRL(t.amountCents)}</span>}
                chevron
                as={(c, cls) => (
                  <Link to={`/lancamento/${t.id}`} className={cls}>
                    {c}
                  </Link>
                )}
              />
            ))}
          </List>
        )}
        {b.verdict !== 'sem-renda' && (b.committed.fixedCents > 0 || b.committed.parcels.length > 0) && (
          <List header="Já tem dono (não dá para cortar agora)" footer="Gasto fixo dá para renegociar (plano de celular, internet). Parcela acaba sozinha: quando terminar, esse dinheiro fica livre.">
            {b.committed.fixedCents > 0 && <Row title="Gastos fixos" subtitle="Aluguel, contas, assinaturas…" trailing={<span className="num font-semibold">{formatBRL(b.committed.fixedCents)}</span>} />}
            {b.committed.parcels.map((p) => (
              <Row
                key={p.label}
                title={p.label}
                subtitle={p.left > 0 ? `Faltam ${p.left} ${p.left === 1 ? 'parcela' : 'parcelas'}` : 'Última parcela'}
                trailing={<span className="num font-semibold">{formatBRL(p.amountCents)}</span>}
              />
            ))}
          </List>
        )}
        {b.variable.length > 0 && (
          <List header="Dá para mexer (dia a dia)" footer="Média por mês dos últimos 3 meses. Compras parceladas e gastos fixos não entram aqui.">
            {b.variable.map((v) => (
              <Row
                key={v.categoryId}
                title={v.label}
                subtitle={v.merchants.length ? v.merchants.map((m) => `${m.name} ${formatBRL(m.monthlyCents)}`).join(' · ') : v.group === 'desejo' ? 'Desejo' : 'Necessidade'}
                trailing={<span className="num font-semibold">{formatBRL(v.monthlyCents)}</span>}
              />
            ))}
          </List>
        )}
        {b.verdict !== 'sem-renda' && b.variableCents > 0 && (() => {
          const sc = b.scenarios.find((x) => x.cutPct === cut)!
          return (
            <section className="rounded-[1.25rem] bg-surface p-4">
              <p className="font-semibold">E se você gastasse menos no dia a dia?</p>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Quanto gastar a menos">
                {b.scenarios.map((x) => (
                  <button
                    key={x.cutPct}
                    type="button"
                    role="radio"
                    aria-checked={cut === x.cutPct}
                    onClick={() => setCut(x.cutPct)}
                    className={`rounded-full py-2 text-[0.9375rem] font-semibold transition ${cut === x.cutPct ? 'bg-ink text-on-ink' : 'bg-surface-2'}`}
                  >
                    −{x.cutPct}%
                  </button>
                ))}
              </div>
              <p className="mt-3 leading-snug">
                Gastando {cut}% menos ({formatBRL(sc.saveCents)} por mês),{' '}
                {sc.leftCents >= 0 ? (
                  <>
                    você guardaria <strong>{formatBRL(sc.leftCents)} por mês</strong>: {sc.pct}% da renda ({formatBRL(sc.leftCents * 12)} por ano).
                  </>
                ) : (
                  <>
                    ainda faltariam <strong>{formatBRL(-sc.leftCents)} por mês</strong>. O próximo passo seria rever os gastos fixos.
                  </>
                )}
              </p>
            </section>
          )
        })()}
        {b.cuts.length > 0 && (
          <List header={b.verdict === 'nao-da' ? 'Tudo o que dá para cortar' : `Plano para chegar a ${b.targetPct}%`} footer={`Média dos seus gastos dos últimos 3 meses. Cortes de até ${MAX_CUT.desejo * 100}% nos desejos e ${MAX_CUT.necessidade * 100}% nas necessidades, para o plano ser possível de seguir.`}>
            {b.cuts.map((c) => (
              <Row
                key={`${c.kind}:${c.label}`}
                title={c.label}
                subtitle={
                  <>
                    <span className="block">{`${formatBRL(c.nowCents)} → ${formatBRL(c.newCents)} por mês`}</span>
                    <span className="block">{c.group === 'necessidade' ? `${c.how} · essencial: compare preços` : c.how}</span>
                  </>
                }
                trailing={<span className="num font-semibold text-primary-strong">+{formatBRL(c.saveCents)}</span>}
              />
            ))}
          </List>
        )}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-col gap-2">
          {limits.length > 0 && (
            <Button loading={write.isPending} onClick={applyLimits}>
              Aplicar estes limites
            </Button>
          )}
          {b.verdict === 'sem-renda' ? (
            <Link to="/voce" className="press rounded-full bg-primary py-3 text-center font-semibold text-on-primary">
              Cadastrar salário
            </Link>
          ) : b.leftCents < 0 ? null : hasGoals ? (
            <Link to="/caixinhas" className="press rounded-full bg-surface py-3 text-center font-semibold text-primary-strong">
              Guardar {formatBRL(saveNow)} nas caixinhas
            </Link>
          ) : (
            <Button variant="secondary" loading={write.isPending} onClick={separate}>
              Separar {formatBRL(saveNow)} este mês
            </Button>
          )}
          <Button variant="ghost" onClick={() => setStep('meta')}>
            Mudar a meta
          </Button>
        </div>
        {b.lessons.length > 0 && (
          <List header="Para ajudar">
            {b.lessons.map((id) => {
              const l = lessonById(id)
              return l ? (
                <Row
                  key={id}
                  title={l.title}
                  subtitle={l.short}
                  chevron
                  as={(c, cls) => (
                    <Link to={`/aprender/${id}`} className={cls}>
                      {c}
                    </Link>
                  )}
                />
              ) : null
            })}
          </List>
        )}
      </div>
    )
  }

  return (
    <Sheet open title="Balanço do mês" onClose={onClose}>
      {body()}
    </Sheet>
  )
}

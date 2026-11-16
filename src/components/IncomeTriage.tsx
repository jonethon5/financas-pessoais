import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { stableId } from '../lib/recurring'
import { useCategories, useWrite } from '../data/finance'
import type { Backend } from '../data/backend'
import { countKey, ownKey } from '../../supabase/functions/_shared/bankmap.ts'
import { formatDateShort } from '../lib/dates'
import { friendlyError } from '../lib/supabase'
import { partyOf, txTitle } from '../lib/statement'
import type { Transaction } from '../types'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { ErrorBox, Money } from './ui'

/** Dinheiro que entrou pelo banco e ainda não foi classificado (não conta como renda e não tem motivo). */
export const unclassifiedIncome = (txs: Transaction[]) => txs.filter((t) => t.kind === 'income' && t.skipped && t.source === 'banco' && !t.note)

const OWN = 'Dinheiro seu: veio da poupança, da caixinha ou de outra conta sua. Não é renda.'
const PASS = 'Repasse: dinheiro que só passou por você. Não é renda.'

/**
 * O salário que caiu no banco SUBSTITUI o previsto do cadastro naquele mês (não soma): fica um salário só, com o
 * valor e a data reais. O lançamento do banco vira o próprio salário do mês (mesmo vínculo com o banco).
 */
export async function applyAsSalary(b: Backend, t: Transaction, userId: string, salaryCat: string | null) {
  const id = await stableId(`salario:${userId}:${t.date.slice(0, 7)}`)
  await b.remove('transactions', [t.id])
  const real = { amount_cents: t.amount_cents, date: t.date, source: 'banco' as const, external_id: t.external_id ?? null, bank_account_id: t.bank_account_id ?? null, bank_info: t.bank_info ?? null, skipped: false, paid: true, note: null }
  const forecast = (await b.list('transactions', { eq: { id } }))[0]
  if (forecast) await b.update('transactions', id, real)
  else await b.insert('transactions', [{ id, kind: 'income', type: 'salario', description: 'Salário', category_id: salaryCat, recurring_id: null, installment_group: null, installment_no: null, installment_total: null, emotion: null, ...real }])
}

type Choice = 'salario' | 'renda' | 'meu' | 'repasse'

/**
 * "O que é esse dinheiro?": para cada Pix ou transferência que entrou e não conta como renda, um toque diz o que é.
 * Renda (salário dividido, bico) passa a contar, e os próximos da mesma origem também. Dinheiro da própria pessoa
 * (poupança, outra conta) e repasse saem das entradas.
 */
export function IncomeTriage({ txs, onClose }: { txs: Transaction[]; onClose: () => void }) {
  const write = useWrite()
  const { userId } = useAuth()
  const toast = useToast()
  const categories = useCategories()
  const [done, setDone] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const list = unclassifiedIncome(txs).filter((t) => !done.has(t.id))

  async function choose(t: Transaction, c: Choice) {
    setError(null)
    const bankDesc = t.bank_info?.original ?? t.description
    const income = (categories.data ?? []).filter((x) => x.kind === 'income' && !x.archived)
    const category = t.category_id ?? income.find((x) => x.name === 'Renda extra')?.id ?? income[0]?.id ?? null
    try {
      await write.mutateAsync(async (b) => {
        if (c === 'salario') {
          await applyAsSalary(b, t, userId!, income.find((x) => x.name === 'Salário')?.id ?? category)
        } else if (c === 'renda') {
          await b.update('transactions', t.id, { skipped: false, category_id: category })
          // os próximos dessa origem (a empresa do salário, por exemplo) já entram contando
          const pattern = countKey(bankDesc)
          if (pattern && category) await b.upsert('category_rules', { pattern, category_id: category }, 'user_id,pattern')
        } else {
          await b.update('transactions', t.id, { note: c === 'meu' ? OWN : PASS })
          const pattern = c === 'meu' ? ownKey(bankDesc) : ''
          if (pattern && category) await b.upsert('category_rules', { pattern, category_id: category }, 'user_id,pattern')
        }
      })
      setDone((d) => new Set(d).add(t.id))
      toast(c === 'salario' ? 'Pronto: é o salário do mês, no lugar do previsto (não soma)' : c === 'renda' ? 'Agora conta como renda. Os próximos dessa origem também.' : c === 'meu' ? 'Marcado como dinheiro seu' : 'Marcado como repasse')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <Sheet open title="O que é esse dinheiro?" onClose={onClose}>
      <p className="text-[0.9375rem] leading-snug text-muted">
        Entrou pelo banco e ainda não conta como renda. Diga o que é: a conta do mês fica certa.
      </p>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {list.length === 0 ? (
        <p className="mt-6 mb-2 text-center font-semibold">Tudo classificado. Obrigado!</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {list.map((t) => {
            const who = partyOf(t)
            return (
              <li key={t.id} className="rounded-[1.25rem] bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{who ?? txTitle(t)}</span>
                    <span className="block text-[0.875rem] text-muted">{formatDateShort(t.date)}{t.bank_info?.time ? ` às ${t.bank_info.time}` : ''}</span>
                  </span>
                  <span className="num shrink-0 text-[1.125rem] font-bold text-primary-strong">
                    + <Money cents={t.amount_cents} />
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" disabled={write.isPending} onClick={() => choose(t, 'salario')} className="press rounded-full bg-primary px-4 py-2.5 text-left text-[0.9375rem] font-semibold text-on-primary disabled:opacity-60">
                    É o meu salário <span className="font-normal opacity-90">(no lugar do previsto)</span>
                  </button>
                  <button type="button" disabled={write.isPending} onClick={() => choose(t, 'renda')} className="press rounded-full bg-surface-2 px-4 py-2.5 text-left text-[0.9375rem] font-semibold disabled:opacity-60">
                    É outra renda (bico, extra)
                  </button>
                  <button type="button" disabled={write.isPending} onClick={() => choose(t, 'meu')} className="press rounded-full bg-surface-2 px-4 py-2.5 text-left text-[0.9375rem] font-semibold disabled:opacity-60">
                    É meu dinheiro (poupança, caixinha ou outra conta minha)
                  </button>
                  <button type="button" disabled={write.isPending} onClick={() => choose(t, 'repasse')} className="press rounded-full bg-surface-2 px-4 py-2.5 text-left text-[0.9375rem] font-semibold disabled:opacity-60">
                    Só passou por mim (repasse)
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

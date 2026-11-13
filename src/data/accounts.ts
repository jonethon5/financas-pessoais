// Contas e cartões conectados, já com o banco reconhecido e um nome curto para mostrar.
import { accountTitle, findInstitution, type Institution } from '../lib/institutions'
import type { BankAccount, BankConnection } from '../types'
import { useTable } from './finance'

export type AccountInfo = {
  account: BankAccount
  inst: Institution | null
  /** "Nubank · Cartão" */
  title: string
  /** "Nubank cartão" (para subtítulos) */
  short: string
  kind: 'conta' | 'cartao' | 'guardado'
}

export function accountInfo(a: BankAccount, conns: Pick<BankConnection, 'id' | 'label'>[]): AccountInfo {
  // O nome da conta vem antes do nome da conexão: uma conexão do Meu Pluggy pode trazer contas de vários bancos
  const inst = findInstitution(a.name, conns.find((c) => c.id === a.connection_id)?.label)
  const kind = a.type === 'CREDIT' ? 'cartao' : a.type === 'INVESTMENT' ? 'guardado' : 'conta'
  const word = kind === 'cartao' ? 'cartão' : kind === 'guardado' ? 'guardado' : 'conta'
  return { account: a, inst, title: accountTitle(inst, a.type, a.name), short: inst ? `${inst.name} ${word}` : a.name, kind }
}

/** Contas da pessoa com o banco reconhecido. `byId` acha a de um lançamento. */
export function useAccounts() {
  const accounts = useTable('bank_accounts')
  const conns = useTable('bank_connections')
  const list = (accounts.data ?? []).map((a) => accountInfo(a, conns.data ?? []))
  const byId = (id: string | null | undefined) => (id ? (list.find((x) => x.account.id === id) ?? null) : null)
  return { list, byId, isPending: accounts.isPending || conns.isPending }
}

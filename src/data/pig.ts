// Porquinho: junta os dados do mês, calcula humor e tamanho, credita as moedas sozinho e cuida da loja.
import { useEffect, useMemo, useRef } from 'react'
import { useTable, useWrite } from './finance'
import { useUpdateProfile } from './hooks'
import { useMonthView } from './monthView'
import { currentYearMonth } from '../lib/dates'
import { balance, createdDay, pendingRewards, pigState, SHOP, type PigInput } from '../lib/pig'
import { stableId } from '../lib/recurring'

export function usePig(onCoins?: (n: number) => void) {
  const view = useMonthView(currentYearMonth())
  const coins = useTable('pig_coins')
  const purchases = useTable('pig_purchases')
  const write = useWrite()
  const updateProfile = useUpdateProfile()
  const syncing = useRef(false)
  // Cada moeda é tentada uma vez por sessão (se falhar, tenta de novo só quando abrir o app outra vez)
  const tried = useRef(new Set<string>())

  const d = view.data
  const input: PigInput | null = useMemo(() => {
    if (!d) return null
    const txs = [...new Map([...d.history, ...d.txs].map((t) => [t.id, t])).values()]
    const active = d.goals.filter((g) => !g.status.done)
    const saveTarget = d.goals.length ? active.reduce((a, g) => a + (g.status.perMonth ?? 0), 0) : (d.plan?.save_cents ?? 0)
    return {
      today: d.today,
      startDay: createdDay(d.profile.created_at),
      txs,
      moves: d.goalMoves,
      goals: d.goals.map((g) => ({ id: g.goal.id, target: g.status.target })),
      saveTarget,
      payday: d.profile.payday,
    }
  }, [d])

  const earned = coins.data
  const state = useMemo(() => (input && earned ? pigState(input, earned) : null), [input, earned])

  // Credita as moedas que faltam (as repetidas são ignoradas: o id é o mesmo para a mesma meta no mesmo dia)
  useEffect(() => {
    if (!input || !earned || !d || syncing.current) return
    const have = new Set(earned.map((c) => `${c.day}|${c.kind}|${c.ref}`))
    const missing = pendingRewards(input).filter((r) => !have.has(`${r.day}|${r.kind}|${r.ref}`) && !tried.current.has(`${r.day}|${r.kind}|${r.ref}`))
    if (!missing.length) return
    for (const r of missing) tried.current.add(`${r.day}|${r.kind}|${r.ref}`)
    syncing.current = true
    void (async () => {
      try {
        const rows = await Promise.all(missing.map(async (r) => ({ ...r, id: await stableId(`${d.profile.id}|pig|${r.day}|${r.kind}|${r.ref}`) })))
        await write.mutateAsync((b) => b.insert('pig_coins', rows, { ignoreDuplicates: true }))
        onCoins?.(missing.reduce((a, r) => a + r.coins, 0))
      } catch {
        /* tenta de novo na próxima vez que abrir */
      } finally {
        syncing.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, earned])

  const owned = new Set((purchases.data ?? []).map((p) => p.item))
  const coinsBalance = balance(earned ?? [], purchases.data ?? [])
  const wear = d?.profile.prefs.pig?.wear ?? null

  async function buy(item: string) {
    const it = SHOP.find((x) => x.key === item)
    if (!it || owned.has(item)) return
    if (coinsBalance < it.price) throw new Error('Moedas insuficientes')
    await write.mutateAsync((b) => b.insert('pig_purchases', [{ item: it.key, price: it.price }]))
    await setWear(it.key)
  }

  async function setWear(item: string | null) {
    if (!d) return
    await updateProfile.mutateAsync({ prefs: { ...d.profile.prefs, pig: { ...d.profile.prefs.pig, wear: item } } })
  }

  return {
    isPending: view.isPending || coins.isPending || purchases.isPending,
    error: view.error ?? coins.error ?? purchases.error,
    refetch: view.refetch,
    view: d,
    input,
    state,
    coins: earned ?? [],
    balance: coinsBalance,
    owned,
    wear,
    buy,
    setWear,
  }
}

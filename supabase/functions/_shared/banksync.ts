// Núcleo da conexão com o banco (Pluggy / Meu Pluggy), usado pela função bank-sync (o app chama)
// e pela bank-webhook (a Pluggy avisa quando o Meu Pluggy terminou de atualizar). SÓ LEITURA.
//
// Como o que vem do banco entra na conta do mês:
//   - a RENDA do mês é o salário do cadastro (Você › Salário) mais o que a pessoa lança à mão.
//     Dinheiro que entra na conta (Pix recebido etc.) aparece no extrato, mas NÃO conta como renda sozinho;
//   - o depósito do salário só confirma o salário do mês (não vira outra renda);
//   - transferência entre contas da própria pessoa não é renda nem gasto;
//   - gasto na conta e compra no cartão contam como gasto;
//   - nada do que o banco manda é descartado: pagamento de fatura, resgate e aplicação da caixinha e estorno
//     aparecem no extrato como "não conta" (com o motivo), para o extrato ficar igual ao do banco;
//   - gasto que a pessoa já tinha lançado à mão (mesmo valor, até 2 dias) é só confirmado, não entra de novo.
//
// As chaves PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET ficam só nos secrets das funções.
// No beta, as chaves do Meu Pluggy são pessoais (do dono do app): por isso só o administrador usa.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { UserError } from './common.ts'
import { cleanDescription, countKey, countsInMonth, findFixedMatch, findManualMatch, findVanished, learnKey, mapTransaction, paydayIn, salaryMonths, shiftMonth, type AccountType, type MappedTx, type PluggyTx } from './bankmap.ts'

const API = Deno.env.get('PLUGGY_API_BASE') || 'https://api.pluggy.ai'
export const CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
export const CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''
const FIRST_SYNC_DAYS = 90
export const COOLDOWN_MIN = 15
/** Conector "MeuPluggy": a pessoa autoriza os bancos que já conectou no Meu Pluggy (uso pessoal, grátis). */
export const MEU_PLUGGY_CONNECTOR = 200

let cachedKey: { key: string; until: number } | null = null

async function apiKey(): Promise<string> {
  if (cachedKey && Date.now() < cachedKey.until) return cachedKey.key
  const res = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }) })
  if (!res.ok) throw new UserError('A Pluggy recusou as chaves. Confira os secrets PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.', 503)
  const { apiKey: key } = await res.json()
  cachedKey = { key, until: Date.now() + 100 * 60_000 } // a chave vale 2 horas
  return key
}

export class PluggyError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

export async function pluggyPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'X-API-KEY': await apiKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new PluggyError(res.status, String(data?.code ?? ''), String(data?.message ?? `Pluggy ${res.status}`))
  }
  return res.json()
}

export async function pluggy<T>(path: string, retry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-API-KEY': await apiKey() }, signal: AbortSignal.timeout(30_000) })
  if (res.status === 401 && retry) {
    cachedKey = null
    return pluggy(path, false)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new PluggyError(res.status, String(body?.code ?? ''), String(body?.message ?? `Pluggy ${res.status}`))
  }
  return res.json()
}

type PluggyAccount = {
  id: string
  type: AccountType
  subtype?: string | null
  name: string
  marketingName?: string | null
  balance?: number | null
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; balanceDueDate?: string | null; balanceCloseDate?: string | null } | null
  bankData?: { automaticallyInvestedBalance?: number | null; overdraftContractedLimit?: number | null; overdraftUsedLimit?: number | null } | null
}

export type PluggyItem = { status?: string | null; executionStatus?: string | null; connector?: { name?: string | null } | null }

const toCents = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100))
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000))
export const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

async function stableUuid(key: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`poupei:${key}`)))
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

/** O id do salário de cada mês é o mesmo que o app usa (assim nunca existem dois). */
const salaryId = (uid: string, month: string) => stableUuid(`salario:${uid}:${month}`)

export type Conn = { id: string; item_id: string; label: string; last_sync_at: string | null }

/** O que a sincronização precisa saber da pessoa (lido uma vez por chamada). */
export type Ctx = {
  uid: string
  name: string | null
  salaryCents: number | null
  payday: number | null
  catByName: Map<string, string>
  /** regras que a pessoa ensinou: chave → categoria */
  rules: Map<string, string>
  /** meses cujo salário já foi confirmado pelo banco (nesta chamada) */
  salaryLinked: Set<string>
}

export async function loadCtx(admin: SupabaseClient, uid: string): Promise<Ctx> {
  const [{ data: profile }, { data: categories }, { data: rules }] = await Promise.all([
    admin.from('profiles').select('name, salary_cents, payday').eq('id', uid).single(),
    admin.from('categories').select('id, name').eq('user_id', uid),
    admin.from('category_rules').select('pattern, category_id').eq('user_id', uid),
  ])
  return {
    uid,
    name: profile?.name ?? null,
    salaryCents: profile?.salary_cents ?? null,
    payday: profile?.payday ?? null,
    catByName: new Map((categories ?? []).map((c) => [c.name, c.id])),
    rules: new Map((rules ?? []).map((r) => [r.pattern, r.category_id])),
    salaryLinked: new Set(),
  }
}

/**
 * A entrada é o depósito do salário? Então só confirma o salário daquele mês (valor e dia continuam os do cadastro).
 * Cada mês tem um salário só: a segunda entrada parecida no mesmo mês não vira salário.
 */
async function linkSalary(admin: SupabaseClient, ctx: Ctx, m: Pick<MappedTx, 'kind' | 'amount_cents' | 'date' | 'external_id'>, bankAccountId: string | null): Promise<boolean> {
  for (const month of salaryMonths(m, ctx.salaryCents, ctx.payday)) {
    if (ctx.salaryLinked.has(month)) continue
    ctx.salaryLinked.add(month)
    const id = await salaryId(ctx.uid, month)
    // O salário daquele mês: o que o app lançou (id previsível) ou qualquer outro "Salário" que esteja no mês
    const { data: rows, error: readError } = await admin
      .from('transactions')
      .select('id, external_id')
      .eq('user_id', ctx.uid)
      .eq('type', 'salario')
      .or(`id.eq.${id},and(date.gte.${month}-01,date.lte.${paydayIn(month, 31)})`)
    if (readError) throw readError
    if ((rows ?? []).some((r) => r.external_id)) continue
    const link = { external_id: m.external_id, source: 'banco', bank_account_id: bankAccountId }
    const target = (rows ?? []).find((r) => r.id === id) ?? rows?.[0]
    const { error } = target
      ? await admin.from('transactions').update(link).eq('id', target.id)
      : await admin.from('transactions').insert({ id, user_id: ctx.uid, kind: 'income', type: 'salario', amount_cents: ctx.salaryCents, date: paydayIn(month, ctx.payday!), description: 'Salário', category_id: ctx.catByName.get('Salário') ?? null, paid: true, ...link })
    if (error) throw error
    return true
  }
  return false
}

/**
 * Arruma o que versões antigas gravaram:
 *  - entrada do banco que tinha virado um segundo "Salário" volta a ser uma entrada que não conta;
 *  - salário do mês que tinha ido parar na data (e no mês) do depósito volta para o dia do pagamento.
 */
export async function tidySalary(admin: SupabaseClient, ctx: Ctx): Promise<number> {
  const { data: rows } = await admin.from('transactions').select('id, date').eq('user_id', ctx.uid).eq('type', 'salario').eq('source', 'banco')
  let changed = 0
  for (const r of rows ?? []) {
    const month = r.date.slice(0, 7)
    let home: string | null = null
    for (const m of [month, shiftMonth(month, -1), shiftMonth(month, 1)]) if (r.id === (await salaryId(ctx.uid, m))) home = m
    if (home === month) continue
    if (home) await admin.from('transactions').update({ date: paydayIn(home, ctx.payday ?? 1) }).eq('id', r.id)
    else await admin.from('transactions').update({ type: 'extra', skipped: true, category_id: ctx.catByName.get('Renda extra') ?? null }).eq('id', r.id)
    changed++
  }
  return changed
}

/**
 * Entradas do banco que estão "sem contar" e são o depósito do salário: somem do extrato e passam a confirmar
 * o salário do mês (acontece quando o salário foi cadastrado, ou corrigido, depois de conectar o banco).
 */
export async function relinkSalary(admin: SupabaseClient, ctx: Ctx): Promise<number> {
  if (!ctx.salaryCents || !ctx.payday) return 0
  const since = addDays(todayBR(), -400)
  const [{ data: rows }, { data: confirmed }] = await Promise.all([
    admin
      .from('transactions')
      .select('id, amount_cents, date, external_id, bank_account_id')
      .eq('user_id', ctx.uid).eq('source', 'banco').eq('type', 'extra').eq('skipped', true).not('external_id', 'is', null)
      .gte('date', since)
      .order('date'),
    admin.from('transactions').select('date').eq('user_id', ctx.uid).eq('type', 'salario').not('external_id', 'is', null).gte('date', since),
  ])
  // Meses cujo salário o banco já confirmou não precisam ser olhados de novo
  for (const r of confirmed ?? []) ctx.salaryLinked.add(r.date.slice(0, 7))
  let changed = 0
  for (const t of rows ?? []) {
    const m = { kind: 'income' as const, amount_cents: t.amount_cents, date: t.date, external_id: t.external_id as string }
    if (!salaryMonths(m, ctx.salaryCents, ctx.payday).some((month) => !ctx.salaryLinked.has(month))) continue
    // O id do banco é único por pessoa: sai da entrada antes de ir para o salário
    await admin.from('transactions').update({ external_id: null }).eq('id', t.id)
    if (await linkSalary(admin, ctx, m, t.bank_account_id)) {
      await admin.from('transactions').delete().eq('id', t.id)
      changed++
    } else await admin.from('transactions').update({ external_id: t.external_id }).eq('id', t.id)
  }
  return changed
}

/**
 * Meses passados que têm lançamentos do banco ganham o salário do cadastro (um por mês, com o id de sempre).
 * Sem isso, o histórico mostraria meses só com gastos e nenhuma renda.
 */
export async function ensurePastSalaries(admin: SupabaseClient, ctx: Ctx): Promise<void> {
  if (!ctx.salaryCents || !ctx.payday) return
  const { data: first } = await admin.from('transactions').select('date').eq('user_id', ctx.uid).eq('source', 'banco').order('date', { ascending: true }).limit(1).maybeSingle()
  if (!first) return
  const current = todayBR().slice(0, 7)
  const { data: have } = await admin.from('transactions').select('date').eq('user_id', ctx.uid).eq('type', 'salario').gte('date', `${first.date.slice(0, 7)}-01`)
  const months = new Set((have ?? []).map((r) => r.date.slice(0, 7)))
  const rows = []
  for (let m = first.date.slice(0, 7); m < current; m = shiftMonth(m, 1)) {
    if (months.has(m)) continue
    rows.push({ id: await salaryId(ctx.uid, m), user_id: ctx.uid, kind: 'income', type: 'salario', amount_cents: ctx.salaryCents, date: paydayIn(m, ctx.payday), description: 'Salário', category_id: ctx.catByName.get('Salário') ?? null, paid: true })
  }
  if (!rows.length) return
  const { error } = await admin.from('transactions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

/** Nome da pessoa no banco e no app: ajuda a reconhecer o Pix entre contas próprias. Nem todo banco manda. */
async function ownerNames(ctx: Ctx, itemId: string): Promise<string[]> {
  const names = ctx.name ? [ctx.name] : []
  try {
    const identity = await pluggy<{ fullName?: string | null }>(`/identity?itemId=${encodeURIComponent(itemId)}`)
    if (identity?.fullName) names.push(identity.fullName)
  } catch {
    // sem identidade: segue só com o nome do cadastro
  }
  return names
}

/** Sincroniza uma conexão: contas (saldo, limite, fatura) e lançamentos novos, sem duplicar. */
export async function syncConnection(admin: SupabaseClient, ctx: Ctx, conn: Conn) {
  const uid = ctx.uid
  const today = todayBR()
  // Primeira vez: desde o começo do mês de 90 dias atrás (meses inteiros). Depois: só o que é novo, com 10 dias de folga.
  const first = !conn.last_sync_at
  const from = first ? `${addDays(today, -FIRST_SYNC_DAYS).slice(0, 7)}-01` : addDays(conn.last_sync_at!.slice(0, 10), -10)

  const [{ data: open }, { data: byHand }, names] = await Promise.all([
    admin.from('transactions').select('id, amount_cents, date, paid, external_id').eq('user_id', uid).eq('type', 'fixo').gte('date', from).eq('skipped', false),
    admin.from('transactions').select('id, amount_cents, date').eq('user_id', uid).eq('type', 'dia').eq('source', 'manual').is('external_id', null).eq('skipped', false).gte('date', addDays(from, -2)),
    ownerNames(ctx, conn.item_id),
  ])
  const fixedRows = open ?? []
  // Gastos lançados à mão que o banco ainda não confirmou
  const manualRows = byHand ?? []
  const ruleSet = { has: (pattern: string) => pattern !== '' && ctx.rules.has(pattern) }

  const accounts = (await pluggy<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(conn.item_id)}`)).results ?? []
  let imported = 0
  let matched = 0
  for (const acc of accounts) {
    const { data: saved, error: accError } = await admin
      .from('bank_accounts')
      .upsert(
        {
          user_id: uid,
          connection_id: conn.id,
          external_id: acc.id,
          type: acc.type,
          subtype: acc.subtype ?? null,
          name: acc.marketingName || acc.name || conn.label,
          balance_cents: toCents(acc.balance),
          credit_limit_cents: toCents(acc.creditData?.creditLimit),
          available_cents: toCents(acc.creditData?.availableCreditLimit),
          due_date: acc.creditData?.balanceDueDate?.slice(0, 10) ?? null,
          close_date: acc.creditData?.balanceCloseDate?.slice(0, 10) ?? null,
          invested_cents: toCents(acc.bankData?.automaticallyInvestedBalance),
          overdraft_limit_cents: toCents(acc.bankData?.overdraftContractedLimit),
          overdraft_used_cents: toCents(acc.bankData?.overdraftUsedLimit),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,external_id' },
      )
      .select('id')
      .single()
    if (accError) throw accError

    // Lançamentos da conta (paginação por cursor). Entram também os pendentes até hoje
    // (compra no cartão que ainda não fechou aparece na hora, como no app do banco); os de data futura, não.
    const txs: PluggyTx[] = []
    let next: string | null = `?accountId=${encodeURIComponent(acc.id)}&dateFrom=${from}`
    for (let page = 0; next && page < 40; page++) {
      const r: { results: PluggyTx[]; next: string | null } = await pluggy(`/v2/transactions${next}`)
      txs.push(...(r.results ?? []).filter((t) => t.date.slice(0, 10) <= today))
      next = r.next
    }
    const complete = !next
    const mapped = txs.map((t) => mapTransaction(t, acc.type, names)).filter((m) => m != null)

    // O que veio do banco antes e não veio agora (dentro do período lido): a compra pendente que foi lançada
    // com outro id, ou algo que o banco desfez. Primeiro tenta reaproveitar; o que sobrar sai no fim.
    const fetchedIds = new Set(mapped.map((m) => m.external_id))
    const { data: inWindow } = await admin
      .from('transactions')
      .select('id, kind, type, amount_cents, date, external_id')
      .eq('user_id', uid).eq('bank_account_id', saved.id).gte('date', from).like('external_id', 'pluggy:%')
    const vanished = (inWindow ?? []).filter((t) => !fetchedIds.has(t.external_id))
    if (!mapped.length && !vanished.length) continue

    // O que já está no app (em lotes: a lista de ids não cabe numa consulta só quando são muitos)
    const seen = new Map<string, { id: string; type: string; skipped: boolean; emotion: string | null; note: string | null; description: string }>()
    for (const part of chunks(mapped.map((m) => m.external_id), 100)) {
      const { data, error } = await admin.from('transactions').select('id, external_id, type, skipped, emotion, note, description').eq('user_id', uid).in('external_id', part)
      if (error) throw error
      for (const s of data ?? []) seen.set(s.external_id, s)
    }

    const rows = []
    for (const m of mapped) {
      const counts = countsInMonth(m, ruleSet)
      const old = seen.get(m.external_id)
      if (old) {
        // Na primeira leitura depois de uma mudança de regra, arruma o que já tinha entrado.
        // Descrição: volta a ser a do banco, a não ser que a pessoa tenha mudado o nome
        if (first && old.type !== 'salario' && old.type !== 'fixo' && old.description !== m.description && old.description === cleanDescription(m.description)) {
          await admin.from('transactions').update({ description: m.description }).eq('id', old.id)
        }
        if (first && (m.own || m.internal) && !old.skipped && old.type !== 'salario' && old.type !== 'fixo') {
          await admin.from('transactions').update({ skipped: true, note: m.internal ?? OWN_NOTE }).eq('id', old.id)
          matched++
        } else if (first && counts && !old.skipped && old.type === 'dia' && !old.emotion && !old.note) {
          // O mesmo gasto estava duas vezes (lançado à mão e vindo do banco): fica só o da pessoa, confirmado
          const twin = findManualMatch(m, manualRows)
          if (twin) {
            await admin.from('transactions').delete().eq('id', old.id)
            await admin.from('transactions').update({ external_id: m.external_id, source: 'banco', bank_account_id: saved.id }).eq('id', twin.id)
            manualRows.splice(manualRows.indexOf(twin), 1)
            matched++
          }
        }
        continue
      }
      const link = { external_id: m.external_id, source: 'banco', bank_account_id: saved.id }

      // A mesma movimentação com outro id (pendente que foi lançada): atualiza a que já existe e mantém o que a pessoa editou
      const again = findVanished(m, vanished)
      if (again) {
        await admin.from('transactions').update({ external_id: m.external_id, date: again.type === 'salario' || again.type === 'fixo' ? again.date : m.date }).eq('id', again.id)
        vanished.splice(vanished.indexOf(again), 1)
        matched++
        continue
      }

      if (m.kind === 'income' && !m.own && !m.internal && (await linkSalary(admin, ctx, m, saved.id))) {
        matched++
        continue
      }
      // Conta fixa em aberto: marca como paga, com o valor de verdade.
      // O dia só muda dentro do mesmo mês: o fixo de cada mês tem que continuar no mês dele.
      const fixed = counts ? findFixedMatch(m, fixedRows) : null
      if (fixed) {
        const date = m.date.slice(0, 7) === fixed.date.slice(0, 7) ? m.date : fixed.date
        await admin.from('transactions').update({ ...link, amount_cents: m.amount_cents, date, paid: true }).eq('id', fixed.id)
        fixed.external_id = m.external_id
        fixed.paid = true
        matched++
        continue
      }

      // Gasto que a pessoa já lançou à mão: o banco só confirma (o nome, a categoria e o dia dela ficam)
      const twin = counts ? findManualMatch(m, manualRows) : null
      if (twin) {
        await admin.from('transactions').update(link).eq('id', twin.id)
        manualRows.splice(manualRows.indexOf(twin), 1)
        matched++
        continue
      }

      const learned = ctx.rules.get(learnKey(m.description)) ?? (m.kind === 'income' ? ctx.rules.get(countKey(m.description)) : undefined)
      const fallback = m.kind === 'income' ? 'Renda extra' : 'Outros'
      rows.push({
        user_id: uid,
        kind: m.kind,
        type: m.type,
        amount_cents: m.amount_cents,
        date: m.date,
        description: m.description,
        category_id: learned ?? ctx.catByName.get(m.categoryHint ?? '') ?? ctx.catByName.get(fallback) ?? null,
        installment_group: m.installmentKey ? await stableUuid(`${uid}|${m.installmentKey}`) : null,
        installment_no: m.installment_no,
        installment_total: m.installment_total,
        paid: true,
        skipped: !counts,
        note: m.internal ?? (m.own ? OWN_NOTE : null),
        ...link,
      })
    }
    for (const part of chunks(rows, 200)) {
      const { error } = await admin.from('transactions').upsert(part, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      if (error) throw error
    }
    imported += rows.length

    // O que o banco desfez: sai do app. Só com a leitura completa, e nunca muita coisa de uma vez
    // (se a Pluggy devolver pouco por um erro dela, nada é apagado).
    if (complete && vanished.length && vanished.length <= Math.max(3, Math.round((inWindow ?? []).length * 0.2))) {
      const gone = vanished.filter((v) => v.type !== 'salario' && v.type !== 'fixo').map((v) => v.id)
      const unlink = vanished.filter((v) => v.type === 'salario' || v.type === 'fixo').map((v) => v.id)
      if (gone.length) await admin.from('transactions').delete().in('id', gone)
      if (unlink.length) await admin.from('transactions').update({ external_id: null, bank_account_id: null }).in('id', unlink)
    } else if (vanished.length) console.warn('bank-sync: lançamentos que sumiram do banco não foram apagados', vanished.length)
  }
  await syncSavings(admin, uid, conn)
  return { imported, matched, accounts: accounts.length }
}

type PluggyInvestment = { id: string; name?: string | null; type?: string | null; subtype?: string | null; balance?: number | null; status?: string | null }

/**
 * Dinheiro guardado e investido (caixinhas, CDB, poupança…): entra como uma "conta" do tipo INVESTMENT,
 * para o app mostrar separado do dinheiro da conta. Os que foram resgatados por inteiro saem.
 */
async function syncSavings(admin: SupabaseClient, uid: string, conn: Conn) {
  let list: PluggyInvestment[]
  try {
    list = (await pluggy<{ results: PluggyInvestment[] }>(`/investments?itemId=${encodeURIComponent(conn.item_id)}`)).results ?? []
  } catch {
    return // nem todo banco libera investimentos: segue sem
  }
  const active = list.filter((i) => i.status !== 'TOTAL_WITHDRAWAL' && (i.balance ?? 0) > 0)
  for (const inv of active) {
    const { error } = await admin.from('bank_accounts').upsert(
      { user_id: uid, connection_id: conn.id, external_id: `inv:${inv.id}`, type: 'INVESTMENT', subtype: inv.subtype ?? inv.type ?? null, name: (inv.name ?? 'Investimento').slice(0, 120), balance_cents: toCents(inv.balance), credit_limit_cents: null, available_cents: null, due_date: null, close_date: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,external_id' },
    )
    if (error) throw error
  }
  const keep = new Set(active.map((i) => `inv:${i.id}`))
  const { data: saved } = await admin.from('bank_accounts').select('id, external_id').eq('user_id', uid).eq('connection_id', conn.id).eq('type', 'INVESTMENT')
  const stale = (saved ?? []).filter((a) => !keep.has(a.external_id)).map((a) => a.id)
  if (stale.length) await admin.from('bank_accounts').delete().in('id', stale)
}

/**
 * Atualiza todas as conexões de uma pessoa. `force` ignora o intervalo mínimo entre atualizações;
 * `itemId` atualiza só aquela conexão (aviso da Pluggy).
 */
export async function syncUser(admin: SupabaseClient, uid: string, opts: { force?: boolean; itemId?: string } = {}) {
  let query = admin.from('bank_connections').select('id, item_id, label, last_sync_at').eq('user_id', uid)
  if (opts.itemId) query = query.eq('item_id', opts.itemId)
  const { data: conns } = await query
  const total = { imported: 0, matched: 0, accounts: 0, errors: [] as string[] }
  const ctx = await loadCtx(admin, uid)
  total.matched += await tidySalary(admin, ctx)
  for (const conn of conns ?? []) {
    if (!opts.force && conn.last_sync_at && Date.now() - Date.parse(conn.last_sync_at) < COOLDOWN_MIN * 60_000) continue
    try {
      const r = await syncConnection(admin, ctx, conn)
      total.imported += r.imported
      total.matched += r.matched
      total.accounts += r.accounts
      await admin.from('bank_connections').update({ last_sync_at: new Date().toISOString(), status: 'ok', last_error: null }).eq('id', conn.id)
    } catch (err) {
      const expired = err instanceof PluggyError && /AUTHORIZATION_EXPIRED|CONSENT/i.test(err.code + err.message)
      const slow = (err as Error).name === 'TimeoutError'
      const message = expired
        ? 'A autorização no Meu Pluggy venceu (dura 1 ano). Conecte de novo pelo painel da Pluggy.'
        : slow
          ? 'O banco demorou para responder. Tente atualizar de novo daqui a pouco.'
          : `Não deu para atualizar: ${(err as Error).message}`.slice(0, 300)
      console.error('bank-sync', conn.label, err)
      await admin.from('bank_connections').update({ status: expired ? 'expirado' : 'erro', last_error: message }).eq('id', conn.id)
      total.errors.push(`${conn.label}: ${message}`)
    }
  }
  total.matched += await relinkSalary(admin, ctx)
  await ensurePastSalaries(admin, ctx)
  return total
}

const OWN_NOTE = 'Transferência entre contas suas: não é renda nem gasto.'

/** O item do Meu Pluggy está pronto para ser lido? Se não, diz o motivo em português. */
export function itemProblem(item: PluggyItem): string | null {
  const bank = item.connector?.name ? ` (${item.connector.name})` : ''
  const exec = String(item.executionStatus ?? '')
  if (item.status === 'UPDATING') return `O Meu Pluggy ainda está buscando os dados desse banco${bank}. Isso pode levar alguns minutos: espere terminar por lá e tente de novo.`
  if (item.status === 'WAITING_USER_INPUT' || exec === 'USER_AUTHORIZATION_PENDING') return `Falta autorizar no aplicativo do banco${bank}. Termine a autorização no Meu Pluggy e tente de novo.`
  if (item.status === 'LOGIN_ERROR' || /INVALID_CREDENTIALS|USER_AUTHORIZATION_NOT_GRANTED|USER_AUTHORIZATION_REVOKED|ACCOUNT_LOCKED|ACCOUNT_NEEDS_ACTION/.test(exec))
    return `A conexão com o banco${bank} não foi autorizada no Meu Pluggy. Conecte de novo por lá e depois cole o código aqui.`
  if (exec === 'SITE_NOT_AVAILABLE' || exec === 'CONNECTION_ERROR') return `O banco${bank} está fora do ar para o Open Finance agora. Tente mais tarde.`
  return null
}


/** Chave que a Pluggy manda de volta no aviso (derivada da chave secreta: não precisa de outro secret). */
export async function webhookKey(): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${CLIENT_SECRET}:poupei-webhook`)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

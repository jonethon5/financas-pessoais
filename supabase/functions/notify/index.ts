// Avisos no celular (Web Push), no jeito do Duolingo: o porquinho fala com a pessoa, no tom dela.
//   { action: 'subscribe', subscription, userAgent }  → liga os avisos neste aparelho (logado)
//   { action: 'unsubscribe', endpoint }                → desliga neste aparelho (logado)
//   { action: 'test' }                                 → manda um aviso de teste para os aparelhos da pessoa (logado)
//   { action: 'run', now?, dryRun? }                   → de hora em hora (GitHub Actions), com o cabeçalho
//                                                         x-cron-secret: decide e manda os avisos de todo mundo
// O que mandar fica em ../_shared/notify.ts (testado sem banco). Chaves VAPID nos secrets da função.
import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { UserError, adminClient, callerUserId, handle, json, sameSecret } from '../_shared/common.ts'
import { localNow, planPushes, type NotifyInput, type NotifyKind, type Push, type Tone } from '../_shared/notify.ts'

const PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('NOTIFY_CRON_SECRET') ?? ''
// Quem manda os avisos (exigido pelos serviços de push): o endereço do app, sem e-mail pessoal
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'https://jonethon5.github.io/financas-pessoais/'
const configured = Boolean(PUBLIC_KEY && PRIVATE_KEY)
if (configured) webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type Payload = { title: string; body: string; url: string; icon: string; tag: string }

/**
 * Entrega para um aparelho. A biblioteca web-push só criptografa e assina (VAPID); quem manda é o fetch do
 * Deno (mais confiável que o https do Node aqui). 404/410: o navegador desfez a inscrição (some da tabela).
 */
async function deliver(admin: SupabaseClient, sub: Sub, payload: Payload): Promise<boolean> {
  try {
    const req = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'normal' })
    const res = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body as Uint8Array, signal: AbortSignal.timeout(10_000) })
    await res.body?.cancel()
    if (res.status === 404 || res.status === 410) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id)
      return false
    }
    if (!res.ok) {
      console.error('push recusado', res.status)
      return false
    }
    await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', sub.id)
    return true
  } catch (err) {
    console.error('push falhou', (err as Error).message)
    return false
  }
}

const pigOf = (prefs: { pig?: { color?: string } } | null) => (prefs?.pig?.color === 'rosa' ? { name: 'Poupinha' as const, color: 'rosa' } : { name: 'Poupinho' as const, color: 'azul' })

function payloadOf(p: Push, color: string): Payload {
  // O app usa HashRouter: a tela vai depois do "#"
  return { title: p.title, body: p.body, url: `./#${p.url}`, icon: `mascote/${color}/${p.art}.webp`, tag: p.kind }
}

const monthOf = (iso: string) => iso.slice(0, 7)
const lastDay = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
const nextMonth = (ym: string) => {
  const y = +ym.slice(0, 4)
  const m = +ym.slice(5, 7)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

type ProfileRow = { id: string; name: string; nickname: string | null; ai_tone: Tone; prefs: Record<string, unknown> | null; payday: number | null; salary_cents: number | null; last_seen_on: string | null }

/** Tudo o que o aviso precisa saber da pessoa, lido do banco. */
async function inputFor(admin: SupabaseClient, p: ProfileRow, now: Date): Promise<NotifyInput | null> {
  const prefs = (p.prefs ?? {}) as { tz?: string; notify_hour?: number; notify?: Partial<Record<NotifyKind, boolean>>; pig?: { color?: string } }
  const { today, hour, weekday } = localNow(now, prefs.tz || 'America/Sao_Paulo')
  const eveningHour = Number.isInteger(prefs.notify_hour) ? Math.min(22, Math.max(6, prefs.notify_hour!)) : 20
  // Fora dos horários de aviso: nem lê o resto
  if (hour < 9 || hour >= 23) return null
  const uid = p.id
  const ym = monthOf(today)
  const until = addDays(today, 15)

  const [recs, txs, plan, wishes, goals, moves, banks, sent] = await Promise.all([
    admin.from('recurrings').select('id, description, amount_cents, day, remind, remind_days, start_month, end_month, active').eq('user_id', uid).eq('active', true),
    admin.from('transactions').select('id, description, amount_cents, date, type, recurring_id, paid, skipped').eq('user_id', uid).in('type', ['fixo', 'parcela']).gte('date', addDays(today, -5)).lte('date', until),
    admin.from('month_plans').select('split_done_at').eq('user_id', uid).eq('month', ym).maybeSingle(),
    admin.from('wishes').select('id, name').eq('user_id', uid).eq('status', 'esperando').lte('decide_on', today),
    admin.from('goals').select('id, name, target_cents').eq('user_id', uid).eq('archived', false),
    admin.from('goal_moves').select('goal_id, amount_cents').eq('user_id', uid),
    admin.from('bank_connections').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    admin.from('notification_log').select('ref').eq('user_id', uid).gte('sent_at', new Date(now.getTime() - 62 * 86_400_000).toISOString()),
  ])
  for (const r of [recs, txs, plan, wishes, goals, moves, banks, sent]) if (r.error) throw r.error

  // Contas: cada gasto fixo ativo no mês (e no próximo, se a janela de aviso chega lá), sem lançamento pago
  // ou pulado; e as parcelas ainda não pagas
  const bills: NotifyInput['bills'] = []
  const rows = txs.data ?? []
  for (const r of recs.data ?? []) {
    for (const m of [ym, nextMonth(ym)]) {
      if (r.start_month > m || (r.end_month && r.end_month < m)) continue
      const date = `${m}-${String(Math.min(r.day, lastDay(m))).padStart(2, '0')}`
      if (date > until) continue
      const row = rows.find((t) => t.recurring_id === r.id && monthOf(t.date) === m)
      if (row && (row.paid || row.skipped)) continue
      bills.push({ id: r.id, description: row?.description ?? r.description, amount_cents: row?.amount_cents ?? r.amount_cents, date: row?.date ?? date, window: r.remind ? (r.remind_days ?? 3) : 0 })
    }
  }
  for (const t of rows) if (t.type === 'parcela' && !t.paid && !t.skipped) bills.push({ id: t.id, description: t.description, amount_cents: t.amount_cents, date: t.date, window: 3 })

  const saved = new Map<string, number>()
  for (const mv of moves.data ?? []) saved.set(mv.goal_id, (saved.get(mv.goal_id) ?? 0) + Number(mv.amount_cents))

  return {
    name: p.nickname?.trim() || p.name,
    tone: p.ai_tone,
    pig: pigOf(prefs).name,
    today,
    hour,
    weekday,
    eveningHour,
    enabled: (k) => prefs.notify?.[k] ?? true,
    lastSeenOn: p.last_seen_on,
    hasBank: (banks.count ?? 0) > 0,
    payday: p.payday,
    salaryCents: p.salary_cents,
    splitDone: Boolean(plan.data?.split_done_at),
    bills,
    wishesReady: wishes.data ?? [],
    goals: (goals.data ?? []).map((g) => ({ id: g.id, name: g.name, target_cents: g.target_cents, saved_cents: saved.get(g.id) ?? 0 })),
    sent: new Set((sent.data ?? []).map((s) => s.ref)),
  }
}

/** Rodada de hora em hora: decide e manda os avisos de quem tem aparelho inscrito. */
async function runAll(admin: SupabaseClient, now: Date, dryRun: boolean) {
  const { data: subs, error } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
  if (error) throw error
  const byUser = new Map<string, Sub[]>()
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  if (!byUser.size) return { users: 0, sent: 0, planned: [] }
  const { data: profiles, error: pErr } = await admin.from('profiles').select('id, name, nickname, ai_tone, prefs, payday, salary_cents, last_seen_on').in('id', [...byUser.keys()])
  if (pErr) throw pErr

  let delivered = 0
  const planned: { user: string; kind: string; title: string; body: string }[] = []
  for (const p of (profiles ?? []) as ProfileRow[]) {
    try {
      const input = await inputFor(admin, p, now)
      if (!input) continue
      const color = pigOf(p.prefs as never).color
      for (const push of planPushes(input)) {
        planned.push({ user: p.id, kind: push.kind, title: push.title, body: push.body })
        if (dryRun) continue
        let ok = false
        for (const sub of byUser.get(p.id)!) if (await deliver(admin, sub, payloadOf(push, color))) ok = true
        // Só marca como mandado se chegou em pelo menos um aparelho (senão tenta de novo na próxima hora)
        if (ok) {
          delivered++
          await admin.from('notification_log').upsert(push.refs.map((ref) => ({ user_id: p.id, ref, kind: push.kind })), { onConflict: 'user_id,ref', ignoreDuplicates: true })
        }
      }
    } catch (err) {
      // Uma pessoa com problema não impede os avisos das outras
      console.error('avisos de', p.id, (err as Error).message)
    }
  }
  // O registro só precisa lembrar os últimos ~2 meses
  if (!dryRun) await admin.from('notification_log').delete().lt('sent_at', new Date(now.getTime() - 70 * 86_400_000).toISOString())
  return { users: byUser.size, sent: delivered, planned }
}

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const body = await req.json().catch(() => ({}))

    if (body.action === 'run') {
      const given = req.headers.get('x-cron-secret') ?? ''
      if (!CRON_SECRET || !sameSecret(given, CRON_SECRET)) throw new UserError('Não autorizado.', 401)
      if (!configured) return json({ ok: false, reason: 'Faltam as chaves VAPID nos secrets da função.' })
      const now = typeof body.now === 'string' && !Number.isNaN(Date.parse(body.now)) ? new Date(body.now) : new Date()
      return json({ ok: true, ...(await runAll(admin, now, body.dryRun === true)) })
    }

    const uid = await callerUserId(req, admin)
    if (body.action === 'status') return json({ configured })
    if (!configured) throw new UserError('Os avisos ainda não foram ligados no servidor (faltam as chaves).', 503)

    if (body.action === 'subscribe') {
      const s = body.subscription ?? {}
      const endpoint = String(s.endpoint ?? '')
      const p256dh = String(s.keys?.p256dh ?? '')
      const auth = String(s.keys?.auth ?? '')
      if (!/^https?:\/\//.test(endpoint) || endpoint.length > 1000 || p256dh.length < 20 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) throw new UserError('Inscrição de aviso inválida.')
      // O mesmo aparelho em outra conta: a inscrição passa para a conta de agora
      const { error } = await admin.from('push_subscriptions').upsert({ user_id: uid, endpoint, p256dh, auth, user_agent: String(body.userAgent ?? '').slice(0, 300) || null }, { onConflict: 'endpoint' })
      if (error) throw error
      return json({ ok: true })
    }

    if (body.action === 'unsubscribe') {
      await admin.from('push_subscriptions').delete().eq('user_id', uid).eq('endpoint', String(body.endpoint ?? ''))
      return json({ ok: true })
    }

    if (body.action === 'test') {
      const { data: subs } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', uid)
      if (!subs?.length) throw new UserError('Ligue os avisos neste aparelho primeiro.')
      const { data: p } = await admin.from('profiles').select('name, nickname, prefs').eq('id', uid).single()
      const pig = pigOf(p?.prefs ?? null)
      const first = (p?.nickname?.trim() || p?.name || '').split(/\s+/)[0]
      const payload: Payload = { title: pig.name, body: `Oi${first ? `, ${first}` : ''}! É assim que os meus avisos vão chegar. Prometo não exagerar.`, url: './#/', icon: `mascote/${pig.color}/rosto-feliz.webp`, tag: 'teste' }
      let ok = 0
      for (const s of subs) if (await deliver(admin, s, payload)) ok++
      if (!ok) throw new UserError('Não consegui entregar o aviso. Desligue e ligue de novo neste aparelho.')
      return json({ ok: true, devices: ok })
    }

    throw new UserError('Ação desconhecida.')
  }),
)

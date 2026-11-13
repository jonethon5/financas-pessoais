// Aviso da Pluggy: quando o Meu Pluggy termina de atualizar um banco ("item/updated"), a Pluggy chama
// esta função e o app busca os lançamentos novos na hora, sem esperar a pessoa abrir o app.
// A Pluggy chama com ?chave=… (derivada da chave secreta); sem ela, nada acontece.
// O endereço é registrado na Pluggy pelo scripts/pluggy-webhook.mjs (roda no deploy).
import { adminClient, corsHeaders } from '../_shared/common.ts'
import { CLIENT_SECRET, syncUser, webhookKey } from '../_shared/banksync.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const reply = (status: number, body: unknown = { ok: status < 300 }) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405)
  if (!CLIENT_SECRET) return reply(503)
  const key = new URL(req.url).searchParams.get('chave') ?? ''
  if (key !== (await webhookKey())) return reply(401)

  const body = await req.json().catch(() => ({}))
  const itemId = String(body?.itemId ?? body?.data?.itemId ?? body?.item?.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return reply(200, { ok: true, ignored: true })

  const admin = adminClient()
  const { data: conns } = await admin.from('bank_connections').select('user_id').eq('item_id', itemId)
  const users = [...new Set((conns ?? []).map((c) => c.user_id))]
  const work = (async () => {
    for (const uid of users) {
      try {
        await syncUser(admin, uid, { force: true, itemId })
      } catch (err) {
        console.error('bank-webhook', err)
      }
    }
  })()
  // Responde logo (a Pluggy espera pouco) e termina o trabalho em segundo plano
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work)
  else await work
  return reply(200, { ok: true, users: users.length })
})

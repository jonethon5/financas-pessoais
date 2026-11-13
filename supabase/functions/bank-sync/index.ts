// Conexão com o banco via Open Finance (Pluggy / Meu Pluggy). SÓ LEITURA: nunca movimenta dinheiro.
//   { action: 'status' }                    → está configurado? esta conta pode usar?
//   { action: 'connect', itemId, label }    → liga uma conexão do Meu Pluggy (o "Item ID") e já sincroniza
//   { action: 'sync', force? }              → busca contas e lançamentos novos de todas as conexões da pessoa
//   { action: 'reconcile' }                 → o salário mudou em Você: confere de novo o que veio do banco
//   { action: 'connect_token' }             → token para abrir a tela da Pluggy no app (só o conector Meu Pluggy)
// As regras ficam em ../_shared/banksync.ts e ../_shared/bankmap.ts.
import { UserError, adminClient, callerUserId, handle, json } from '../_shared/common.ts'
import { CLIENT_ID, CLIENT_SECRET, MEU_PLUGGY_CONNECTOR, PluggyError, ensurePastSalaries, itemProblem, loadCtx, pluggy, pluggyPost, relinkSalary, syncConnection, syncUser, tidySalary, type PluggyItem } from '../_shared/banksync.ts'

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const uid = await callerUserId(req, admin)
    const body = await req.json().catch(() => ({}))
    const configured = Boolean(CLIENT_ID && CLIENT_SECRET)
    // No beta: o administrador e quem entrou com um convite que libera o banco
    const { data: canUse } = await admin.rpc('can_use_bank', { p_user: uid })
    const allowed = Boolean(canUse)

    if (body.action === 'status') return json({ configured, allowed })
    // Salário mudou em Você: confere de novo o que veio do banco (não chama a Pluggy)
    if (body.action === 'reconcile') {
      const ctx = await loadCtx(admin, uid)
      const changed = (await tidySalary(admin, ctx)) + (await relinkSalary(admin, ctx))
      await ensurePastSalaries(admin, ctx)
      return json({ ok: true, changed })
    }
    if (!configured) throw new UserError('A conexão com o banco ainda não foi ligada: faltam as chaves da Pluggy nos secrets.', 503)
    if (!allowed) throw new UserError('No beta, a conexão com o banco está liberada só para quem recebeu um convite com banco.', 403)

    // Tela de conexão da Pluggy dentro do app: a pessoa entra com a própria conta do Meu Pluggy e escolhe o banco
    if (body.action === 'connect_token') {
      const res = await pluggyPost<{ accessToken: string }>('/connect_token', { clientUserId: uid })
      return json({ accessToken: res.accessToken, connectorId: MEU_PLUGGY_CONNECTOR })
    }

    if (body.action === 'connect') {
      const itemId = String(body.itemId ?? '').trim()
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new UserError('Esse não parece um Item ID. Copie o código do item na página Demo do painel da Pluggy.')
      let item: PluggyItem
      try {
        item = await pluggy<PluggyItem>(`/items/${encodeURIComponent(itemId)}`)
      } catch (err) {
        if (err instanceof PluggyError) throw new UserError(`A Pluggy não encontrou esse item (${err.status}). Confira o Item ID.`)
        if ((err as Error).name === 'TimeoutError') throw new UserError('A Pluggy demorou para responder. Tente de novo em instantes.', 504)
        throw err
      }
      const problem = itemProblem(item)
      if (problem) throw new UserError(problem, 409)
      const label = String(body.label ?? '').trim().slice(0, 40) || String(item.connector?.name ?? '').slice(0, 40) || 'Banco'
      const { data: conn, error } = await admin.from('bank_connections').upsert({ user_id: uid, item_id: itemId, label, status: 'ok', last_error: null }, { onConflict: 'user_id,item_id' }).select('id, item_id, label, last_sync_at').single()
      if (error) throw error
      const ctx = await loadCtx(admin, uid)
      await tidySalary(admin, ctx)
      const result = await syncConnection(admin, ctx, conn)
      await admin.from('bank_connections').update({ last_sync_at: new Date().toISOString(), status: 'ok', last_error: null }).eq('id', conn.id)
      result.matched += await relinkSalary(admin, ctx)
      await ensurePastSalaries(admin, ctx)
      return json({ ok: true, ...result })
    }

    if (body.action === 'sync') return json({ ok: true, ...(await syncUser(admin, uid, { force: Boolean(body.force) })) })

    throw new UserError('Ação inválida.')
  }),
)

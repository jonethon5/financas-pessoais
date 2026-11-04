// Exclui a conta de quem chamou e TODOS os dados dela (exigência da LGPD e da Play Store).
//   { confirm: 'EXCLUIR' }
// As tabelas apagam junto com o usuário (on delete cascade). As fotos do Storage são apagadas aqui.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { UserError, adminClient, callerUserId, handle, json } from '../_shared/common.ts'

const BUCKETS = ['fotos', 'feedback']

/** Lista todos os arquivos dentro da pasta (as subpastas aparecem com id nulo). */
async function listFiles(admin: SupabaseClient, bucket: string, dir: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 100, offset })
    if (error) throw error
    for (const item of data ?? []) {
      const path = `${dir}/${item.name}`
      if (item.id == null) paths.push(...(await listFiles(admin, bucket, path)))
      else paths.push(path)
    }
    if (!data || data.length < 100) break
  }
  return paths
}

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const uid = await callerUserId(req, admin)
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'EXCLUIR') throw new UserError('Digite EXCLUIR para confirmar.')

    for (const bucket of BUCKETS) {
      const files = await listFiles(admin, bucket, uid)
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100))
        if (error) throw error
      }
    }

    const { error } = await admin.auth.admin.deleteUser(uid)
    if (error) throw error
    return json({ ok: true })
  }),
)

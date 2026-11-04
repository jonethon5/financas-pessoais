// Conta de verdade: dados no Supabase. O RLS do banco garante que cada pessoa só acessa o que é dela.
import { callFunction, supabase } from '../lib/supabase'
import type { AdminFeedback, AdminStats, BetaCode, Feedback, Profile } from '../types'
import type { Backend } from './backend'

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sua sessão expirou. Entre de novo.')
  return id
}

function check<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error
  return result.data as T
}

export const supabaseBackend: Backend = {
  kind: 'supabase',

  async getProfile() {
    const id = await uid()
    return check(await supabase.from('profiles').select('*').eq('id', id).single<Profile>())
  },

  async updateProfile(patch) {
    const id = await uid()
    return check(await supabase.from('profiles').update(patch).eq('id', id).select('*').single<Profile>())
  },

  async setAvatar(image) {
    const id = await uid()
    const current = check(await supabase.from('profiles').select('avatar_path').eq('id', id).single<{ avatar_path: string | null }>())
    let path: string | null = null
    if (image) {
      // Nome novo a cada troca: o celular não mostra a foto antiga guardada em cache
      path = `${id}/avatar-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('fotos').upload(path, image, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
    }
    const profile = check(await supabase.from('profiles').update({ avatar_path: path }).eq('id', id).select('*').single<Profile>())
    if (current.avatar_path && current.avatar_path !== path) await supabase.storage.from('fotos').remove([current.avatar_path])
    return profile
  },

  async fileUrl(bucket, path) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
    if (error || !data) throw error ?? new Error('Arquivo não encontrado.')
    return data.signedUrl
  },

  async sendFeedback({ kind, message, context, screenshot }) {
    const id = await uid()
    let screenshot_path: string | null = null
    if (screenshot) {
      screenshot_path = `${id}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('feedback').upload(screenshot_path, screenshot, { contentType: 'image/jpeg' })
      if (error) throw error
    }
    const { error } = await supabase.from('feedback').insert({ kind, message, context, screenshot_path })
    if (error) throw error
  },

  async listMyFeedback() {
    const id = await uid()
    return check(await supabase.from('feedback').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50)) as Feedback[]
  },

  async deleteAccount() {
    await callFunction('delete-account', { confirm: 'EXCLUIR' })
  },

  admin: {
    async stats() {
      return check(await supabase.rpc('admin_stats')) as AdminStats
    },
    async feedback() {
      return check(await supabase.rpc('admin_feedback')) as AdminFeedback[]
    },
    async setFeedbackStatus(id, status) {
      check(await supabase.from('feedback').update({ status }).eq('id', id))
    },
    async codes() {
      return check(await supabase.from('beta_codes').select('*').order('created_at', { ascending: false })) as BetaCode[]
    },
    async createCode({ code, note, max_uses }) {
      const created_by = await uid()
      check(await supabase.from('beta_codes').insert({ code, note, max_uses, created_by }))
    },
    async setCodeActive(code, active) {
      check(await supabase.from('beta_codes').update({ active }).eq('code', code))
    },
    async deleteCode(code) {
      check(await supabase.from('beta_codes').delete().eq('code', code))
    },
    async betaRequired() {
      const status = check(await supabase.rpc('app_status')) as { beta_code_required: boolean }
      return status.beta_code_required
    },
    async setBetaRequired(required) {
      check(await supabase.from('app_settings').update({ value: required, updated_at: new Date().toISOString() }).eq('key', 'beta_code_required'))
    },
  },
}

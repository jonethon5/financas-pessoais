import { createContext, useContext } from 'react'
import type { AdminFeedback, AdminStats, BetaCode, Bucket, Feedback, FeedbackKind, FeedbackStatus, Profile, ProfilePatch } from '../types'

export type FeedbackInput = {
  kind: FeedbackKind
  message: string
  /** Versão do app, tela e aparelho */
  context: Record<string, string>
  screenshot?: Blob | null
}

export type NewBetaCode = { code: string; note: string | null; max_uses: number }

/**
 * Tudo que o app lê e grava passa por aqui. Duas implementações:
 *  - supabaseBackend: conta de verdade (dados no Supabase, protegidos por RLS)
 *  - localBackend: modo demonstração (dados de exemplo só neste aparelho)
 */
export interface Backend {
  readonly kind: 'supabase' | 'local'

  getProfile(): Promise<Profile>
  updateProfile(patch: ProfilePatch): Promise<Profile>
  /** Troca a foto do perfil (já recortada e reduzida). null remove a foto. */
  setAvatar(image: Blob | null): Promise<Profile>
  /** Endereço temporário para mostrar um arquivo privado. */
  fileUrl(bucket: Bucket, path: string): Promise<string>

  sendFeedback(input: FeedbackInput): Promise<void>
  listMyFeedback(): Promise<Feedback[]>

  /** Apaga a conta e todos os dados (no modo demonstração: volta aos dados de exemplo). */
  deleteAccount(): Promise<void>

  admin: {
    stats(): Promise<AdminStats>
    feedback(): Promise<AdminFeedback[]>
    setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void>
    codes(): Promise<BetaCode[]>
    createCode(input: NewBetaCode): Promise<void>
    setCodeActive(code: string, active: boolean): Promise<void>
    deleteCode(code: string): Promise<void>
    betaRequired(): Promise<boolean>
    setBetaRequired(required: boolean): Promise<void>
  }
}

export const BackendContext = createContext<Backend | null>(null)

export function useBackend(): Backend {
  const backend = useContext(BackendContext)
  if (!backend) throw new Error('useBackend fora do BackendContext')
  return backend
}

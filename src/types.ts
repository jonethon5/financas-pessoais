// Tipos das tabelas (iguais às colunas do banco em supabase/migrations). Dinheiro sempre em centavos.

export type AiTone = 'suave' | 'equilibrado' | 'agressivo'

/** Tipos de aviso que a pessoa liga/desliga em Você › Avisos */
export type NotifyKind = 'vencimentos' | 'pagamento' | 'limite' | 'revisao' | 'desejos' | 'metas'

export type Prefs = {
  notify?: Partial<Record<NotifyKind, boolean>>
}

export type Profile = {
  id: string
  name: string
  nickname: string | null
  avatar_path: string | null
  birthday: string | null
  payday: number | null
  salary_cents: number | null
  work_hours_week: number
  ai_tone: AiTone
  money_profile: string | null
  prefs: Prefs
  onboarded_at: string | null
  is_admin: boolean
  beta_code: string | null
  created_at: string
  updated_at: string
}

export type ProfilePatch = Partial<
  Pick<Profile, 'name' | 'nickname' | 'avatar_path' | 'birthday' | 'payday' | 'salary_cents' | 'work_hours_week' | 'ai_tone' | 'money_profile' | 'prefs' | 'onboarded_at'>
>

export type FeedbackKind = 'sugestao' | 'problema' | 'elogio'
export type FeedbackStatus = 'novo' | 'lido' | 'resolvido'

export type Feedback = {
  id: string
  user_id: string
  kind: FeedbackKind
  message: string
  screenshot_path: string | null
  context: Record<string, string>
  status: FeedbackStatus
  created_at: string
}

export type AdminFeedback = Omit<Feedback, 'user_id'> & { sender_name: string | null; sender_email: string | null }

export type BetaCode = {
  code: string
  note: string | null
  max_uses: number
  uses: number
  expires_at: string | null
  active: boolean
  created_at: string
}

export type AdminStats = { users: number; users_7d: number; onboarded: number; feedback_new: number }

export type Bucket = 'fotos' | 'feedback'

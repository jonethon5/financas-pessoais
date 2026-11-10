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
  about: About
  prefs: Prefs
  onboarded_at: string | null
  is_admin: boolean
  beta_code: string | null
  created_at: string
  updated_at: string
}

export type ProfilePatch = Partial<
  Pick<Profile, 'name' | 'nickname' | 'avatar_path' | 'birthday' | 'payday' | 'salary_cents' | 'work_hours_week' | 'ai_tone' | 'money_profile' | 'about' | 'prefs' | 'onboarded_at'>
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

// ---------------------------------------------------------------------------
// Fase 1: base do orçamento
// ---------------------------------------------------------------------------

export type CategoryGroup = 'necessidade' | 'desejo'

export type Category = {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  kind: 'expense' | 'income'
  grp: CategoryGroup
  monthly_limit_cents: number | null
  weekly_limit_cents: number | null
  sort: number
  archived: boolean
  created_at: string
}

export type Recurring = {
  id: string
  user_id: string
  description: string
  category_id: string | null
  amount_cents: number
  day: number
  remind: boolean
  start_month: string
  end_month: string | null
  active: boolean
  created_at: string
}

export type TxType = 'salario' | 'extra' | 'fixo' | 'dia' | 'parcela'
export type Emotion = 'comemorando' | 'estressado' | 'entediado' | 'cansado'

export type Transaction = {
  id: string
  user_id: string
  kind: 'income' | 'expense'
  type: TxType
  amount_cents: number
  date: string
  description: string
  category_id: string | null
  recurring_id: string | null
  installment_group: string | null
  installment_no: number | null
  installment_total: number | null
  emotion: Emotion | null
  paid: boolean
  skipped: boolean
  note: string | null
  created_at: string
}

export type BudgetMove = {
  id: string
  user_id: string
  month: string
  from_category: string
  to_category: string
  amount_cents: number
  created_at: string
}

export type MonthPlan = {
  id: string
  user_id: string
  month: string
  save_cents: number
  split_done_at: string | null
  created_at: string
}

/** Tabelas com leitura/gravação genérica (mesmo formato no Supabase e na demonstração). */
export type Tables = {
  categories: Category
  recurrings: Recurring
  transactions: Transaction
  budget_moves: BudgetMove
  month_plans: MonthPlan
  goals: Goal
  goal_moves: GoalMove
  challenges: Challenge
  rules: Rule
  wishes: Wish
  if_then_plans: IfThenPlan
}
export type TableName = keyof Tables
/** O que o app envia ao criar uma linha (id, user_id e created_at têm padrão). */
export type NewRow<K extends TableName> = Omit<Tables[K], 'user_id' | 'created_at' | 'id'> & { id?: string }

// ---------------------------------------------------------------------------
// Fase 2: caixinhas
// ---------------------------------------------------------------------------

export type GoalMode = 'data' | 'mensal' | 'livre'

export type Goal = {
  id: string
  user_id: string
  name: string
  template: string
  icon: string
  color: string
  photo_path: string | null
  /** O porquê da pessoa (mensagem motivacional) */
  motivation: string | null
  /** "isso equivale a…": item concreto e o preço dele (ex.: diária do hotel, R$ 250) */
  concrete_name: string | null
  concrete_cents: number | null
  mode: GoalMode
  target_cents: number | null
  target_month: string | null
  monthly_cents: number | null
  priority: number
  archived: boolean
  completed_at: string | null
  created_at: string
}

export type GoalMove = {
  id: string
  user_id: string
  goal_id: string
  kind: 'deposito' | 'retirada' | 'inicial'
  amount_cents: number
  date: string
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Fase 3: psicologia para guardar
// ---------------------------------------------------------------------------

/** Respostas do primeiro acesso */
export type About = {
  goal?: string
  age?: string
  work?: string
  home?: string
  answers?: Record<string, string>
}

export type ChallengeKind = 'sem_delivery' | 'sem_shopee' | 'sem_impulso' | '52_semanas' | 'personalizado'

export type Challenge = {
  id: string
  user_id: string
  kind: ChallengeKind
  title: string
  params: { base_cents?: number; category_ids?: string[]; words?: string[] }
  goal_id: string | null
  started_on: string
  ends_on: string
  status: 'ativo' | 'concluido' | 'desistiu'
  created_at: string
}

export type RuleKind = 'arredondar' | 'sobra_limite' | 'renda_extra' | 'prazer_culpado'

export type Rule = {
  id: string
  user_id: string
  kind: RuleKind
  goal_id: string
  params: { step_cents?: number; pct?: number; category_id?: string; amount_cents?: number }
  active: boolean
  created_at: string
}

export type Wish = {
  id: string
  user_id: string
  name: string
  price_cents: number
  link: string | null
  decide_on: string
  status: 'esperando' | 'comprei' | 'desisti'
  decided_at: string | null
  created_at: string
}

export type IfThenPlan = {
  id: string
  user_id: string
  trigger_text: string
  action_text: string
  weekday: number | null
  active: boolean
  created_at: string
}

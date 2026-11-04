// Modo demonstração: dados de exemplo guardados só neste aparelho (localStorage).
// Usado enquanto o Supabase não está configurado, ou quando a pessoa toca em "Ver demonstração".
import { blobToDataUrl } from '../lib/image'
import type { Feedback, Profile } from '../types'
import type { Backend } from './backend'

const PREFIX = 'poupei:demo:'

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  const value = fallback()
  write(key, value)
  return value
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* modo privado ou cheio: segue só na memória desta visita */
  }
}

const now = () => new Date().toISOString()

function seedProfile(): Profile {
  return {
    id: 'demo',
    name: 'Ana Souza',
    nickname: 'Ana',
    avatar_path: null,
    birthday: null,
    payday: 5,
    salary_cents: 320000,
    work_hours_week: 44,
    ai_tone: 'equilibrado',
    money_profile: null,
    prefs: {},
    onboarded_at: now(),
    is_admin: false,
    beta_code: null,
    created_at: now(),
    updated_at: now(),
  }
}

/** Apaga tudo que a demonstração guardou neste aparelho. */
export function resetDemo() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  } catch {
    /* nada a apagar */
  }
}

const unavailable = async (): Promise<never> => {
  throw new Error('Disponível só com uma conta de verdade.')
}

export const localBackend: Backend = {
  kind: 'local',

  async getProfile() {
    return read('profile', seedProfile)
  },

  async updateProfile(patch) {
    const profile = { ...read('profile', seedProfile), ...patch, updated_at: now() }
    write('profile', profile)
    return profile
  },

  async setAvatar(image) {
    const files = read<Record<string, string>>('files', () => ({}))
    const profile = read('profile', seedProfile)
    if (profile.avatar_path) delete files[profile.avatar_path]
    let path: string | null = null
    if (image) {
      path = `demo/avatar-${Date.now()}.jpg`
      files[path] = await blobToDataUrl(image)
    }
    write('files', files)
    return this.updateProfile({ avatar_path: path })
  },

  async fileUrl(_bucket, path) {
    const files = read<Record<string, string>>('files', () => ({}))
    const url = files[path]
    if (!url) throw new Error('Arquivo não encontrado.')
    return url
  },

  async sendFeedback({ kind, message, context }) {
    const list = read<Feedback[]>('feedback', () => [])
    list.unshift({ id: crypto.randomUUID(), user_id: 'demo', kind, message, context, screenshot_path: null, status: 'novo', created_at: now() })
    write('feedback', list.slice(0, 50))
  },

  async listMyFeedback() {
    return read<Feedback[]>('feedback', () => [])
  },

  async deleteAccount() {
    resetDemo()
  },

  admin: {
    stats: unavailable,
    feedback: unavailable,
    setFeedbackStatus: unavailable,
    codes: unavailable,
    createCode: unavailable,
    setCodeActive: unavailable,
    deleteCode: unavailable,
    betaRequired: unavailable,
    setBetaRequired: unavailable,
  },
}

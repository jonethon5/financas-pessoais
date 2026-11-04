// Modo demonstração: dados de exemplo guardados só neste aparelho (localStorage).
// Usado enquanto o Supabase não está configurado, ou quando a pessoa toca em "Ver demonstração".
import { blobToDataUrl } from '../lib/image'
import type { Feedback, Profile, TableName, Tables } from '../types'
import type { Backend, ListQuery } from './backend'
import { buildDemoData } from './demoSeed'

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

let seeding: Promise<void> | null = null

/** Na primeira vez, cria os dados de exemplo (um mês realista e o histórico). */
async function ensureSeed() {
  if (read('seeded', () => false)) return
  seeding ??= buildDemoData().then((data) => {
    for (const [table, rows] of Object.entries(data)) write(`t:${table}`, rows)
    write('seeded', true)
  })
  await seeding
  seeding = null
}

type AnyRow = Record<string, unknown> & { id: string }
const rowsOf = (table: TableName) => read<AnyRow[]>(`t:${table}`, () => [])

function matches(row: AnyRow, q: ListQuery): boolean {
  for (const [col, value] of Object.entries(q.eq ?? {})) if (row[col] !== value) return false
  if (q.gte && String(row[q.gte[0]]) < q.gte[1]) return false
  if (q.lte && String(row[q.lte[0]]) > q.lte[1]) return false
  return true
}

const unavailable = async (): Promise<never> => {
  throw new Error('Disponível só com uma conta de verdade.')
}

export const localBackend: Backend = {
  kind: 'local',

  async list<K extends TableName>(table: K, q: ListQuery = {}) {
    await ensureSeed()
    const col = q.order ?? 'created_at'
    return rowsOf(table)
      .filter((r) => matches(r, q))
      .sort((a, b) => {
        const x = a[col]
        const y = b[col]
        const byValue = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))
        return byValue || a.id.localeCompare(b.id)
      }) as unknown as Tables[K][]
  },

  async insert(table, rows, opts) {
    await ensureSeed()
    const all = rowsOf(table)
    const ids = new Set(all.map((r) => r.id))
    for (const row of rows) {
      const id = row.id ?? crypto.randomUUID()
      if (ids.has(id)) {
        if (opts?.ignoreDuplicates) continue
        throw new Error('Esse registro já existe.')
      }
      ids.add(id)
      all.push({ ...(row as Record<string, unknown>), id, user_id: 'demo', created_at: now() })
    }
    write(`t:${table}`, all)
  },

  async update(table, id, patch) {
    write(`t:${table}`, rowsOf(table).map((r) => (r.id === id ? { ...r, ...(patch as Record<string, unknown>), id } : r)))
  },

  async remove(table, ids) {
    const gone = new Set(ids)
    write(`t:${table}`, rowsOf(table).filter((r) => !gone.has(r.id)))
  },

  async upsert(table, row, onConflict) {
    await ensureSeed()
    const cols = onConflict.split(',').map((c) => c.trim())
    const data: Record<string, unknown> = { ...(row as Record<string, unknown>), user_id: 'demo' }
    const all = rowsOf(table)
    const found = all.find((r) => cols.every((c) => r[c] === data[c]))
    if (found) Object.assign(found, data, { id: found.id })
    else all.push({ ...data, id: (data.id as string) ?? crypto.randomUUID(), created_at: now() })
    write(`t:${table}`, all)
  },

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

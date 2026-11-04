// Categorias padrão (a partir da planilha de orçamento do usuário) e as opções para editar.
import type { CategoryGroup, NewRow } from '../types'

type Def = { name: string; icon: string; color: string; kind?: 'expense' | 'income'; grp?: CategoryGroup }

const DEFS: Def[] = [
  { name: 'Casa', icon: 'house', color: '#0B7F5A', grp: 'necessidade' },
  { name: 'Mercado', icon: 'shopping-cart', color: '#0E9AA7', grp: 'necessidade' },
  { name: 'Transporte', icon: 'bus', color: '#2F6F8F', grp: 'necessidade' },
  { name: 'Educação', icon: 'graduation-cap', color: '#0F2433', grp: 'necessidade' },
  { name: 'Saúde', icon: 'heart-pulse', color: '#E5484D', grp: 'necessidade' },
  { name: 'Telefone e internet', icon: 'smartphone', color: '#5B6B7A', grp: 'necessidade' },
  { name: 'Assinaturas', icon: 'tv', color: '#6E56F0' },
  { name: 'Delivery', icon: 'utensils', color: '#FF6B4A' },
  { name: 'Lazer', icon: 'ticket', color: '#F2A516' },
  { name: 'Roupas', icon: 'shirt', color: '#C2410C' },
  { name: 'Compras online', icon: 'package', color: '#8A5A06' },
  { name: 'Cuidados pessoais', icon: 'scissors', color: '#D6457A' },
  { name: 'Cursos e livros', icon: 'book-open', color: '#3E7CB1' },
  { name: 'Outros', icon: 'receipt', color: '#8A94A0' },
  { name: 'Salário', icon: 'wallet', color: '#0B7F5A', kind: 'income' },
  { name: 'Renda extra', icon: 'banknote', color: '#0F9D6B', kind: 'income' },
]

export function defaultCategories(): NewRow<'categories'>[] {
  return DEFS.map((d, i) => ({
    name: d.name,
    icon: d.icon,
    color: d.color,
    kind: d.kind ?? 'expense',
    grp: d.grp ?? 'desejo',
    monthly_limit_cents: null,
    weekly_limit_cents: null,
    sort: i,
    archived: false,
  }))
}

/** Ícones de linha disponíveis para as categorias (nomes do lucide). */
export const CATEGORY_ICONS = [
  'house', 'shopping-cart', 'bus', 'car', 'fuel', 'graduation-cap', 'heart-pulse', 'pill', 'smartphone', 'wifi', 'zap', 'droplet',
  'tv', 'music', 'utensils', 'coffee', 'ticket', 'gamepad-2', 'shirt', 'package', 'scissors', 'book-open', 'dumbbell', 'gift',
  'paw-print', 'baby', 'plane', 'hammer', 'briefcase', 'receipt', 'wallet', 'banknote',
] as const

/** Cores das categorias (só aparecem em gráficos e marcadores; os ícones continuam numa cor só). */
export const CATEGORY_COLORS = ['#0B7F5A', '#0F9D6B', '#0E9AA7', '#2F6F8F', '#3E7CB1', '#0F2433', '#5B6B7A', '#6E56F0', '#9C6ADE', '#D6457A', '#FF6B4A', '#C2410C', '#F2A516', '#8A5A06', '#E5484D', '#8A94A0']

export const GROUP_LABEL: Record<CategoryGroup, string> = { necessidade: 'Necessidade', desejo: 'Desejo' }

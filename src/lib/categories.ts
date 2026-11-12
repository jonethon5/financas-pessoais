// Categorias padrão (a partir da planilha de orçamento do usuário) e as opções para editar.
import type { CategoryGroup, NewRow } from '../types'

export type CategoryDef = Def
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
  'house', 'key', 'lightbulb', 'zap', 'droplet', 'fire', 'wifi', 'smartphone', 'broom', 'couch', 'bed', 'washing', 'plant', 'hammer', 'wrench',
  'shopping-cart', 'utensils', 'cooking', 'coffee', 'pizza', 'burger', 'beer', 'wine', 'cake', 'popcorn',
  'bus', 'train', 'taxi', 'car', 'motorcycle', 'bike', 'fuel', 'steering', 'plane',
  'heart-pulse', 'pill', 'first-aid', 'stethoscope', 'tooth', 'glasses', 'dumbbell', 'run', 'scissors', 'sparkle',
  'graduation-cap', 'book-open', 'books', 'backpack', 'laptop', 'briefcase',
  'tv', 'music', 'headphones', 'film', 'guitar', 'gamepad-2', 'ticket', 'soccer', 'camera', 'tent', 'mountains', 'sun', 'confetti',
  'shirt', 'dress', 'sneaker', 'watch', 'shopping-bag', 'store', 'package', 'tag', 'gift',
  'baby', 'users', 'heart', 'paw-print', 'dog', 'cat', 'church', 'hand-heart', 'cigarette',
  'wallet', 'banknote', 'coins', 'hand-coins', 'piggy-bank', 'credit-card', 'bank', 'trend-up', 'percent', 'scales', 'calculator', 'umbrella', 'handshake', 'receipt',
] as const

/** Cores das categorias (só aparecem em gráficos e marcadores; os ícones continuam numa cor só). */
export const CATEGORY_COLORS = ['#0B7F5A', '#0F9D6B', '#0E9AA7', '#2F6F8F', '#3E7CB1', '#0F2433', '#5B6B7A', '#6E56F0', '#9C6ADE', '#D6457A', '#FF6B4A', '#C2410C', '#F2A516', '#8A5A06', '#E5484D', '#8A94A0']

export const GROUP_LABEL: Record<CategoryGroup, string> = { necessidade: 'Necessidade', desejo: 'Desejo' }

/**
 * Categorias prontas que a pessoa pode adicionar com um toque (além das padrão).
 * Ficam no "Mais" do lançamento; "Outros" continua sendo a última opção.
 */
export const EXTRA_CATEGORIES: CategoryDef[] = [
  { name: 'Bares e restaurantes', icon: 'beer', color: '#C2410C' },
  { name: 'Café e lanches', icon: 'coffee', color: '#8A5A06' },
  { name: 'Combustível', icon: 'fuel', color: '#2F6F8F', grp: 'necessidade' },
  { name: 'Carro e moto', icon: 'steering', color: '#5B6B7A', grp: 'necessidade' },
  { name: 'Farmácia', icon: 'pill', color: '#E5484D', grp: 'necessidade' },
  { name: 'Academia', icon: 'dumbbell', color: '#0F9D6B' },
  { name: 'Pets', icon: 'paw-print', color: '#9C6ADE' },
  { name: 'Filhos', icon: 'baby', color: '#3E7CB1', grp: 'necessidade' },
  { name: 'Família', icon: 'users', color: '#D6457A' },
  { name: 'Presentes', icon: 'gift', color: '#D6457A' },
  { name: 'Viagem', icon: 'plane', color: '#0E9AA7' },
  { name: 'Jogos', icon: 'gamepad-2', color: '#6E56F0' },
  { name: 'Festas e saídas', icon: 'confetti', color: '#F2A516' },
  { name: 'Eletrônicos', icon: 'laptop', color: '#0F2433' },
  { name: 'Casa e reforma', icon: 'hammer', color: '#8A5A06' },
  { name: 'Limpeza', icon: 'broom', color: '#0E9AA7', grp: 'necessidade' },
  { name: 'Luz, água e gás', icon: 'lightbulb', color: '#F2A516', grp: 'necessidade' },
  { name: 'Aluguel', icon: 'key', color: '#0B7F5A', grp: 'necessidade' },
  { name: 'Dívidas e empréstimos', icon: 'hand-coins', color: '#E5484D', grp: 'necessidade' },
  { name: 'Tarifas do banco', icon: 'bank', color: '#5B6B7A', grp: 'necessidade' },
  { name: 'Impostos e taxas', icon: 'scales', color: '#0F2433', grp: 'necessidade' },
  { name: 'Seguros', icon: 'umbrella', color: '#3E7CB1', grp: 'necessidade' },
  { name: 'Doações e igreja', icon: 'hand-heart', color: '#9C6ADE' },
  { name: 'Cigarro e bebida', icon: 'cigarette', color: '#8A94A0' },
  { name: 'Freela e bicos', icon: 'briefcase', color: '#0F9D6B', kind: 'income' },
  { name: 'Vendas', icon: 'tag', color: '#0E9AA7', kind: 'income' },
  { name: 'Benefícios', icon: 'hand-coins', color: '#3E7CB1', kind: 'income' },
  { name: 'Presente em dinheiro', icon: 'gift', color: '#D6457A', kind: 'income' },
]

/** Linha pronta para gravar a partir de uma categoria sugerida. */
export function categoryRow(d: CategoryDef, sort = 90): NewRow<'categories'> {
  return { name: d.name, icon: d.icon, color: d.color, kind: d.kind ?? 'expense', grp: d.grp ?? 'desejo', monthly_limit_cents: null, weekly_limit_cents: null, sort, archived: false }
}

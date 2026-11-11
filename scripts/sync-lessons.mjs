// Gera supabase/functions/_shared/lessons.ts a partir de src/lib/learn.ts (as lições do Aprender).
// É a base de métodos que o assistente pode recomendar: a IA não inventa método, usa só estes.
// Roda sozinho antes do dev/build (Node 22.6+ lê TypeScript direto).
import { writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const { LESSONS, SOURCE_LABEL } = await import(new URL('src/lib/learn.ts', root).href)

const text = LESSONS.map((l) =>
  [
    `### Lição "${l.title}"`,
    l.short,
    `Como fazer: ${l.steps.join(' ')}`,
    `Exemplo: ${l.example}`,
    `Fontes: ${l.sources.map((s) => `${SOURCE_LABEL[s.kind]}: ${s.text}`).join('; ')}`,
  ].join('\n'),
).join('\n\n')

writeFileSync(
  new URL('supabase/functions/_shared/lessons.ts', root),
  `// Gerado por scripts/sync-lessons.mjs a partir de src/lib/learn.ts. Não edite à mão.\nexport const LESSONS_TEXT = ${JSON.stringify(text)}\n`,
)

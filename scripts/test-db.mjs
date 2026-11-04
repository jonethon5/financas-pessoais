// Roda os testes de integração (tests/db) contra o Supabase LOCAL, pegando as chaves do "supabase status".
import { execSync, spawnSync } from 'node:child_process'

let status
try {
  status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  console.error('O Supabase local não está rodando. Rode "npm run db:start" primeiro (precisa do Docker).')
  process.exit(1)
}
const env = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
const result = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.db.config.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SUPABASE_URL: env.API_URL, SUPABASE_ANON_KEY: env.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY },
})
process.exit(result.status ?? 1)

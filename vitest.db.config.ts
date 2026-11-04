import { defineConfig } from 'vitest/config'

// Testes de integração contra o Supabase LOCAL (precisa do Docker): npm run db:start && npm run test:db
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})

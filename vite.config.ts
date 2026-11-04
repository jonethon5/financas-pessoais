/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Nome e textos do app ficam num lugar só: brand.json
const brand = JSON.parse(readFileSync(new URL('./brand.json', import.meta.url), 'utf8')) as {
  name: string
  shortName: string
  description: string
  backgroundColor: string
}

// Caminho do site no GitHub Pages: https://<usuario>.github.io/<repositorio>/
// O workflow de deploy define BASE_PATH com o nome real do repositório.
const base = process.env.BASE_PATH ?? '/financas-pessoais/'

/** Troca %APP_NAME% e %APP_DESCRIPTION% no index.html. */
function brandHtml(): Plugin {
  return {
    name: 'brand-html',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', brand.name).replaceAll('%APP_DESCRIPTION%', brand.description),
  }
}

export default defineConfig({
  base,
  // Porta própria (a 5173 costuma estar ocupada pelo app anterior)
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    react(),
    tailwindcss(),
    brandHtml(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: brand.name,
        short_name: brand.shortName,
        description: brand.description,
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: brand.backgroundColor,
        background_color: brand.backgroundColor,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Da fonte, só os caracteres usados em português vão para o modo offline
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        navigateFallback: `${base}index.html`,
        // Recebe as notificações push (avisos)
        importScripts: ['push-sw.js'],
        // Consultas (GET) ao Supabase ficam em cache para abrir o app offline e ver os últimos dados.
        // O cache é apagado ao sair da conta.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    // A pasta fica no OneDrive: limpar o dist antes evita arquivos velhos travados
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})

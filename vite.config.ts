/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Olm is a CommonJS module; let Vite pre-bundle it so `import Olm from
  // '@matrix-org/olm'` gets a real default export in the dev server too.
  // (The WASM binary is pulled in separately via the `?url` import.)
  optimizeDeps: {
    include: ['@matrix-org/olm'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Olm's WASM init is slow to spin up the first time.
    testTimeout: 20_000,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})

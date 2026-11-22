import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The GitHub Pages path of the MrCYlmz/dew-mollys-squad repo.
  base: '/dew-mollys-squad/',
  plugins: [preact()],
  // Three.js alone is above Vite's 500 kB warning; scripts/check-size.mjs enforces the real budget.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})

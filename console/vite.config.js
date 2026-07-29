import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The console ships under the marketing origin at /app (same-origin so the
// Supabase auth session in localStorage is shared with /signin). `base`
// makes every built asset URL absolute under /app/, and the modulePreload
// polyfill is disabled because it would inject an inline <script>, which the
// marketing site's strict CSP (script-src 'self', no unsafe-inline) blocks.
// https://vite.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    modulePreload: { polyfill: false },
  },
  server: {
    // The partner-integration endpoints live on the Express host. Proxying them
    // means "Sync from partner" works in `npm run dev` too, not just at :8420.
    proxy: {
      '/api': { target: 'http://localhost:8420', changeOrigin: true },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo at https://amirrezamdi23.github.io/planner/
// so every asset path must be relative to that subfolder, not the domain root.
const REPO_BASE = '/planner/'

// https://vite.dev/config/
export default defineConfig({
  base: REPO_BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Everything the app needs (HTML/JS/CSS) is precached so the whole app
      // works with zero network — that's the point of phase 0.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'دفترچه‌ی روزانه',
        short_name: 'دفترچه',
        description: 'دفترچه‌ی روزانه‌ی شخصی — عادت‌ها، کارها، مرور روزانه',
        lang: 'fa',
        dir: 'rtl',
        start_url: REPO_BASE,
        scope: REPO_BASE,
        display: 'standalone',
        background_color: '#EAE6D9',
        theme_color: '#EAE6D9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})

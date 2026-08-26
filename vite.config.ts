import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Two build targets from one codebase:
//
//  - 'web'    → GitHub Pages, served from https://amirrezamdi23.github.io/planner/,
//               so assets must resolve under that subfolder, and the PWA service
//               worker is what makes it installable + offline.
//
//  - 'native' → the bundle Capacitor wraps into the Android/iOS app. Capacitor
//               serves it from the root of a local origin (https://localhost/),
//               so a '/planner/' base would 404 every asset. The service worker
//               is also dropped there: the native shell already ships the assets
//               locally, and a stale SW cache would silently pin an old build.
//
// Select with `vite build --mode native` (see the build:native script).
const REPO_BASE = '/planner/'

export default defineConfig(({ mode }) => {
  const isNative = mode === 'native'
  return {
    base: isNative ? './' : REPO_BASE,
    plugins: [
      react(),
      ...(isNative
        ? []
        : [
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
        ]),
    ],
  }
})

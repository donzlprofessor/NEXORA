import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'NEXORA_')
  const target = env.NEXORA_BACKEND_URL || 'http://127.0.0.1:8000'
  const url = new URL(target)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('NEXORA backend must use a local HTTP URL')
  return {
    plugins: [vue(), vueDevTools(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target } } },
    preview: { host: '127.0.0.1', port: 4173, proxy: { '/api': { target } } },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})

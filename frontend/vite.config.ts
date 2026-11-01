import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'NEXORA_')
  const publicDemo = mode === 'public-demo'
  const target = env.NEXORA_BACKEND_URL || 'http://127.0.0.1:8000'
  const url = new URL(target)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('NEXORA backend must use a local HTTP URL')
  return {
    plugins: [
      vue(),
      ...(!publicDemo && mode === 'development' ? [vueDevTools()] : []),
      tailwindcss(),
    ],
    ...(publicDemo
      ? {
          define: {
            'import.meta.env.VITE_PUBLIC_DEMO': JSON.stringify('true'),
            'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
          },
        }
      : {}),
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: publicDemo ? undefined : { '/api': { target } },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy: publicDemo ? undefined : { '/api': { target } },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { i18n } from './i18n'
import { useAuthStore } from './stores/auth'
import router from './router'

import './assets/tailwind.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
window.addEventListener('nexora-session-expired', () => {
  const auth = useAuthStore()
  auth.error = 'Your session expired. Sign in again; browser records are preserved.'
  void auth.clearAccount().then(() => router.push('/login'))
})

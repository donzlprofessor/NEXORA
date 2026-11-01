import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, setCsrf, ApiError } from '@/services/http'
import type { Customer } from './customers'
import type { Transaction } from './finance'
import type { Preferences } from './preferences'
import { useCustomersStore } from './customers'
import { useFinanceStore } from './finance'
import { usePreferencesStore } from './preferences'
import { useAssistantStore } from './assistant'

interface Profile {
  id: number
  email: string
  name: string
  csrf: string
}
export const useAuthStore = defineStore('auth', () => {
  const user = ref<Profile | null>(null)
  const ready = ref(false)
  const loading = ref(false)
  const error = ref('')
  let restoring: Promise<void> | null = null
  async function loadData() {
    const ownerId = user.value?.id
    const [data, preferences] = await Promise.all([
      api<{ customers: Customer[]; transactions: Transaction[] }>('/api/account/data'),
      api<Preferences>('/api/account/preferences'),
    ])
    if (!ownerId || user.value?.id !== ownerId) return
    await Promise.all([
      useCustomersStore().setAccountData(data.customers),
      useFinanceStore().setAccountData(data.transactions),
      usePreferencesStore().setAccountData(preferences),
    ])
  }
  async function clearAccount() {
    user.value = null
    setCsrf('')
    const assistant = useAssistantStore()
    assistant.cancel()
    // Do not retain account conversation across identities.
    assistant.messages = []
    assistant.recommendations = []
    assistant.lastContext = null
    assistant.serverSnapshot = null
    await Promise.all([
      useCustomersStore().setAccountData(null),
      useFinanceStore().setAccountData(null),
      usePreferencesStore().setAccountData(null),
    ])
  }
  async function restore() {
    if (import.meta.env.VITE_PUBLIC_DEMO === 'true') {
      ready.value = true
      return
    }
    if (ready.value) return
    if (restoring) return restoring
    restoring = (async () => {
      try {
        user.value = await api<Profile>('/api/auth/me')
        setCsrf(user.value.csrf)
        await loadData()
      } catch (cause) {
        if (!(cause instanceof ApiError) || ![401, 503, 0].includes(cause.status))
          error.value = cause instanceof Error ? cause.message : 'Session restoration failed.'
        await clearAccount()
      } finally {
        ready.value = true
        restoring = null
      }
    })()
    return restoring
  }
  async function authenticate(
    mode: 'login' | 'register',
    fields: { email: string; password: string; name?: string },
  ) {
    if (import.meta.env.VITE_PUBLIC_DEMO === 'true')
      throw new Error(
        'Account access is disabled in the static public demo. Run the full stack locally.',
      )
    loading.value = true
    error.value = ''
    try {
      user.value = await api<Profile>(`/api/auth/${mode}`, 'POST', {
        ...fields,
        ...(mode === 'register'
          ? { language: usePreferencesStore().preferences.language ?? 'en' }
          : {}),
      })
      setCsrf(user.value.csrf)
      await loadData()
      ready.value = true
    } catch (cause) {
      await clearAccount()
      throw cause
    } finally {
      loading.value = false
    }
  }
  async function logout() {
    await api('/api/auth/logout', 'POST')
    await clearAccount()
  }
  return { user, ready, loading, error, restore, authenticate, logout, loadData, clearAccount }
})

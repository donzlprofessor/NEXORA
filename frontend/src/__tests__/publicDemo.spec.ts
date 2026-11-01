import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { useFinanceStore } from '@/stores/finance'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { useAssistantStore } from '@/stores/assistant'
import { api } from '@/services/http'
import { connectionStatus, requestAnswer, requestSnapshot } from '@/services/ai'
import { persistBundle } from '@/utils/dataTransfer'
import { storageKey } from '@/demo/config'
import router from '@/router'

let storage: Map<string, string>
beforeEach(() => {
  vi.stubEnv('VITE_PUBLIC_DEMO', 'true')
  storage = new Map([
    ['nexora_customers', 'private legacy records'],
    ['nexora-transactions', 'private transactions'],
    ['nexora_preferences', 'private preferences'],
  ])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('fetch', vi.fn())
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('persists public CRUD and preferences across store recreation without touching legacy data', async () => {
  const customers = useCustomersStore()
  const finance = useFinanceStore()
  expect(customers.customers).toHaveLength(5)
  for (const customer of customers.customers) {
    expect(
      finance.transactions
        .filter((t) => t.type === 'income' && t.customerId === customer.id)
        .reduce((sum, t) => sum + t.amount, 0),
    ).toBe(customer.totalSpent)
  }
  await customers.saveCustomer(
    { name: 'New', email: 'new@example.com', company: 'Demo', status: 'Lead', totalSpent: 0 },
    null,
  )
  await customers.saveCustomer({ ...customers.customers[0]!, name: 'Edited' }, 1)
  await customers.deleteCustomer(5)
  await finance.addTransaction({
    id: 100,
    description: 'New',
    category: 'Services',
    amount: 20,
    type: 'income',
    date: '2026-11-01',
  })
  await finance.updateTransaction(100, {
    description: 'Updated',
    category: 'Services',
    amount: 30,
    type: 'income',
    date: '2026-11-01',
  })
  await finance.deleteTransaction(6)
  await usePreferencesStore().setLanguage('pl')
  await nextTick()
  const savedCustomers = JSON.parse(JSON.stringify(customers.customers))
  const savedTransactions = JSON.parse(JSON.stringify(finance.transactions))
  setActivePinia(createPinia())
  expect(useCustomersStore().customers).toEqual(savedCustomers)
  expect(useFinanceStore().transactions).toEqual(savedTransactions)
  expect(usePreferencesStore().preferences.language).toBe('pl')
  expect(storage.get('nexora_customers')).toBe('private legacy records')
  expect(storage.get('nexora-transactions')).toBe('private transactions')
  expect(storage.get('nexora_preferences')).toBe('private preferences')
  expect(fetch).not.toHaveBeenCalled()
})

it('blocks every network gateway and produces no simulated assistant reply', async () => {
  await useAuthStore().restore()
  expect((await connectionStatus()).status).toBe('disabled')
  await expect(api('/api/account/data')).rejects.toThrow('disabled')
  await expect(
    useAuthStore().authenticate('login', { email: 'a@example.com', password: 'password' }),
  ).rejects.toThrow('disabled')
  const signal = new AbortController().signal
  await expect(requestSnapshot('7D', signal)).rejects.toThrow('disabled')
  const { businessContext } = await import('@/services/ai')
  await expect(requestAnswer([], businessContext([], [], '7D'), 'en', signal)).rejects.toThrow(
    'disabled',
  )
  await useAssistantStore().send('Give me exact figures')
  expect(useAssistantStore().messages).toEqual([])
  expect(fetch).not.toHaveBeenCalled()
})

it('allows every public page and redirects account entry points', async () => {
  for (const path of ['/', '/analytics', '/customers', '/finance', '/settings', '/assistant']) {
    await router.push(path)
    expect(router.currentRoute.value.path).toBe(path)
  }
  for (const path of ['/login', '/register', '/account']) {
    await router.push(path)
    expect(router.currentRoute.value.path).toBe('/')
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps import writes and raw backups inside the public namespace', () => {
  const bundle = { version: 1 as const, currency: 'EUR' as const, customers: [], transactions: [] }
  const backup = persistBundle(bundle)
  expect(backup.startsWith('nexora_public_v1_')).toBe(true)
  expect(storage.get(storageKey('nexora_customers'))).toBe('[]')
  expect(storage.get('nexora_customers')).toBe('private legacy records')
  expect(storage.get('nexora-transactions')).toBe('private transactions')
})

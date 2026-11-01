import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCustomersStore } from '@/stores/customers'
import { useFinanceStore } from '@/stores/finance'
import { api, setCsrf } from '@/services/http'
import { requestAccountAnswer } from '@/services/ai'
import { connectionStatus } from '@/services/ai'
import router from '@/router'
import AccountMigration from '@/components/AccountMigration.vue'
import { mount, flushPromises } from '@vue/test-utils'
import { downloadJson } from '@/utils/dataTransfer'

vi.mock('@/utils/dataTransfer', async (original) => ({
  ...(await original<typeof import('@/utils/dataTransfer')>()),
  downloadJson: vi.fn<typeof downloadJson>(),
}))
const local = {
  id: 42,
  name: 'Browser Customer',
  email: 'browser@example.com',
  company: 'Local',
  status: 'Active' as const,
  totalSpent: 0,
}
const remote = { ...local, id: 999, name: 'Account Customer', email: 'account@example.com' }
let storage: Map<string, string>
beforeEach(() => {
  storage = new Map([
    ['nexora_customers', JSON.stringify([local])],
    ['nexora-transactions', '[]'],
  ])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  setActivePinia(createPinia())
  setCsrf('')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

it('guards the account route and allows authenticated access', async () => {
  const auth = useAuthStore()
  auth.ready = true
  await router.push('/account')
  expect(router.currentRoute.value.name).toBe('login')
  auth.user = { id: 1, email: 'account@example.com', name: 'Account', csrf: 'csrf' }
  await router.push('/account')
  expect(router.currentRoute.value.name).toBe('account')
})

it('never attempts private inference or session restoration in static public mode', async () => {
  vi.stubEnv('VITE_PUBLIC_DEMO', 'true')
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  await useAuthStore().restore()
  expect((await connectionStatus()).status).toBe('disabled')
  await expect(
    requestAccountAnswer(
      [{ role: 'user', content: 'Hi' }],
      '7D',
      'en',
      new AbortController().signal,
    ),
  ).rejects.toThrow('disabled')
  expect(fetch).not.toHaveBeenCalled()
})

it('hydrates, edits and signs out of an account without writing account data to localStorage', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url, options) => {
    if (String(url).includes('/auth/login'))
      return json({ id: 1, email: 'user@example.com', name: 'User', csrf: 'csrf-test' })
    if (String(url).includes('/account/data'))
      return json({ customers: [remote], transactions: [] })
    if (String(url).includes('/account/preferences'))
      return json({
        name: 'Remote User',
        workspace: 'Remote',
        locale: 'en-IE',
        currencyDisplay: 'symbol',
        theme: 'dark',
        aiLanguage: 'en',
      })
    if (options?.method === 'PUT') return json({ ...remote, name: 'Edited' })
    if (String(url).includes('/auth/logout')) return new Response(null, { status: 204 })
    throw new Error('Unexpected request')
  })
  vi.stubGlobal('fetch', fetch)
  const original = storage.get('nexora_customers')
  const auth = useAuthStore()
  await auth.authenticate('login', { email: 'user@example.com', password: 'long-test-password' })
  const store = useCustomersStore()
  expect(store.accountMode).toBe(true)
  expect(store.customers[0]!.id).toBe(999)
  await store.saveCustomer({ ...remote, name: 'Edited' }, 999)
  await nextTick()
  expect(storage.get('nexora_customers')).toBe(original)
  const mutation = fetch.mock.calls.find(([, options]) => options?.method === 'PUT')!
  expect(mutation[1]!.credentials).toBe('include')
  expect(mutation[1]!.headers).toEqual(expect.objectContaining({ 'X-CSRF-Token': 'csrf-test' }))
  await auth.logout()
  expect(store.customers[0]!.id).toBe(42)
  expect(store.accountMode).toBe(false)
  expect(storage.get('nexora_customers')).toBe(original)
})

it('does not optimistically remove account records when a mutation fails', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(json({ detail: 'Denied' }, 403)))
  const store = useFinanceStore()
  await store.setAccountData([
    {
      id: 5,
      description: 'Remote',
      category: 'Services',
      amount: 10,
      type: 'income',
      date: '2026-11-01',
    },
  ])
  await expect(store.deleteTransaction(5)).rejects.toThrow('Denied')
  expect(store.transactions).toHaveLength(1)
  expect(storage.get('nexora-transactions')).toBe('[]')
})

it('discards late account responses after logout rather than writing them into browser records', async () => {
  let resolve: (response: Response) => void = () => {}
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    ),
  )
  const store = useFinanceStore()
  await store.setAccountData([])
  const transaction = {
    id: 99,
    description: 'Private account entry',
    category: 'Services',
    amount: 10,
    type: 'income' as const,
    date: '2026-11-01',
  }
  const pending = store.addTransaction(transaction)
  await store.setAccountData(null)
  resolve(json(transaction))
  await expect(pending).rejects.toThrow('Account changed')
  expect(store.transactions).toEqual([])
  expect(storage.get('nexora-transactions')).toBe('[]')
})

it('restores a session once and signals expiration on protected API failures', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () => json({ detail: 'Expired' }, 401))
  vi.stubGlobal('fetch', fetch)
  const auth = useAuthStore()
  await Promise.all([auth.restore(), auth.restore()])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(auth.user).toBeNull()
  const listener = vi.fn<() => void>()
  window.addEventListener('nexora-session-expired', listener)
  await expect(api('/api/account/data')).rejects.toThrow('Expired')
  expect(listener).toHaveBeenCalledOnce()
  window.removeEventListener('nexora-session-expired', listener)
})

it('sends only the question and period to account AI, never client financial totals', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(json({ content: 'Review server figures.', snapshot: {} }))
  vi.stubGlobal('fetch', fetch)
  await requestAccountAnswer(
    [{ role: 'user', content: 'Summary' }],
    '30D',
    'en',
    new AbortController().signal,
  )
  const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string)
  expect(body.period).toBe('30D')
  expect(body).not.toHaveProperty('context')
  expect(body).not.toHaveProperty('totalIncome')
})

it('previews browser migration without writing, and requires backup plus typed confirmation', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    json({
      conflicts: [],
      newCustomers: 1,
      newTransactions: 0,
      skipped: 0,
      previewToken: 'preview',
    }),
  )
  vi.stubGlobal('fetch', fetch)
  const wrapper = mount(AccountMigration, { global: { plugins: [createPinia()] } })
  const original = storage.get('nexora_customers')
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Preview existing localStorage')!
    .trigger('click')
  await flushPromises()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(storage.get('nexora_customers')).toBe(original)
  const confirm = wrapper.findAll('button').find((b) => b.text() === 'Confirm account import')!
  expect(confirm.attributes('disabled')).toBeDefined()
  await wrapper.get('input[autocomplete="off"]').setValue('IMPORT ACCOUNT')
  expect(confirm.attributes('disabled')).toBeDefined()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Download source backup')!
    .trigger('click')
  expect(downloadJson).toHaveBeenCalledOnce()
  expect(confirm.attributes('disabled')).toBeUndefined()
  expect(storage.get('nexora_customers')).toBe(original)
  wrapper.unmount()
})

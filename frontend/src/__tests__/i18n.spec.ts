import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n, tr, type Language } from '@/i18n'
import en from '@/locales/en.json'
import pl from '@/locales/pl.json'
import ru from '@/locales/ru.json'
import { usePreferencesStore } from '@/stores/preferences'
import { useFinanceStore } from '@/stores/finance'
import LanguageSelector from '@/components/LanguageSelector.vue'
import AuthView from '@/views/AuthView.vue'
import SettingsView from '@/views/SettingsView.vue'
import CustomersView from '@/views/CustomersView.vue'

let storage: Map<string, string>
beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ready', model: 'qwen3:4b' }))),
  )
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
})
afterEach(() => {
  vi.unstubAllGlobals()
  i18n.global.locale.value = 'en'
})

it('has matching complete English, Polish and Russian catalogues', () => {
  expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort())
  expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  expect(Object.keys(en).length).toBeGreaterThan(300)
  for (const catalogue of [en, pl, ru]) {
    expect(Object.values(catalogue).every((message) => message.trim().length > 0)).toBe(true)
  }
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const parameters = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
    expect(parameters(pl[key])).toEqual(parameters(en[key]))
    expect(parameters(ru[key])).toEqual(parameters(en[key]))
  }
})

it('resolves every static translation key used by Vue templates', () => {
  const sources = import.meta.glob('../**/*.vue', { query: '?raw', import: 'default', eager: true })
  for (const source of Object.values(sources)) {
    for (const match of String(source).matchAll(/\bt\('([^']+)'/g)) {
      expect(en).toHaveProperty(match[1]!)
    }
  }
})

it('keeps customer filter values stable after translating their labels', async () => {
  await usePreferencesStore().setLanguage('pl')
  const wrapper = mount(CustomersView)
  const filter = wrapper.find(`select[aria-label="${tr('Filter by status')}"]`)
  await filter.setValue('Active')
  expect(wrapper.text()).toContain('Alexander Smith')
  expect(wrapper.text()).not.toContain('Michael Brown')
  expect(filter.findAll('option').map((option) => option.element.value)).toEqual([
    'All',
    'Active',
    'Inactive',
    'Lead',
  ])
  wrapper.unmount()
})

it('switches language instantly and restores the persisted choice', async () => {
  const wrapper = mount(LanguageSelector)
  await wrapper.get('select').setValue('pl')
  expect(wrapper.text()).toContain('Język')
  expect(document.documentElement.lang).toBe('pl')
  expect(JSON.parse(storage.get('nexora_preferences')!).language).toBe('pl')
  setActivePinia(createPinia())
  expect(usePreferencesStore().preferences.language).toBe('pl')
  wrapper.unmount()
})

it('persists account language through the API without changing browser preferences or business data', async () => {
  const settings = usePreferencesStore()
  const browser = JSON.stringify({ ...settings.preferences, workspace: 'Browser workspace' })
  storage.set('nexora_preferences', browser)
  await settings.setAccountData({ ...settings.preferences, workspace: 'Account workspace' })
  await settings.setLanguage('ru')
  expect(storage.get('nexora_preferences')).toBe(browser)
  const calls = vi.mocked(fetch).mock.calls
  expect(calls[0]![0]).toContain('/api/account/preferences')
  expect(JSON.parse(calls[0]![1]!.body as string)).toMatchObject({
    language: 'ru',
    workspace: 'Account workspace',
    aiLanguage: 'ru',
    locale: 'ru-RU',
  })
})

it('formats exact cents, negative fractions and large amounts without rounding or changing money', async () => {
  const settings = usePreferencesStore()
  const finance = useFinanceStore()
  const records = JSON.stringify(finance.transactions)
  for (const language of ['en', 'pl', 'ru'] as Language[]) {
    await settings.setLanguage(language)
    expect(settings.formatCurrencyCents('60000')).toBe(settings.formatCurrency(600))
    expect(settings.formatCurrencyCents('-1')).toBe(settings.formatCurrency(-0.01))
    expect(settings.formatCurrencyCents('900719925474099301')).toContain('01')
    expect(settings.formatDate('2026-11-01')).toBe(
      new Intl.DateTimeFormat(settings.preferences.locale, { dateStyle: 'medium' }).format(
        new Date('2026-11-01T12:00:00'),
      ),
    )
  }
  await settings.setLanguage('pl')
  expect(settings.formatCurrency(600)).toMatch(/600,00\s€/)
  expect(JSON.stringify(finance.transactions)).toBe(records)
})

it('falls back to English for a missing localized message', async () => {
  i18n.global.mergeLocaleMessage('en', { fallback_test: 'English fallback' })
  await usePreferencesStore().setLanguage('pl')
  expect(i18n.global.t('fallback_test')).toBe('English fallback')
})

it('localizes login, registration and settings in every language', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: AuthView },
      { path: '/register', name: 'register', component: AuthView },
      { path: '/', component: { template: '<div />' } },
    ],
  })
  await router.push('/login')
  const auth = mount(AuthView, { global: { plugins: [router] } })
  const settings = mount(SettingsView)
  for (const language of ['en', 'pl', 'ru'] as Language[]) {
    await usePreferencesStore().setLanguage(language)
    await nextTick()
    expect(auth.text()).toContain(tr('Sign in to NEXORA'))
    expect(settings.text()).toContain(tr('Settings'))
    await router.push('/register')
    await flushPromises()
    expect(auth.text()).toContain(tr('Create your account'))
    await router.push('/login')
  }
  auth.unmount()
  settings.unmount()
})

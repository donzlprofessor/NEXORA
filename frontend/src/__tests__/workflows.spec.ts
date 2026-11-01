import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import FinanceView from '@/views/FinanceView.vue'
import CustomersView from '@/views/CustomersView.vue'
import SettingsView from '@/views/SettingsView.vue'
import { useFinanceStore } from '@/stores/finance'
import { useCustomersStore } from '@/stores/customers'
import { usePreferencesStore } from '@/stores/preferences'
import { downloadJson } from '@/utils/dataTransfer'

vi.mock('@/utils/dataTransfer', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/dataTransfer')>()
  return { ...original, downloadJson: vi.fn<typeof original.downloadJson>() }
})

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ready', model: 'qwen3:4b' }))),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

it('edits a transaction in place and updates totals without changing its identifier', async () => {
  const pinia = createPinia()
  const store = useFinanceStore(pinia)
  const id = store.transactions[0]!.id
  const wrapper = mount(FinanceView, { global: { plugins: [pinia] } })
  // Explicit newest-date ordering, independent of array insertion order.
  const newest = [...store.transactions].sort((a, b) => b.date.localeCompare(a.date))[0]!
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Edit')!
    .trigger('click')
  await wrapper.get('#transaction-amount').setValue(100.25)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(store.transactions.find((t) => t.id === newest.id)!.amount).toBe(100.25)
  expect(store.transactions[0]!.id).toBe(id)
  expect(store.totalIncome).toBe(4600.25)
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  wrapper.unmount()
})

it('rejects duplicate customer emails and traps/restores dialog keyboard focus', async () => {
  const pinia = createPinia()
  const wrapper = mount(CustomersView, { attachTo: document.body, global: { plugins: [pinia] } })
  const opener = wrapper.findAll('button').find((button) => button.text() === '+ Add Customer')!
  ;(opener.element as HTMLButtonElement).focus()
  await opener.trigger('click')
  await nextTick()
  expect(document.activeElement?.id).toBe('customer-name')
  await wrapper.get('#customer-name').setValue('Duplicate')
  await wrapper.get('#customer-email').setValue(' ALEX@example.com ')
  await wrapper.get('#customer-company').setValue('Example')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('already belongs')
  const buttons = wrapper.findAll('[role="dialog"] button')
  ;(buttons[buttons.length - 1]!.element as HTMLButtonElement).focus()
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
  )
  expect(document.activeElement).toBe(buttons[0]!.element)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await nextTick()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(document.activeElement).toBe(opener.element)
  expect(useCustomersStore(pinia).customers).toHaveLength(5)
  wrapper.unmount()
})

it('requires typed reset confirmation and archives records before restoring demo data', async () => {
  const pinia = createPinia()
  const finance = useFinanceStore(pinia)
  finance.transactions = [
    {
      id: 77,
      description: 'User record',
      category: 'Services',
      type: 'income',
      amount: 88,
      date: '2026-11-01',
    },
  ]
  await nextTick()
  const wrapper = mount(SettingsView, { global: { plugins: [pinia] } })
  await flushPromises()
  const reset = wrapper
    .findAll('button')
    .find((button) => button.text() === 'Back up and reset demo')!
  expect(reset.attributes('disabled')).toBeDefined()
  expect(finance.transactions[0]!.id).toBe(77)
  await wrapper.get('input[autocomplete="off"]').setValue('RESET DEMO')
  await reset.trigger('click')
  expect(downloadJson).toHaveBeenCalledWith(
    expect.objectContaining({
      transactions: expect.arrayContaining([expect.objectContaining({ id: 77 })]),
    }),
    'nexora-before-reset.json',
  )
  expect(finance.transactions).toHaveLength(3)
  expect(wrapper.text()).toContain('Previous raw records remain archived')
  wrapper.unmount()
})

it('persists display preferences and formats EUR without changing amounts', async () => {
  const pinia = createPinia()
  const store = usePreferencesStore(pinia)
  store.preferences.currencyDisplay = 'code'
  store.preferences.aiLanguage = 'ru'
  await nextTick()
  expect(store.formatCurrency(12.25)).toContain('EUR')
  expect(JSON.parse(localStorage.getItem('nexora_preferences')!).aiLanguage).toBe('ru')
  expect(usePreferencesStore(createPinia()).preferences.aiLanguage).toBe('ru')
})

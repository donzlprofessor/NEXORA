import { afterEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AnalyticsView from '@/views/AnalyticsView.vue'
import { useFinanceStore } from '@/stores/finance'
import { useCustomersStore } from '@/stores/customers'

vi.mock('vue-chartjs', async () => {
  const { defineComponent } = await import('vue')
  const chart = defineComponent({
    name: 'MetricsChart',
    props: ['data', 'options'],
    template: '<div />',
  })
  return { Line: chart, Bar: chart }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('updates cards, charts and insights together without rewriting existing storage', async () => {
  // Isolated browser-storage substitute; never touches real user records.
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 1, 12))
  const transactions = JSON.stringify([
    {
      id: 1,
      description: 'Recent',
      category: 'Services',
      amount: 100,
      type: 'income',
      date: '2026-11-01',
    },
    {
      id: 2,
      description: 'Monthly',
      category: 'Services',
      amount: 200,
      type: 'income',
      date: '2026-10-10',
    },
    {
      id: 3,
      description: 'Quarterly',
      category: 'Services',
      amount: 300,
      type: 'income',
      date: '2026-09-01',
    },
    {
      id: 4,
      description: 'Cost',
      category: 'Software',
      amount: 20,
      type: 'expense',
      date: '2026-10-10',
    },
  ])
  const customers = JSON.stringify([
    {
      id: 1,
      name: 'Recent',
      email: 'a@example.com',
      company: 'A',
      status: 'Active',
      totalSpent: 9999,
      createdAt: '2026-11-01',
    },
    {
      id: 2,
      name: 'Earlier',
      email: 'b@example.com',
      company: 'B',
      status: 'Lead',
      totalSpent: 0,
      createdAt: '2026-09-01',
    },
    {
      id: 3,
      name: 'Legacy',
      email: 'c@example.com',
      company: 'C',
      status: 'Active',
      totalSpent: 50,
    },
  ])
  localStorage.setItem('nexora-transactions', transactions)
  localStorage.setItem('nexora_customers', customers)
  const pinia = createPinia()
  const wrapper = mount(AnalyticsView, {
    global: { plugins: [pinia] },
  })

  for (const [period, income, expenses, newCustomers] of [
    ['7D', 100, 0, 1],
    ['30D', 300, 20, 1],
    ['90D', 600, 20, 2],
  ] as const) {
    const button = wrapper.findAll('button').find((b) => b.text() === period)!
    await button.trigger('click')
    const values = wrapper.findAll('h2').map((node) => node.text())
    expect(values).toEqual([
      `€${income.toFixed(2)}`,
      String(newCustomers),
      `€${expenses.toFixed(2)}`,
      `€${(income - expenses).toFixed(2)}`,
    ])
    const charts = wrapper.findAllComponents({ name: 'MetricsChart' })
    expect(
      charts[0]!.props('data').datasets[0].data.reduce((a: number, b: number) => a + b, 0),
    ).toBe(income)
    expect(
      charts[1]!.props('data').datasets[0].data.reduce((a: number, b: number) => a + b, 0),
    ).toBe(newCustomers)
    expect(wrapper.text()).toContain(`recorded income: €${income.toFixed(2)}`)
    expect(wrapper.text()).toContain(`New customers: ${newCustomers}`)
  }

  // Period filtering must never remove undated customers or older transactions.
  await nextTick()
  expect(useFinanceStore(pinia).transactions).toHaveLength(4)
  expect(useCustomersStore(pinia).customers).toHaveLength(3)
  expect(localStorage.getItem('nexora-transactions')).toBe(transactions)
  expect(localStorage.getItem('nexora_customers')).toBe(customers)
  wrapper.unmount()
})

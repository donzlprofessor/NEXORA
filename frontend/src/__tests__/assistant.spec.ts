import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssistantStore } from '@/stores/assistant'
import { useFinanceStore } from '@/stores/finance'
import { requestAnswer, requestSnapshot, requestAccountAnswer } from '@/services/ai'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { mount } from '@vue/test-utils'
import AIAssistantView from '@/views/AIAssistantView.vue'

vi.mock('@/services/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/ai')>()),
  requestAnswer: vi.fn<typeof requestAnswer>(),
  requestSnapshot: vi.fn<typeof requestSnapshot>(),
  requestAccountAnswer: vi.fn<typeof requestAccountAnswer>(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function waitForAbort() {
  vi.mocked(requestAnswer).mockImplementation(
    (_messages, _context, _language, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        })
      }),
  )
}

it('cancels pending inference without fabricating an answer or altering business records', async () => {
  waitForAbort()
  const store = useAssistantStore()
  const before = JSON.stringify(useFinanceStore().transactions)
  const request = store.send('Summarize expenses')
  expect(store.pending).toBe(true)
  await store.send('Duplicate request')
  expect(requestAnswer).toHaveBeenCalledTimes(1)
  store.cancel()
  await request
  expect(store.pending).toBe(false)
  expect(store.error).toBe('Request cancelled.')
  expect(store.messages).toEqual([{ role: 'user', content: 'Summarize expenses' }])
  expect(JSON.stringify(useFinanceStore().transactions)).toBe(before)
})

it('bounds response time and exposes a retryable timeout message', async () => {
  vi.useFakeTimers()
  waitForAbort()
  const store = useAssistantStore()
  const request = store.send('Summary')
  await vi.advanceTimersByTimeAsync(135000)
  await request
  expect(store.error).toContain('timed out')
  expect(store.pending).toBe(false)
})

it('keeps server metrics visible when account inference fails', async () => {
  const snapshot = {
    context: {
      currency: 'EUR' as const,
      allTime: { totalIncome: 999, totalExpenses: 70, netProfit: 929 },
      selected: {
        period: '7D' as const,
        start: '2026-10-26',
        end: '2026-11-01',
        totalIncome: 600,
        totalExpenses: 70,
        netProfit: 530,
        newCustomers: 0,
        transactionCount: 2,
      },
      totalCustomers: 0,
      activeCustomers: 0,
      undatedCustomers: 0,
    },
    previousPeriod: {
      start: '2026-10-19',
      end: '2026-10-25',
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
    },
    expenseCategories: [],
    timezone: 'UTC',
    metrics: {
      revenueCents: '60000',
      expenseCents: '7000',
      netProfitCents: '53000',
      transactionCount: 2,
      incomeCount: 1,
      expenseCount: 1,
    },
  }
  useAuthStore().user = { id: 1, email: 'a@example.com', name: 'A', csrf: 'test' }
  vi.mocked(requestSnapshot).mockResolvedValue(snapshot)
  vi.mocked(requestAccountAnswer).mockResolvedValue({
    content: '',
    snapshot,
    aiStatus: 'timeout',
    recommendations: ['Review expenses.'],
  })
  const store = useAssistantStore()
  await store.send('Summary')
  expect(store.serverSnapshot?.metrics?.netProfitCents).toBe('53000')
  expect(store.lastContext?.selected.totalIncome).toBe(600)
  expect(store.error).toContain('Verified financial figures remain available')
  expect(store.messages).toHaveLength(2)
  expect(store.messages[1]!.content).toContain('530')
  expect(store.recommendations).toEqual(['Review expenses.'])
})

const exactQuestions = [
  ['en', 'Show exact revenue, expenses and net profit.', 'Revenue', 'Expenses', 'Net Profit'],
  ['pl', 'Podaj dokładne przychody, wydatki i zysk netto.', 'Przychody', 'Wydatki', 'Zysk netto'],
  ['ru', 'Покажи точные доходы, расходы и чистую прибыль.', 'Доходы', 'Расходы', 'Чистая прибыль'],
] as const

it.each(exactQuestions)(
  'answers exact figures in %s from local records without inference',
  async (language, question, revenue, expenses, profit) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 1, 12))
    const finance = useFinanceStore()
    finance.transactions = [
      {
        id: 1,
        description: 'Recorded income',
        category: 'Entries',
        date: '2026-11-01',
        type: 'income',
        amount: 600,
      },
      {
        id: 2,
        description: 'Recorded expense',
        category: 'Entries',
        date: '2026-11-01',
        type: 'expense',
        amount: 70,
      },
      {
        id: 3,
        description: 'Outside period',
        category: 'Entries',
        date: '2025-01-01',
        type: 'income',
        amount: 999,
      },
    ]
    await usePreferencesStore().setLanguage(language)
    const store = useAssistantStore()
    store.period = '7D'
    const original = JSON.stringify(finance.transactions)
    await store.send(question)
    expect(requestAnswer).not.toHaveBeenCalled()
    expect(store.messages[1]!.content).toContain(revenue)
    expect(store.messages[1]!.content).toContain(expenses)
    expect(store.messages[1]!.content).toContain(profit)
    expect(store.messages[1]!.content).toMatch(/600[.,]00/)
    expect(store.messages[1]!.content).toMatch(/70[.,]00/)
    expect(store.messages[1]!.content).toMatch(/530[.,]00/)
    expect(store.messages[1]!.content).not.toContain('999')
    expect(JSON.stringify(finance.transactions)).toBe(original)
  },
)

it('does not turn a missing server snapshot into zero totals or reuse a previous snapshot', async () => {
  useAuthStore().user = { id: 1, email: 'a@example.com', name: 'A', csrf: 'test' }
  const store = useAssistantStore()
  store.lastContext = (await import('@/services/ai')).businessContext([], [], '7D')
  vi.mocked(requestSnapshot).mockRejectedValue(new Error('Database unavailable'))
  await store.send('Podaj dokładne przychody, wydatki i zysk netto.')
  expect(store.lastContext).toBeNull()
  expect(store.serverSnapshot).toBeNull()
  expect(store.messages).toHaveLength(1)
  expect(store.error).toBe('Database unavailable')
  expect(requestAccountAnswer).not.toHaveBeenCalled()
})

it('renders authenticated exact figures from cent strings even with Ollama offline', async () => {
  useAuthStore().user = { id: 1, email: 'a@example.com', name: 'A', csrf: 'test' }
  await usePreferencesStore().setLanguage('pl')
  const context = (await import('@/services/ai')).businessContext([], [], '7D')
  vi.mocked(requestSnapshot).mockResolvedValue({
    context: {
      ...context,
      selected: {
        ...context.selected,
        totalIncome: 999,
        totalExpenses: 999,
        netProfit: 0,
        transactionCount: 2,
      },
    },
    metrics: {
      revenueCents: '60000',
      expenseCents: '7000',
      netProfitCents: '53000',
      transactionCount: 2,
      incomeCount: 1,
      expenseCount: 1,
    },
    previousPeriod: {
      start: '2026-10-19',
      end: '2026-10-25',
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
    },
    expenseCategories: [],
    timezone: 'UTC',
  })
  vi.mocked(requestAccountAnswer).mockRejectedValue(new Error('Ollama offline'))
  const store = useAssistantStore()
  await store.send(exactQuestions[1][1])
  expect(requestAccountAnswer).not.toHaveBeenCalled()
  expect(store.messages[1]!.content).toMatch(/Zysk netto: 530,00/)
  const wrapper = mount(AIAssistantView)
  expect(wrapper.text()).toMatch(/Przychody\s*600,00/)
  expect(wrapper.text()).toMatch(/Wydatki\s*70,00/)
  expect(wrapper.text()).toMatch(/Zysk netto\s*530,00/)
  wrapper.unmount()
})

it.each(exactQuestions)(
  'distinguishes zero totals from missing data in %s',
  async (language, question) => {
    useFinanceStore().transactions = []
    await usePreferencesStore().setLanguage(language)
    const store = useAssistantStore()
    await store.send(question)
    expect(store.lastContext?.selected.transactionCount).toBe(0)
    expect(store.messages[1]!.content.match(/0[.,]00/g)).toHaveLength(3)
    expect(store.messages[1]!.content).toContain(
      language === 'pl' ? 'zero' : language === 'ru' ? 'нулю' : 'zero',
    )
  },
)

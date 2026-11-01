import type { Customer } from '@/stores/customers'
import type { Transaction } from '@/stores/finance'
import { api } from './http'
import {
  customerDay,
  financialTotals,
  periodDates,
  periodMetrics,
  type Period,
} from '@/utils/metrics'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
export interface Connection {
  status: 'ready' | 'model_missing' | 'ollama_offline' | 'backend_unavailable' | 'disabled'
  model: string
}

export function boundedHistory(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []
  let characters = 0
  for (const message of messages.slice(-11).reverse()) {
    if (characters + message.content.length > 6000) break
    result.unshift(message)
    characters += message.content.length
  }
  return result
}

export function businessContext(
  transactions: Transaction[],
  customers: Customer[],
  period: Period,
) {
  const days = periodDates(period)
  const { totalIncome, totalExpenses, netProfit, newCustomers, transactionCount } = periodMetrics(
    transactions,
    customers,
    days,
  )
  return {
    currency: 'EUR' as const,
    allTime: financialTotals(transactions),
    selected: {
      period,
      start: days[0]!,
      end: days[days.length - 1]!,
      totalIncome,
      totalExpenses,
      netProfit,
      newCustomers,
      transactionCount,
    },
    totalCustomers: customers.length,
    activeCustomers: customers.filter((c) => c.status === 'Active').length,
    undatedCustomers: customers.filter((c) => !customerDay(c)).length,
  }
}

export async function connectionStatus(): Promise<Connection> {
  if (import.meta.env.VITE_PUBLIC_DEMO === 'true') return { status: 'disabled', model: 'qwen3:4b' }
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/health`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error('Backend unavailable')
    const result = await response.json()
    if (
      !['ready', 'model_missing', 'ollama_offline', 'disabled'].includes(result.status) ||
      typeof result.model !== 'string'
    )
      throw new Error('Invalid status')
    return result
  } catch {
    return { status: 'backend_unavailable', model: 'qwen3:4b' }
  }
}

export async function requestAnswer(
  messages: ChatMessage[],
  context: ReturnType<typeof businessContext>,
  language: 'en' | 'pl' | 'ru',
  signal: AbortSignal,
): Promise<string> {
  if (import.meta.env.VITE_PUBLIC_DEMO === 'true')
    throw new Error('Live AI is disabled in the public demo. Run NEXORA locally to use Ollama.')
  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: boundedHistory(messages), context, language }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Backend unavailable. Start the local FastAPI server and retry.')
  }
  let result
  try {
    result = await response.json()
  } catch (cause) {
    if (signal.aborted) throw cause
    throw new Error('The local backend returned an invalid response. Please retry.')
  }
  if (!response.ok)
    throw new Error(
      typeof result?.detail === 'string'
        ? result.detail
        : typeof result?.detail?.message === 'string'
          ? result.detail.message
          : 'Local AI request failed. Check the backend and retry.',
    )
  if (typeof result?.content !== 'string' || !result.content.trim())
    throw new Error('The model returned an empty answer.')
  // Defense in depth: never render raw Ollama reasoning or inline reasoning tags.
  if (/<\/?(?:think|analysis)\b/i.test(result.content))
    throw new Error('The model did not return a safe final answer. Internal reasoning is hidden.')
  return result.content.trim()
}

export async function requestSnapshot(period: Period, signal: AbortSignal) {
  return api<ServerSnapshot>(
    `/api/account/snapshot?period=${period}&zone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
    'GET',
    undefined,
    signal,
  )
}
export interface ServerSnapshot {
  metrics?: {
    revenueCents: string
    expenseCents: string
    netProfitCents: string
    transactionCount: number
    incomeCount: number
    expenseCount: number
  }
  previousMetrics?: {
    revenueCents: string
    expenseCents: string
    netProfitCents: string
    transactionCount: number
  }
  availability?: { previousPeriod: boolean; selectedPeriod: boolean; expenseCategories: boolean }

  context: ReturnType<typeof businessContext>
  previousPeriod: {
    start: string
    end: string
    totalIncome: number
    totalExpenses: number
    netProfit: number
  }
  expenseCategories: { category: string; amount: number; amountCents?: string }[]
  timezone: string
}
export async function requestAccountAnswer(
  messages: ChatMessage[],
  period: Period,
  language: 'en' | 'pl' | 'ru',
  signal: AbortSignal,
) {
  if (import.meta.env.VITE_PUBLIC_DEMO === 'true')
    throw new Error('Live AI is disabled in the public demo.')
  const result = await api<{
    content: string
    snapshot: ServerSnapshot
    aiStatus?: string
    recommendations?: string[]
  }>(
    '/api/account/chat',
    'POST',
    {
      messages: boundedHistory(messages),
      period,
      language,
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    signal,
  )
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (result.aiStatus && result.aiStatus !== 'ready') return result
  if (
    typeof result.content !== 'string' ||
    !result.content.trim() ||
    /<\/?(?:think|analysis)\b/i.test(result.content)
  )
    throw new Error('The model did not return a safe final answer. Internal reasoning is hidden.')
  return result
}

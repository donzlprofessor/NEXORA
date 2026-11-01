import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePreferencesStore } from './preferences'
import { useAuthStore } from './auth'
import {
  businessContext,
  connectionStatus,
  requestAnswer,
  type ChatMessage,
  type Connection,
  requestAccountAnswer,
  requestSnapshot,
  type ServerSnapshot,
} from '@/services/ai'
import { useFinanceStore } from './finance'
import { useCustomersStore } from './customers'
import type { Period } from '@/utils/metrics'
import { i18n } from '@/i18n'

export const useAssistantStore = defineStore('assistant', () => {
  const messages = ref<ChatMessage[]>([])
  const recommendations = ref<string[]>([])
  const pending = ref(false)
  const checking = ref(false)
  const error = ref('')
  const connection = ref<Connection>({ status: 'backend_unavailable', model: 'qwen3:4b' })
  const preferencesStore = usePreferencesStore()
  const language = computed({
    get: () => preferencesStore.preferences.aiLanguage,
    set: (value: 'en' | 'pl' | 'ru') => {
      preferencesStore.preferences.aiLanguage = value
    },
  })
  const period = ref<Period>('30D')
  const lastContext = ref<ReturnType<typeof businessContext> | null>(null)
  const serverSnapshot = ref<ServerSnapshot | null>(null)
  let controller: AbortController | null = null
  function financialReply() {
    const selected = lastContext.value?.selected
    if (!selected) return '' // Missing snapshot is not a zero-valued period.
    const locale = { en: 'en-IE', pl: 'pl-PL', ru: 'ru-RU' }[
      language.value
    ] as typeof preferencesStore.preferences.locale
    const label = (key: string) => i18n.global.t(key, {}, { locale: language.value })
    const exact = serverSnapshot.value?.metrics
    const money = (cents: string | undefined, amount: number) =>
      cents !== undefined
        ? preferencesStore.formatCurrencyCents(cents, locale)
        : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
    const lines = [
      `${label('period_19016')}: ${selected.start} — ${selected.end} (EUR)`,
      `${label('revenue_54358')}: ${money(exact?.revenueCents, selected.totalIncome)}`,
      `${label('expenses_13495')}: ${money(exact?.expenseCents, selected.totalExpenses)}`,
      `${label('net_profit_43d72')}: ${money(exact?.netProfitCents, selected.netProfit)}`,
    ]
    if ((exact?.transactionCount ?? selected.transactionCount) === 0)
      lines.push(label('no_transactions_recorded_in_this_period_51f5e'))
    return lines.join('\n')
  }
  async function checkConnection() {
    if (checking.value) return
    checking.value = true
    try {
      connection.value = await connectionStatus()
    } finally {
      checking.value = false
    }
  }
  function cancel() {
    controller?.abort()
  }
  function clear() {
    if (!pending.value) {
      messages.value = []
      recommendations.value = []
      lastContext.value = null
      serverSnapshot.value = null
      error.value = ''
    }
  }
  async function send(text: string) {
    if (pending.value || !text.trim()) return
    error.value = ''
    recommendations.value = []
    lastContext.value = null
    serverSnapshot.value = null
    const message: ChatMessage = { role: 'user', content: text.trim().slice(0, 4000) }
    messages.value.push(message)
    pending.value = true
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort('timeout'), 135000)
    const exactFigures = /exact|figures|amounts|dokład|doklad|kwot|точн|сумм/i.test(message.content)
    try {
      if (useAuthStore().user) {
        const snapshot = await requestSnapshot(period.value, controller.signal)
        if (controller.signal.aborted) return
        serverSnapshot.value = snapshot
        lastContext.value = snapshot.context
        if (exactFigures) {
          messages.value.push({ role: 'assistant', content: financialReply() })
          return
        }
        const result = await requestAccountAnswer(
          messages.value,
          period.value,
          language.value,
          controller.signal,
        )
        if (controller.signal.aborted) return
        recommendations.value = result.recommendations ?? []
        lastContext.value = result.snapshot.context
        serverSnapshot.value = result.snapshot
        if (result.aiStatus && result.aiStatus !== 'ready') {
          error.value = 'AI explanation unavailable. Verified financial figures remain available.'
          messages.value.push({ role: 'assistant', content: financialReply() })
          void checkConnection()
          return
        }
        messages.value.push({ role: 'assistant', content: result.content })
        connection.value.status = 'ready'
        return
      }
      const context = businessContext(
        useFinanceStore().transactions,
        useCustomersStore().customers,
        period.value,
      )
      lastContext.value = context
      if (exactFigures) {
        messages.value.push({ role: 'assistant', content: financialReply() })
        return
      }
      const content = await requestAnswer(
        messages.value,
        context,
        language.value,
        controller.signal,
      )
      if (controller.signal.aborted) return
      messages.value.push({ role: 'assistant', content })
      connection.value.status = 'ready'
    } catch (cause) {
      error.value = controller.signal.aborted
        ? controller.signal.reason === 'timeout'
          ? 'Local inference timed out before completing a final answer. Please retry.'
          : 'Request cancelled.'
        : cause instanceof Error
          ? cause.message
          : 'Local AI request failed.'
      if (!controller.signal.aborted) void checkConnection()
      // Inference failure does not make a successfully calculated summary unavailable.
      if (!controller.signal.aborted && lastContext.value)
        messages.value.push({ role: 'assistant', content: financialReply() })
    } finally {
      clearTimeout(timeout)
      pending.value = false
      controller = null
    }
  }
  return {
    messages,
    recommendations,
    pending,
    checking,
    error,
    connection,
    language,
    period,
    lastContext,
    serverSnapshot,
    send,
    cancel,
    clear,
    checkConnection,
  }
})

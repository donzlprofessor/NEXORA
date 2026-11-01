<script setup lang="ts">
import { isPublicDemo } from '@/demo/config'
const publicDemo = isPublicDemo()
import { t, tr } from '@/i18n'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAssistantStore } from '@/stores/assistant'
import { periods } from '@/utils/metrics'
import { usePreferencesStore } from '@/stores/preferences'
const { formatCurrency: currency, formatCurrencyCents, formatDate } = usePreferencesStore()

const assistant = useAssistantStore()
const summaryCards = computed(() => {
  const context = assistant.lastContext?.selected
  if (!context) return []
  const exact = assistant.serverSnapshot?.metrics
  return [
    {
      label: 'Revenue',
      value: exact ? formatCurrencyCents(exact.revenueCents) : currency(context.totalIncome),
      negative: false,
    },
    {
      label: 'Expenses',
      value: exact ? formatCurrencyCents(exact.expenseCents) : currency(context.totalExpenses),
      negative: false,
    },
    {
      label: 'Net Profit',
      value: exact ? formatCurrencyCents(exact.netProfitCents) : currency(context.netProfit),
      negative: exact ? BigInt(exact.netProfitCents) < 0n : context.netProfit < 0,
    },
  ]
})
const prompt = ref('')
const log = ref<HTMLElement | null>(null)
const suggestions = computed(() =>
  [
    'Summarize the selected period.',
    'What data is missing for growth analysis?',
    'How can I improve expense tracking?',
  ].map(tr),
)
function send(text = prompt.value) {
  if (!text.trim()) return
  prompt.value = ''
  void assistant.send(text)
}
watch(
  () => [assistant.messages.length, assistant.pending],
  async () => {
    await nextTick()
    log.value?.scrollTo?.({ top: log.value.scrollHeight, behavior: 'smooth' })
  },
)
onMounted(() => void assistant.checkConnection())
onUnmounted(() => assistant.cancel())
</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="mb-2 text-sm text-gray-500">{{ t('workspace_ai_assistant_477a5') }}</p>
      <h1 class="text-4xl font-bold">{{ t('nexora_ai_79b71') }}</h1>
      <p class="mt-3 text-gray-400">
        {{ t('local_read_only_business_analysis_no_customer_na_a2356') }}
      </p>
    </header>
    <p v-if="publicDemo" role="status" class="panel text-amber-200">{{ t('public_demo_ai') }}</p>
    <div v-if="!publicDemo" class="panel flex flex-wrap items-center gap-4">
      <p
        role="status"
        :class="assistant.connection.status === 'ready' ? 'text-green-400' : 'text-amber-300'"
      >
        {{ tr(assistant.connection.status) }} · {{ assistant.connection.model }}
      </p>
      <button
        class="button-secondary"
        :disabled="assistant.checking"
        @click="assistant.checkConnection"
      >
        {{ assistant.checking ? t('checking_4c416') : t('check_connection_adfd8') }}
      </button>
      <label
        >{{ t('period_19016')
        }}<select v-model="assistant.period" :disabled="assistant.pending" class="field">
          <option v-for="period in periods" :key="period">{{ period }}</option>
        </select></label
      >
      <label
        >{{ t('response_language_48b52')
        }}<select v-model="assistant.language" :disabled="assistant.pending" class="field">
          <option value="en">English</option>
          <option value="pl">Polski</option>
          <option value="ru">Русский</option>
        </select></label
      >
      <button
        class="button-secondary"
        :disabled="assistant.pending || !assistant.messages.length"
        @click="assistant.clear"
      >
        {{ t('clear_chat_1b142') }}
      </button>
    </div>
    <section v-if="assistant.lastContext" class="panel space-y-4" aria-live="polite">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-purple-300">{{ tr('Financial summary') }}</h2>
        <span class="text-xs text-gray-400">{{
          assistant.serverSnapshot
            ? tr('Verified figures for the last request (EUR)')
            : tr('Local demo calculations')
        }}</span>
      </div>
      <p class="text-sm text-gray-400">{{ assistant.periodLabel }} · EUR</p>
      <p class="text-sm text-gray-400">
        {{ t('assistant_period_scope') }}
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <p class="text-sm text-gray-400">{{ tr(card.label) }}</p>
          <p
            class="mt-2 break-words text-2xl font-semibold"
            :class="card.negative ? 'text-red-300' : 'text-purple-200'"
          >
            {{ card.value }}
          </p>
        </div>
      </div>
      <p v-if="assistant.serverSnapshot?.metrics" class="text-sm text-gray-400">
        {{ tr('Transaction count') }}: {{ assistant.serverSnapshot.metrics.transactionCount }}
      </p>
      <p
        v-if="
          assistant.serverSnapshot?.availability?.selectedPeriod === false ||
          assistant.lastContext.selected.transactionCount === 0
        "
        class="text-sm text-amber-300"
      >
        {{ tr('No transactions recorded in this period.') }}
      </p>
    </section>
    <section v-if="assistant.serverSnapshot" class="panel space-y-3 text-sm text-gray-300">
      <h2 class="text-lg font-semibold text-purple-300">
        {{ t('server_verified_comparison_and_expenses_eur_f9ed9') }}
      </h2>
      <p v-if="assistant.serverSnapshot.availability?.previousPeriod !== false">
        {{
          t('previous_period_value_to_value_income_value_expe_74ff7', {
            p0: formatDate(assistant.serverSnapshot.previousPeriod.start),
            p1: formatDate(assistant.serverSnapshot.previousPeriod.end),
            p2: assistant.serverSnapshot.previousMetrics
              ? formatCurrencyCents(assistant.serverSnapshot.previousMetrics.revenueCents)
              : currency(assistant.serverSnapshot.previousPeriod.totalIncome),
            p3: assistant.serverSnapshot.previousMetrics
              ? formatCurrencyCents(assistant.serverSnapshot.previousMetrics.expenseCents)
              : currency(assistant.serverSnapshot.previousPeriod.totalExpenses),
            p4: assistant.serverSnapshot.previousMetrics
              ? formatCurrencyCents(assistant.serverSnapshot.previousMetrics.netProfitCents)
              : currency(assistant.serverSnapshot.previousPeriod.netProfit),
          })
        }}
      </p>
      <p v-if="assistant.serverSnapshot.availability?.previousPeriod !== false">
        {{
          t('income_change_value_time_zone_value_f0e19', {
            p0:
              assistant.serverSnapshot.metrics && assistant.serverSnapshot.previousMetrics
                ? formatCurrencyCents(
                    BigInt(assistant.serverSnapshot.metrics.revenueCents) -
                      BigInt(assistant.serverSnapshot.previousMetrics.revenueCents),
                  )
                : currency(
                    assistant.serverSnapshot.context.selected.totalIncome -
                      assistant.serverSnapshot.previousPeriod.totalIncome,
                  ),
            p1: assistant.serverSnapshot.timezone,
          })
        }}
      </p>
      <p
        v-if="assistant.serverSnapshot.availability?.previousPeriod === false"
        class="text-amber-300"
      >
        {{ tr('Previous-period comparison unavailable.') }}
      </p>
      <ul v-if="assistant.serverSnapshot.expenseCategories.length" class="list-inside list-disc">
        <li v-for="category in assistant.serverSnapshot.expenseCategories" :key="category.category">
          {{ category.category }}:
          {{
            category.amountCents
              ? formatCurrencyCents(category.amountCents)
              : currency(category.amount)
          }}
        </li>
      </ul>
      <p v-else>{{ t('no_recorded_expense_categories_in_the_selected_p_ef840') }}</p>
    </section>
    <section v-if="assistant.recommendations.length" class="panel space-y-3">
      <h2 class="text-lg font-semibold text-purple-300">{{ tr('Suggestions') }}</h2>
      <ul class="list-inside list-disc space-y-2 text-sm text-gray-300">
        <li v-for="item in assistant.recommendations" :key="item">{{ item }}</li>
      </ul>
    </section>
    <section class="panel">
      <div
        ref="log"
        role="log"
        :aria-label="t('chat_history_ee392')"
        aria-live="polite"
        :aria-busy="assistant.pending"
        class="max-h-[55vh] min-h-48 space-y-5 overflow-y-auto"
      >
        <div v-if="!assistant.messages.length" class="py-8 text-center text-gray-400">
          {{ t('ask_about_recorded_income_expenses_and_customer__3a4d9') }}
        </div>
        <article
          v-for="(message, index) in assistant.messages"
          :key="index"
          class="rounded-xl p-4"
          :class="message.role === 'user' ? 'bg-purple-600/15' : 'bg-white/5'"
        >
          <h2 class="mb-2 text-sm font-semibold text-purple-300">
            {{ message.role === 'user' ? t('you_cae8d') : t('nexora_ai_79b71') }}
          </h2>
          <p
            class="whitespace-pre-wrap break-words"
            :lang="message.role === 'assistant' ? assistant.language : undefined"
          >
            {{ message.content }}
          </p>
        </article>
        <p v-if="assistant.pending" role="status" class="text-purple-300">
          {{ t('analyzing_local_data_the_first_response_may_take_7acf8') }}
        </p>
      </div>
      <p v-if="assistant.error" role="alert" class="mt-4 text-red-300">{{ tr(assistant.error) }}</p>
      <div class="my-5 flex flex-wrap gap-2">
        <button
          v-for="suggestion in publicDemo ? [] : suggestions"
          :key="suggestion"
          class="button-secondary text-sm"
          :disabled="assistant.pending"
          @click="send(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
      <form v-if="!publicDemo" class="flex flex-col gap-3 sm:flex-row" @submit.prevent="send()">
        <label class="flex-1"
          ><span class="sr-only">{{ t('your_question_35251') }}</span
          ><textarea
            v-model="prompt"
            required
            maxlength="4000"
            rows="3"
            class="field w-full"
            :placeholder="t('ask_nexora_ai_d06f5')"
            :disabled="assistant.pending"
            @keydown.ctrl.enter.prevent="send()"
          />
        </label>
        <button
          v-if="assistant.pending"
          type="button"
          class="button-secondary"
          @click="assistant.cancel"
        >
          {{ t('cancel_ea478') }}
        </button>
        <button v-else class="button-primary" :disabled="!prompt.trim()">
          {{ t('send_94966') }}
        </button>
      </form>
      <p class="mt-3 text-xs text-gray-500">
        {{ t('ctrl_enter_to_send_chat_stays_in_memory_for_this_2c9d3') }}
      </p>
    </section>
  </div>
</template>

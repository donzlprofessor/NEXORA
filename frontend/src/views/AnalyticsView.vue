<script setup lang="ts">
import { t, tr, i18n } from '@/i18n'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
} from 'chart.js'
import { useFinanceStore } from '@/stores/finance'
import { useCustomersStore } from '@/stores/customers'
import { usePreferencesStore } from '@/stores/preferences'
const { formatCurrency: currency, formatDate } = usePreferencesStore()
import { customerDay, periodDates, periodMetrics, periods, type Period } from '@/utils/metrics'

ChartJS.register(
  Tooltip,
  Legend,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
)
const activePeriod = ref<Period>('7D')
const financeStore = useFinanceStore()
const customersStore = useCustomersStore()
const { transactions } = storeToRefs(financeStore)
const { customers } = storeToRefs(customersStore)
const days = computed(() => periodDates(activePeriod.value))
const metrics = computed(() => periodMetrics(transactions.value, customers.value, days.value))
const labels = computed(() =>
  days.value.map((day, i) => {
    if (activePeriod.value === '90D' && i % 10 !== 0 && i !== 89) return ''
    if (activePeriod.value === '30D' && i % 5 !== 0 && i !== 29) return ''
    return new Date(`${day}T12:00:00`).toLocaleDateString(
      { en: 'en-IE', pl: 'pl-PL', ru: 'ru-RU' }[i18n.global.locale.value],
      {
        month: 'short',
        day: 'numeric',
      },
    )
  }),
)
const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'Income (€)',
      data: metrics.value.revenueSeries,
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168,85,247,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: activePeriod.value === '7D' ? 4 : 0,
    },
  ],
}))
const customerData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: tr('New customers'),
      data: metrics.value.customerSeries,
      backgroundColor: '#8b5cf6',
      borderRadius: 4,
    },
  ],
}))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#94a3b8', precision: 0 },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
  },
}
const stats = computed(() => [
  { title: 'Recorded Income', value: currency(metrics.value.totalIncome) },
  { title: 'New Customers', value: String(metrics.value.newCustomers) },
  { title: 'Total Expenses', value: currency(metrics.value.totalExpenses) },
  { title: 'Net Profit', value: currency(metrics.value.netProfit) },
])
const knownDates = computed(() => customers.value.filter((c) => customerDay(c)).length)
</script>

<template>
  <div class="text-white">
    <div class="mb-10 flex flex-wrap items-center justify-between gap-6">
      <div>
        <p class="mb-2 text-sm text-gray-500">{{ t('workspace_analytics_7d869') }}</p>
        <h1 class="text-4xl font-bold">{{ t('analytics_a768c') }}</h1>
        <p class="mt-3 text-gray-400">
          {{
            t('last_value_calendar_days_including_today_local_t_55cf8', {
              p0: activePeriod.slice(0, -1),
              p1: formatDate(days[0]!),
              p2: formatDate(days[days.length - 1]!),
            })
          }}
        </p>
      </div>
      <div class="flex gap-2 rounded-xl bg-[#171725] p-1">
        <button
          v-for="period in periods"
          :key="period"
          @click="activePeriod = period"
          :aria-pressed="activePeriod === period"
          class="rounded-lg px-5 py-2 text-sm transition"
          :class="
            activePeriod === period ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
          "
        >
          {{ period }}
        </button>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.title"
        class="rounded-2xl border border-white/10 bg-[#12121f] p-6"
      >
        <p class="text-sm text-gray-400">{{ tr(stat.title) }}</p>
        <h2 class="mt-5 text-3xl font-bold">{{ stat.value }}</h2>
      </div>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <h3 class="text-lg font-semibold">{{ t('income_analytics_936be') }}</h3>
        <p class="mt-2 text-sm text-gray-500">
          {{ t('daily_income_from_recorded_transactions_eddd9') }}
        </p>
        <div class="mt-8 h-72"><Line :data="chartData" :options="chartOptions" /></div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <h3 class="text-lg font-semibold">{{ t('new_customers_84713') }}</h3>
        <p class="mt-2 text-sm text-gray-500">
          {{ t('new_customers_by_registration_date_62584') }}
        </p>
        <div class="mt-8 h-72"><Bar :data="customerData" :options="chartOptions" /></div>
        <p v-if="knownDates < customers.length" class="mt-4 text-xs text-amber-300">
          {{
            t('value_existing_customer_s_have_no_valid_registra_5d97e', {
              p0: customers.length - knownDates,
            })
          }}
        </p>
      </div>
    </div>
    <div class="mt-8 rounded-2xl border border-purple-500/20 bg-[#12121f] p-6">
      <h3 class="text-lg font-semibold text-purple-300">{{ t('business_insights_368af') }}</h3>
      <p class="mt-3 text-sm leading-7 text-gray-400">
        {{
          t('in_the_selected_value_period_recorded_income_val_17a27', {
            p0: activePeriod,
            p1: currency(metrics.totalIncome),
            p2: currency(metrics.totalExpenses),
            p3: currency(metrics.netProfit),
            p4: metrics.newCustomers,
          })
        }}
      </p>
    </div>
  </div>
</template>

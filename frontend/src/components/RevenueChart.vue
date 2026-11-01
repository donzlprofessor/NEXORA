<script setup lang="ts">
import { t, tr, i18n } from '@/i18n'
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFinanceStore } from '@/stores/finance'
import { Line } from 'vue-chartjs'
import { usePreferencesStore } from '@/stores/preferences'
const { formatCurrency } = usePreferencesStore()
import { periodDates, periodMetrics, periods, type Period } from '@/utils/metrics'

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
)

// Finance Store
const financeStore = useFinanceStore()
const { transactions } = storeToRefs(financeStore)

// Period selection
const selectedPeriod = ref<Period>('7D')
const dates = computed(() => periodDates(selectedPeriod.value))
const revenueData = computed(() => periodMetrics(transactions.value, [], dates.value).revenueSeries)

// Chart data
const chartData = computed(() => ({
  labels: dates.value.map((date) => {
    const parsedDate = new Date(`${date}T12:00:00`)

    return parsedDate.toLocaleDateString(
      { en: 'en-IE', pl: 'pl-PL', ru: 'ru-RU' }[i18n.global.locale.value],
      {
        month: 'short',
        day: 'numeric',
      },
    )
  }),

  datasets: [
    {
      label: tr('Income'),
      data: revenueData.value,
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168, 85, 247, 0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: selectedPeriod.value === '7D' ? 4 : 0,
      pointHoverRadius: 6,
      pointBackgroundColor: '#a855f7',
    },
  ],
}))

// Chart settings
const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'index',
    intersect: false,
  },

  plugins: {
    legend: {
      display: false,
    },

    tooltip: {
      callbacks: {
        label: (context) => {
          const value = context.parsed.y ?? 0

          return formatCurrency(value)
        },
      },
    },
  },

  scales: {
    x: {
      ticks: {
        color: '#94a3b8',
        maxTicksLimit: 8,
        maxRotation: 0,
      },

      grid: {
        display: false,
      },
    },

    y: {
      beginAtZero: true,

      ticks: {
        color: '#94a3b8',
      },

      grid: {
        color: 'rgba(255,255,255,0.05)',
      },
    },
  },
}
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h3 class="text-xl font-semibold text-white">{{ t('recorded_income_0b607') }}</h3>

        <p class="mt-1 text-sm text-slate-400">
          {{ t('selected_calendar_days_including_today_local_tim_65953') }}
        </p>
      </div>

      <!-- Period selector -->
      <div class="flex gap-2">
        <button
          v-for="period in periods"
          :key="period"
          @click="selectedPeriod = period"
          :aria-pressed="selectedPeriod === period"
          :class="[
            'rounded-lg px-3 py-2 text-sm transition',
            selectedPeriod === period
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10',
          ]"
        >
          {{ period }}
        </button>
      </div>
    </div>

    <!-- Chart -->
    <div class="h-72 w-full">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { t, tr, i18n } from '@/i18n'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import RevenueChart from '../components/RevenueChart.vue'
import { useFinanceStore } from '@/stores/finance'
import { useCustomersStore } from '@/stores/customers'
import { usePreferencesStore } from '@/stores/preferences'
const { formatCurrency } = usePreferencesStore()

const customersStore = useCustomersStore()

const { activeCustomers } = storeToRefs(customersStore)

const financeStore = useFinanceStore()

const { totalIncome, totalExpenses, netProfit } = storeToRefs(financeStore)

const stats = computed(() => [
  { title: 'Recorded Income', value: formatCurrency(totalIncome.value) },
  {
    title: 'Active Customers (Current)',
    value: activeCustomers.value.toLocaleString(
      { en: 'en-IE', pl: 'pl-PL', ru: 'ru-RU' }[i18n.global.locale.value],
    ),
  },
  { title: 'Total Expenses', value: formatCurrency(totalExpenses.value) },
  { title: 'Net Profit', value: formatCurrency(netProfit.value) },
])
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-10">
      <p class="mb-2 text-sm text-gray-500">{{ t('workspace_dashboard_59c46') }}</p>

      <h1 class="text-4xl font-bold">{{ t('dashboard_2938c') }}</h1>

      <p class="mt-3 text-gray-400">
        {{ t('all_time_financial_totals_from_saved_transaction_f28b8') }}
      </p>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.title"
        class="rounded-2xl border border-white/10 bg-[#12121f] p-6 transition hover:border-purple-500/50"
      >
        <p class="text-sm text-gray-400">
          {{ tr(stat.title) }}
        </p>

        <h2 class="mt-5 text-3xl font-bold">
          {{ stat.value }}
        </h2>
      </div>
    </div>

    <!-- Dashboard Panels -->
    <div class="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <!-- Revenue -->
      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6 xl:col-span-2">
        <h3 class="text-lg font-semibold">{{ t('revenue_overview_0b2eb') }}</h3>

        <p class="mt-2 text-sm text-gray-500">{{ t('revenue_performance_over_time_92b44') }}</p>

        <div class="mt-8">
          <RevenueChart />
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <h3 class="text-lg font-semibold">{{ t('business_summary_5c156') }}</h3>
        <div class="mt-8 rounded-xl bg-purple-500/10 p-5">
          <h4 class="font-semibold">{{ t('all_time_recorded_activity_92dc3') }}</h4>
          <p class="mt-3 text-sm leading-6 text-gray-400">
            {{
              t('income_value_expenses_value_net_profit_value_9c062', {
                p0: formatCurrency(totalIncome),
                p1: formatCurrency(totalExpenses),
                p2: formatCurrency(netProfit),
              })
            }}
          </p>
          <p class="mt-3 text-sm leading-6 text-gray-400">
            {{ t('income_is_based_on_transactions_independently_of_a05b4') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

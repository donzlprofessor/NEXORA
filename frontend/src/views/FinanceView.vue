<script setup lang="ts">
import { t, tr } from '@/i18n'
import { computed, reactive, ref } from 'vue'
import { usePagination } from '@/composables/usePagination'
import { useDialog } from '@/composables/useDialog'
import PaginationControls from '@/components/PaginationControls.vue'
import { filterTransactions, transactionError, type TransactionFilters } from '@/utils/transactions'
import type { Transaction } from '@/stores/finance'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@/stores/preferences'
import { useFinanceStore, type TransactionType } from '@/stores/finance'

// Connect Pinia store
const financeStore = useFinanceStore()

const { transactions, totalIncome, totalExpenses, netProfit } = storeToRefs(financeStore)

// Currency formatting
const { formatCurrency, formatDate } = usePreferencesStore()

const filters = reactive<TransactionFilters>({
  search: '',
  type: '',
  category: '',
  from: '',
  to: '',
  sort: 'date-desc',
})
const categories = computed(() => [...new Set(transactions.value.map((t) => t.category))].sort())
const filtered = computed(() => filterTransactions(transactions.value, filters))
const { page, pages, rows } = usePagination(filtered)
const editingId = ref<number | null>(null)
const feedback = ref('')

// Modal
const showModal = ref(false)
const formError = ref('')
const saving = ref(false)

function getTodayDate() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)

  return localDate.toISOString().slice(0, 10)
}

const form = ref({
  description: '',
  category: '',
  amount: 0,
  type: 'income' as TransactionType,
  date: getTodayDate(),
})

function openModal() {
  editingId.value = null
  form.value = {
    description: '',
    category: '',
    amount: 0,
    type: 'income',
    date: getTodayDate(),
  }

  formError.value = ''
  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
  formError.value = ''
}

useDialog(showModal, closeModal)
function editTransaction(transaction: Transaction) {
  editingId.value = transaction.id
  form.value = {
    description: transaction.description,
    category: transaction.category,
    amount: transaction.amount,
    type: transaction.type,
    date: transaction.date,
  }
  formError.value = ''
  showModal.value = true
}

// Add transaction
async function addTransaction() {
  if (saving.value) return
  const description = form.value.description.trim()
  const category = form.value.category.trim()
  const amount = Number(form.value.amount)

  const changes = { description, category, amount, type: form.value.type, date: form.value.date }
  formError.value = transactionError(changes)
  if (formError.value) return
  saving.value = true
  try {
    if (editingId.value !== null) await financeStore.updateTransaction(editingId.value, changes)
    else
      await financeStore.addTransaction({
        ...changes,
        id: Math.max(Date.now(), ...transactions.value.map((t) => t.id + 1)),
      })
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Transaction could not be saved.'
    return
  } finally {
    saving.value = false
  }
  feedback.value = editingId.value === null ? 'Transaction added.' : 'Transaction updated.'

  closeModal()
}

// Delete transaction
async function deleteTransaction(id: number) {
  const confirmed = window.confirm(tr('Are you sure you want to delete this transaction?'))

  if (!confirmed) return

  try {
    await financeStore.deleteTransaction(id)
    feedback.value = 'Transaction deleted.'
  } catch (cause) {
    feedback.value = cause instanceof Error ? cause.message : 'Delete failed.'
  }
}
</script>

<template>
  <div class="space-y-10">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-5">
      <div>
        <p class="mb-2 text-sm text-gray-500">{{ t('workspace_finance_9bfa3') }}</p>

        <h1 class="text-4xl font-bold text-white">{{ t('finance_c4829') }}</h1>

        <p class="mt-3 text-gray-400">
          {{ t('track_your_business_finances_and_performance_a602b') }}
        </p>
      </div>

      <button
        @click="openModal"
        class="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500"
      >
        {{ t('add_transaction_5939e') }}
      </button>
    </div>

    <p v-if="feedback" role="status" class="text-green-300">{{ tr(feedback) }}</p>
    <!-- Financial Statistics -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('total_income_cfb8b') }}</p>

        <h2 class="mt-5 text-3xl font-bold text-green-400">
          {{ formatCurrency(totalIncome) }}
        </h2>
      </div>

      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('total_expenses_10f0a') }}</p>

        <h2 class="mt-5 text-3xl font-bold text-red-400">
          {{ formatCurrency(totalExpenses) }}
        </h2>
      </div>

      <div class="rounded-2xl border border-purple-500/30 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('net_profit_43d72') }}</p>

        <h2
          class="mt-5 text-3xl font-bold"
          :class="netProfit >= 0 ? 'text-purple-400' : 'text-red-400'"
        >
          {{ formatCurrency(netProfit) }}
        </h2>
      </div>
    </div>

    <!-- Transactions Table -->
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-[#12121f]">
      <div class="border-b border-white/10 p-6">
        <h3 class="text-xl font-semibold">{{ t('recent_transactions_88856') }}</h3>

        <p class="mt-2 text-sm text-gray-400">
          {{ t('all_time_totals_above_transactions_are_sorted_by_89c2a') }}
        </p>
      </div>

      <div class="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <label
          >{{ t('search_13348')
          }}<input
            v-model="filters.search"
            type="search"
            class="field w-full"
            :placeholder="t('description_or_category_c22a7')"
        /></label>
        <label
          >{{ t('type_a1fa2')
          }}<select v-model="filters.type" class="field w-full">
            <option value="">{{ t('all_types_13435') }}</option>
            <option value="income">{{ t('income_1f08d') }}</option>
            <option value="expense">{{ t('expense_7bf48') }}</option>
          </select></label
        >
        <label
          >{{ t('category_3adbd')
          }}<select v-model="filters.category" class="field w-full">
            <option value="">{{ t('all_categories_62f5d') }}</option>
            <option v-for="category in categories" :key="category">{{ category }}</option>
          </select></label
        >
        <label
          >{{ t('from_5da61') }}<input v-model="filters.from" type="date" class="field w-full"
        /></label>
        <label
          >{{ t('through_c0c5c') }}<input v-model="filters.to" type="date" class="field w-full"
        /></label>
        <label
          >{{ t('sort_6b46a')
          }}<select v-model="filters.sort" class="field w-full">
            <option value="date-desc">{{ t('date_newest_32fdd') }}</option>
            <option value="date-asc">{{ t('date_oldest_b8426') }}</option>
            <option value="amount-desc">{{ t('amount_highest_76431') }}</option>
            <option value="amount-asc">{{ t('amount_lowest_91215') }}</option>
          </select></label
        >
        <p
          v-if="filters.from && filters.to && filters.from > filters.to"
          role="alert"
          class="text-amber-300"
        >
          {{ t('start_date_must_be_on_or_before_end_date_615c7') }}
        </p>
        <button
          class="button-secondary"
          @click="
            Object.assign(filters, {
              search: '',
              type: '',
              category: '',
              from: '',
              to: '',
              sort: 'date-desc',
            })
          "
        >
          {{ t('clear_filters_0b275') }}
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-white/5 text-sm text-gray-400">
            <tr>
              <th class="p-5">{{ t('transaction_1b0ff') }}</th>
              <th class="p-5">{{ t('category_3adbd') }}</th>
              <th class="p-5">{{ t('date_44749') }}</th>
              <th class="p-5">{{ t('type_a1fa2') }}</th>
              <th class="p-5 text-right">{{ t('amount_b2f40') }}</th>
              <th class="p-5 text-right">{{ t('actions_06df3') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="transaction in rows"
              :key="transaction.id"
              class="border-t border-white/10 transition hover:bg-white/5"
            >
              <td class="p-5 font-medium">
                {{ transaction.description }}
              </td>

              <td class="p-5 text-gray-400">
                {{ transaction.category }}
              </td>

              <td class="p-5 text-gray-400">
                {{ formatDate(transaction.date) }}
              </td>

              <td class="p-5">
                <span
                  :class="
                    transaction.type === 'income'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  "
                  class="rounded-lg px-3 py-1 text-sm"
                >
                  {{ tr(transaction.type) }}
                </span>
              </td>

              <td
                class="p-5 text-right font-semibold"
                :class="transaction.type === 'income' ? 'text-green-400' : 'text-red-400'"
              >
                {{ transaction.type === 'income' ? '+' : '-' }}
                {{ formatCurrency(transaction.amount) }}
              </td>

              <td class="p-5 text-right">
                <button class="mr-4 text-sm text-purple-300" @click="editTransaction(transaction)">
                  {{ t('edit_7dce1') }}
                </button>
                <button
                  @click="deleteTransaction(transaction.id)"
                  class="text-sm text-red-400 transition hover:text-red-300"
                >
                  {{ t('delete_f2a6c') }}
                </button>
              </td>
            </tr>

            <tr v-if="filtered.length === 0">
              <td colspan="6" class="p-10 text-center text-gray-500">
                {{
                  transactions.length
                    ? t('no_matching_transactions_try_clearing_filters_14d99')
                    : t('no_transactions_yet_add_your_first_transaction_346d0')
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PaginationControls
      :page="page"
      :pages="pages"
      :total="filtered.length"
      @change="page = $event"
    />
    <!-- Add Transaction Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4"
      @click.self="closeModal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        class="my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[#181827] p-8 shadow-2xl"
      >
        <div class="mb-8 flex items-center justify-between">
          <h2 id="transaction-modal-title" class="text-2xl font-bold">
            {{ editingId === null ? t('add_transaction_18cef') : t('edit_transaction_ee6a8') }}
          </h2>

          <button
            @click="closeModal"
            :aria-label="t('close_modal_a2071')"
            class="text-2xl text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="addTransaction" class="space-y-5">
          <!-- Description -->
          <div>
            <label for="transaction-description" class="mb-2 block text-sm text-gray-400">{{
              t('description_b5a7a')
            }}</label>

            <input
              id="transaction-description"
              v-model="form.description"
              type="text"
              maxlength="200"
              required
              :placeholder="t('e_g_website_development_85fb3')"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-4 text-white outline-none focus:border-purple-500"
            />
          </div>

          <!-- Category -->
          <div>
            <label for="transaction-category" class="mb-2 block text-sm text-gray-400">{{
              t('category_3adbd')
            }}</label>

            <input
              id="transaction-category"
              v-model="form.category"
              type="text"
              maxlength="200"
              required
              :placeholder="t('e_g_services_b663e')"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-4 text-white outline-none focus:border-purple-500"
            />
          </div>

          <!-- Amount -->
          <div>
            <label for="transaction-amount" class="mb-2 block text-sm text-gray-400">{{
              t('amount_e9e8c')
            }}</label>

            <input
              id="transaction-amount"
              v-model.number="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-4 text-white outline-none focus:border-purple-500"
            />
          </div>

          <!-- Type -->
          <div>
            <label for="transaction-type" class="mb-2 block text-sm text-gray-400">{{
              t('transaction_type_34528')
            }}</label>

            <select
              id="transaction-type"
              v-model="form.type"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-4 text-white outline-none focus:border-purple-500"
            >
              <option value="income">{{ t('income_1f08d') }}</option>
              <option value="expense">{{ t('expense_7bf48') }}</option>
            </select>
          </div>

          <!-- Date -->
          <div>
            <label for="transaction-date" class="mb-2 block text-sm text-gray-400">{{
              t('date_44749')
            }}</label>

            <input
              id="transaction-date"
              v-model="form.date"
              type="date"
              required
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-4 text-white outline-none focus:border-purple-500"
            />
          </div>

          <p v-if="formError" role="alert" class="text-sm text-red-400">
            {{ tr(formError) }}
          </p>

          <!-- Buttons -->
          <div class="flex gap-4 pt-5">
            <button
              type="button"
              @click="closeModal"
              class="flex-1 rounded-xl bg-white/10 py-3 font-semibold transition hover:bg-white/20"
            >
              {{ t('cancel_ea478') }}
            </button>

            <button
              type="submit"
              :disabled="saving"
              class="flex-1 rounded-xl bg-purple-600 py-3 font-semibold transition hover:bg-purple-500"
            >
              {{ saving ? t('saving_575f5') : t('save_transaction_00c11') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

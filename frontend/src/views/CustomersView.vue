<script setup lang="ts">
import { t, tr } from '@/i18n'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@/stores/preferences'
import { useDialog } from '@/composables/useDialog'
import { usePagination } from '@/composables/usePagination'
import PaginationControls from '@/components/PaginationControls.vue'
import { customerError, sortCustomers, type CustomerSort } from '@/utils/customers'
import { useCustomersStore, type Customer, type CustomerStatus } from '@/stores/customers'

const customersStore = useCustomersStore()

const { customers, activeCustomers, totalRevenue } = storeToRefs(customersStore)

const search = ref('')
const sort = ref<CustomerSort>('name-asc')
const formError = ref('')
const saving = ref(false)
const feedback = ref('')
const statusFilter = ref('All')

const showModal = ref(false)
const editingId = ref<number | null>(null)

const emptyForm = () => ({
  name: '',
  email: '',
  company: '',
  status: 'Active' as CustomerStatus,
  totalSpent: 0,
})

const form = ref(emptyForm())

const filteredCustomers = computed(() => {
  const query = search.value.trim().toLowerCase()

  return customers.value.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(query) ||
      customer.email.trim().toLowerCase().includes(query) ||
      customer.company.toLowerCase().includes(query)

    const matchesStatus = statusFilter.value === 'All' || customer.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

const sortedCustomers = computed(() => sortCustomers(filteredCustomers.value, sort.value))
const { page, pages, rows } = usePagination(sortedCustomers)
useDialog(showModal, closeModal)

function openAddModal() {
  formError.value = ''
  editingId.value = null
  form.value = emptyForm()
  showModal.value = true
}

function openEditModal(customer: Customer) {
  formError.value = ''
  editingId.value = customer.id

  form.value = {
    name: customer.name,
    email: customer.email,
    company: customer.company,
    status: customer.status,
    totalSpent: customer.totalSpent,
  }

  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
  editingId.value = null
}

async function saveCustomer() {
  if (saving.value) return
  const name = form.value.name.trim()
  const email = form.value.email.trim().toLowerCase()
  const company = form.value.company.trim()
  const totalSpent = Number(form.value.totalSpent)

  formError.value = customerError(
    { name, email, company, totalSpent, status: form.value.status },
    customers.value,
    editingId.value,
  )
  if (formError.value) return

  try {
    saving.value = true
    await customersStore.saveCustomer(
      {
        name,
        email,
        company,
        status: form.value.status,
        totalSpent,
        ...(editingId.value === null ? { createdAt: new Date().toISOString() } : {}),
      },
      editingId.value,
    )
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Customer could not be saved.'
    return
  } finally {
    saving.value = false
  }

  feedback.value = editingId.value === null ? 'Customer added.' : 'Customer updated.'
  closeModal()
}

async function deleteCustomer(customer: Customer) {
  if (confirm(t('delete_name_8d5ec', { name: customer.name }))) {
    try {
      await customersStore.deleteCustomer(customer.id)
      feedback.value = 'Customer deleted.'
    } catch (cause) {
      feedback.value = cause instanceof Error ? cause.message : 'Delete failed.'
    }
  }
}

function statusClass(status: CustomerStatus) {
  return {
    Active: 'bg-green-500/10 text-green-400',
    Inactive: 'bg-red-500/10 text-red-400',
    Lead: 'bg-yellow-500/10 text-yellow-400',
  }[status]
}

const { formatCurrency } = usePreferencesStore()
</script>
<template>
  <div class="space-y-6 text-white">
    <!-- Header -->
    <div class="mb-10 flex flex-wrap items-center justify-between gap-5">
      <div>
        <p class="mb-2 text-sm text-gray-500">{{ t('workspace_customers_97625') }}</p>

        <h1 class="text-4xl font-bold">{{ t('customers_e6d0e') }}</h1>

        <p class="mt-3 text-gray-400">
          {{ t('manage_customers_lifetime_spending_is_entered_in_545ab') }}
        </p>
      </div>

      <button
        @click="openAddModal"
        class="rounded-xl bg-purple-600 px-6 py-3 font-semibold transition hover:bg-purple-500"
      >
        {{ t('add_customer_0435e') }}
      </button>
    </div>

    <p v-if="feedback" role="status" class="mb-5 text-green-300">{{ tr(feedback) }}</p>
    <!-- Statistics -->
    <div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('total_customers_769a5') }}</p>
        <h2 class="mt-4 text-3xl font-bold">{{ customers.length }}</h2>
      </div>

      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('active_customers_de493') }}</p>
        <h2 class="mt-4 text-3xl font-bold text-green-400">
          {{ activeCustomers }}
        </h2>
      </div>

      <div class="rounded-2xl border border-white/10 bg-[#12121f] p-6">
        <p class="text-sm text-gray-400">{{ t('customer_lifetime_spending_589e0') }}</p>
        <h2 class="mt-4 text-3xl font-bold">
          {{ formatCurrency(totalRevenue) }}
        </h2>
      </div>
    </div>

    <!-- Customer Table -->
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-[#12121f]">
      <!-- Filters -->
      <div class="flex flex-wrap gap-4 border-b border-white/10 p-6">
        <input
          v-model="search"
          type="search"
          :placeholder="t('search_customers_3e377')"
          :aria-label="t('search_customers_8c21c')"
          class="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-500"
        />

        <select
          v-model="statusFilter"
          :aria-label="t('filter_by_status_5dd5c')"
          class="rounded-xl border border-white/10 bg-[#080812] px-5 py-3 text-white"
        >
          <option value="All">{{ t('all_b1c94') }}</option>
          <option value="Active">{{ t('active_4d3d7') }}</option>
          <option value="Inactive">{{ t('inactive_3cab0') }}</option>
          <option value="Lead">{{ t('lead_a745d') }}</option>
        </select>
        <select v-model="sort" :aria-label="t('sort_customers_08cf0')" class="field">
          <option value="name-asc">{{ t('name_a_to_z_41bdf') }}</option>
          <option value="name-desc">{{ t('name_z_to_a_9f4dc') }}</option>
          <option value="status-asc">{{ t('status_a_to_z_55855') }}</option>
          <option value="status-desc">{{ t('status_z_to_a_616b1') }}</option>
          <option value="spent-desc">{{ t('spending_highest_d64ae') }}</option>
          <option value="spent-asc">{{ t('spending_lowest_ff158') }}</option>
        </select>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[750px] text-left">
          <thead class="border-b border-white/10 bg-white/[0.02]">
            <tr class="text-sm text-gray-400">
              <th class="p-5 font-medium">{{ t('customer_ce266') }}</th>
              <th class="p-5 font-medium">{{ t('company_1c76c') }}</th>
              <th class="p-5 font-medium">{{ t('status_ec53a') }}</th>
              <th class="p-5 font-medium">{{ t('total_spent_c21a3') }}</th>
              <th class="p-5 text-right font-medium">{{ t('actions_06df3') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="customer in rows"
              :key="customer.id"
              class="border-b border-white/5 transition hover:bg-white/[0.03]"
            >
              <td class="p-5">
                <p class="font-semibold">{{ customer.name }}</p>
                <p class="mt-1 text-sm text-gray-500">
                  {{ customer.email }}
                </p>
              </td>

              <td class="p-5 text-gray-300">
                {{ customer.company }}
              </td>

              <td class="p-5">
                <span
                  class="rounded-lg px-3 py-1 text-xs font-semibold"
                  :class="statusClass(customer.status)"
                >
                  {{ tr(customer.status) }}
                </span>
              </td>

              <td class="p-5 font-semibold">
                {{ formatCurrency(customer.totalSpent) }}
              </td>

              <td class="p-5 text-right">
                <button
                  @click="openEditModal(customer)"
                  class="mr-4 text-sm text-purple-400 hover:text-purple-300"
                >
                  {{ t('edit_7dce1') }}
                </button>

                <button
                  @click="deleteCustomer(customer)"
                  class="text-sm text-red-400 hover:text-red-300"
                >
                  {{ t('delete_f2a6c') }}
                </button>
              </td>
            </tr>

            <tr v-if="filteredCustomers.length === 0">
              <td colspan="5" class="p-10 text-center text-gray-500">
                {{
                  customers.length
                    ? t('no_matching_customers_try_another_search_or_stat_f72cc')
                    : t('no_customers_yet_add_your_first_customer_to_get__77c4d')
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
      :total="filteredCustomers.length"
      @change="page = $event"
    />
    <!-- Add / Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      @click.self="closeModal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#171725] p-8"
      >
        <div class="mb-6 flex items-center justify-between">
          <h2 id="customer-modal-title" class="text-2xl font-bold">
            {{ editingId === null ? t('add_customer_daaa0') : t('edit_customer_e5d63') }}
          </h2>

          <button
            @click="closeModal"
            :aria-label="t('close_dialog_3c62b')"
            class="text-xl text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="saveCustomer" class="space-y-5">
          <div>
            <label for="customer-name" class="mb-2 block text-sm text-gray-400">{{
              t('full_name_63005')
            }}</label>
            <input
              id="customer-name"
              v-model="form.name"
              required
              maxlength="100"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label for="customer-email" class="mb-2 block text-sm text-gray-400">{{
              t('email_ce8ae')
            }}</label>
            <input
              id="customer-email"
              v-model="form.email"
              type="email"
              required
              maxlength="254"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label for="customer-company" class="mb-2 block text-sm text-gray-400">{{
              t('company_1c76c')
            }}</label>
            <input
              id="customer-company"
              v-model="form.company"
              required
              maxlength="100"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label for="customer-status" class="mb-2 block text-sm text-gray-400">{{
              t('status_ec53a')
            }}</label>
            <select
              id="customer-status"
              v-model="form.status"
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-3"
            >
              <option value="Active">{{ t('active_4d3d7') }}</option>
              <option value="Inactive">{{ t('inactive_3cab0') }}</option>
              <option value="Lead">{{ t('lead_a745d') }}</option>
            </select>
          </div>

          <div>
            <label for="customer-spent" class="mb-2 block text-sm text-gray-400">{{
              t('total_spent_e3e1d')
            }}</label>
            <input
              id="customer-spent"
              v-model.number="form.totalSpent"
              type="number"
              min="0"
              step="0.01"
              required
              class="w-full rounded-xl border border-white/10 bg-[#080812] p-3 outline-none focus:border-purple-500"
            />
          </div>

          <p v-if="formError" role="alert" class="text-sm text-red-300">{{ tr(formError) }}</p>
          <div class="flex gap-3 pt-3">
            <button
              type="button"
              @click="closeModal"
              class="flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15"
            >
              {{ t('cancel_ea478') }}
            </button>

            <button
              type="submit"
              :disabled="saving"
              class="flex-1 rounded-xl bg-purple-600 py-3 font-semibold hover:bg-purple-500"
            >
              {{ saving ? t('saving_575f5') : t('save_customer_3f01e') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

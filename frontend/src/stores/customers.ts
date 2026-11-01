import { isPublicDemo } from '@/demo/config'
import { portfolioData } from '@/demo/data'
import { storageKey } from '@/demo/config'
import { defineStore } from 'pinia'
import { api } from '@/services/http'
import { computed, nextTick, ref, watch } from 'vue'

export type CustomerStatus = 'Active' | 'Inactive' | 'Lead'
export interface Customer {
  id: number
  name: string
  email: string
  company: string
  status: CustomerStatus
  totalSpent: number
  createdAt?: string
}
const STORAGE_KEY = 'nexora_customers'
export const demoCustomers: Customer[] = [
  {
    id: 1,
    name: 'Alexander Smith',
    email: 'alex@example.com',
    company: 'TechCorp',
    status: 'Active',
    totalSpent: 4250,
  },
  {
    id: 2,
    name: 'Emma Johnson',
    email: 'emma@example.com',
    company: 'DesignHub',
    status: 'Active',
    totalSpent: 3180,
  },
  {
    id: 3,
    name: 'Michael Brown',
    email: 'michael@example.com',
    company: 'StartupLab',
    status: 'Lead',
    totalSpent: 0,
  },
  {
    id: 4,
    name: 'Sophia Wilson',
    email: 'sophia@example.com',
    company: 'CloudWorks',
    status: 'Inactive',
    totalSpent: 1250,
  },
  {
    id: 5,
    name: 'Daniel Miller',
    email: 'daniel@example.com',
    company: 'InnovateX',
    status: 'Active',
    totalSpent: 6890,
  },
]
function isCustomer(value: unknown): value is Customer {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return (
    typeof c.id === 'number' &&
    Number.isFinite(c.id) &&
    typeof c.name === 'string' &&
    typeof c.email === 'string' &&
    typeof c.company === 'string' &&
    (c.status === 'Active' || c.status === 'Inactive' || c.status === 'Lead') &&
    typeof c.totalSpent === 'number' &&
    Number.isFinite(c.totalSpent) &&
    c.totalSpent >= 0 &&
    (c.createdAt === undefined ||
      (typeof c.createdAt === 'string' && !Number.isNaN(Date.parse(c.createdAt))))
  )
}
function loadCustomers(): Customer[] {
  try {
    const saved = localStorage.getItem(storageKey(STORAGE_KEY))
    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed.filter(isCustomer)
    }
  } catch (error) {
    console.error('Failed to load customers:', error)
  }
  return isPublicDemo() ? portfolioData().customers : demoCustomers.map((c) => ({ ...c }))
}
export const useCustomersStore = defineStore('customers', () => {
  const customers = ref<Customer[]>(loadCustomers())
  const storageError = ref('')
  if (isPublicDemo()) {
    try {
      if (localStorage.getItem(storageKey('nexora_customers')) === null)
        localStorage.setItem(storageKey('nexora_customers'), JSON.stringify(customers.value))
    } catch {
      storageError.value = 'Customers could not be saved. Export your data before closing this tab.'
    }
  }
  const accountMode = ref(false)
  let accountEpoch = 0
  async function setAccountData(records: Customer[] | null) {
    accountEpoch++
    accountMode.value = true
    customers.value = records ?? loadCustomers()
    await nextTick()
    accountMode.value = records !== null
  }
  async function saveCustomer(changes: Omit<Customer, 'id'>, id: number | null) {
    const epoch = accountEpoch
    if (accountMode.value) {
      const record = await api<Customer>(
        id === null ? '/api/account/customers' : `/api/account/customers/${id}`,
        id === null ? 'POST' : 'PUT',
        changes,
      )
      if (!accountMode.value || epoch !== accountEpoch)
        throw new Error('Account changed while saving. Response discarded.')
      const index = customers.value.findIndex((c) => c.id === id)
      if (index < 0) customers.value.push(record)
      else customers.value[index] = record
    } else if (id === null)
      customers.value.push({ ...changes, id: Math.max(0, ...customers.value.map((c) => c.id)) + 1 })
    else {
      const record = customers.value.find((c) => c.id === id)
      if (record) Object.assign(record, changes)
    }
  }
  async function deleteCustomer(id: number) {
    const epoch = accountEpoch
    if (accountMode.value) {
      await api(`/api/account/customers/${id}`, 'DELETE')
      if (!accountMode.value || epoch !== accountEpoch)
        throw new Error('Account changed while deleting. Response discarded.')
    }
    customers.value = customers.value.filter((c) => c.id !== id)
  }
  const activeCustomers = computed(
    () => customers.value.filter((c) => c.status === 'Active').length,
  )
  const totalRevenue = computed(
    () =>
      customers.value.reduce(
        (sum, c) => sum + Math.round((c.totalSpent + Number.EPSILON) * 100),
        0,
      ) / 100,
  )
  watch(
    customers,
    (value) => {
      if (accountMode.value) return
      try {
        localStorage.setItem(storageKey(STORAGE_KEY), JSON.stringify(value))
        storageError.value = ''
      } catch {
        storageError.value =
          'Customers could not be saved. Export your data before closing this tab.'
      }
    },
    { deep: true },
  )
  return {
    customers,
    activeCustomers,
    totalRevenue,
    storageError,
    accountMode,
    setAccountData,
    saveCustomer,
    deleteCustomer,
  }
})

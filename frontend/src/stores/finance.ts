import { isPublicDemo } from '@/demo/config'
import { portfolioData } from '@/demo/data'
import { storageKey } from '@/demo/config'
import { defineStore } from 'pinia'
import { api } from '@/services/http'
import { computed, nextTick, ref, watch } from 'vue'
import { financialTotals } from '@/utils/metrics'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: number
  description: string
  category: string
  amount: number
  type: TransactionType
  date: string
  customerId?: number
}

export const defaultTransactions: Transaction[] = [
  {
    id: 1,
    description: 'Website Development',
    category: 'Services',
    amount: 4500,
    type: 'income',
    date: '2026-10-20',
  },
  {
    id: 2,
    description: 'Software Subscription',
    category: 'Software',
    amount: 120,
    type: 'expense',
    date: '2026-10-21',
  },
  {
    id: 3,
    description: 'Consulting Project',
    category: 'Consulting',
    amount: 2800,
    type: 'income',
    date: '2026-10-23',
  },
]

function loadTransactions(): Transaction[] {
  try {
    const saved = localStorage.getItem(storageKey('nexora-transactions'))

    if (!saved)
      return isPublicDemo()
        ? portfolioData().transactions
        : defaultTransactions.map((t) => ({ ...t }))

    const parsed: unknown = JSON.parse(saved)

    if (!Array.isArray(parsed))
      return isPublicDemo()
        ? portfolioData().transactions
        : defaultTransactions.map((t) => ({ ...t }))

    return parsed.filter(
      (item): item is Transaction =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.id === 'number' &&
        Number.isFinite(item.id) &&
        typeof item.description === 'string' &&
        typeof item.category === 'string' &&
        typeof item.amount === 'number' &&
        Number.isFinite(item.amount) &&
        item.amount >= 0 &&
        (item.type === 'income' || item.type === 'expense') &&
        typeof item.date === 'string',
    )
  } catch {
    return isPublicDemo()
      ? portfolioData().transactions
      : defaultTransactions.map((t) => ({ ...t }))
  }
}

export const useFinanceStore = defineStore('finance', () => {
  const transactions = ref<Transaction[]>(loadTransactions())
  const storageError = ref('')
  if (isPublicDemo()) {
    try {
      if (localStorage.getItem(storageKey('nexora-transactions')) === null)
        localStorage.setItem(storageKey('nexora-transactions'), JSON.stringify(transactions.value))
    } catch {
      storageError.value =
        'Transactions could not be saved. Export your data before closing this tab.'
    }
  }
  const accountMode = ref(false)
  let accountEpoch = 0
  async function setAccountData(records: Transaction[] | null) {
    accountEpoch++
    accountMode.value = true
    transactions.value = records ?? loadTransactions()
    await nextTick()
    accountMode.value = records !== null
  }

  const totals = computed(() => financialTotals(transactions.value))
  const totalIncome = computed(() => totals.value.totalIncome)
  const totalExpenses = computed(() => totals.value.totalExpenses)
  const netProfit = computed(() => totals.value.netProfit)

  async function addTransaction(transaction: Transaction) {
    const epoch = accountEpoch
    if (accountMode.value) {
      const { id: _id, ...body } = transaction
      transaction = await api<Transaction>('/api/account/transactions', 'POST', body)
      if (!accountMode.value || epoch !== accountEpoch)
        throw new Error('Account changed while saving. Response discarded.')
    }
    transactions.value.unshift(transaction)
  }

  async function updateTransaction(id: number, changes: Omit<Transaction, 'id'>) {
    const epoch = accountEpoch
    const existing = transactions.value.find((t) => t.id === id)
    if (!existing) throw new Error('Transaction no longer exists.')
    if (accountMode.value) {
      changes = await api<Transaction>(`/api/account/transactions/${id}`, 'PUT', {
        ...changes,
        customerId: existing.customerId,
      })
      if (!accountMode.value || epoch !== accountEpoch)
        throw new Error('Account changed while saving. Response discarded.')
    }
    Object.assign(existing, changes)
  }

  async function deleteTransaction(id: number) {
    const epoch = accountEpoch
    if (accountMode.value) {
      await api(`/api/account/transactions/${id}`, 'DELETE')
      if (!accountMode.value || epoch !== accountEpoch)
        throw new Error('Account changed while deleting. Response discarded.')
    }
    transactions.value = transactions.value.filter((transaction) => transaction.id !== id)
  }

  watch(
    transactions,
    (value) => {
      if (accountMode.value) return
      try {
        localStorage.setItem(storageKey('nexora-transactions'), JSON.stringify(value))
        storageError.value = ''
      } catch {
        storageError.value =
          'Transactions could not be saved. Export your data before closing this tab.'
      }
    },
    { deep: true },
  )

  return {
    transactions,
    storageError,
    accountMode,
    setAccountData,
    totalIncome,
    totalExpenses,
    netProfit,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  }
})

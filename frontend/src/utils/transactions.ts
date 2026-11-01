import type { Transaction } from '@/stores/finance'
import { isDateKey } from './metrics'

export interface TransactionFilters {
  search: string
  type: string
  category: string
  from: string
  to: string
  sort: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
}

export function filterTransactions(
  records: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const query = filters.search.trim().toLowerCase()
  return records
    .filter(
      (t) =>
        (!query || `${t.description} ${t.category}`.toLowerCase().includes(query)) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.category || t.category === filters.category) &&
        (!filters.from || (isDateKey(t.date) && t.date >= filters.from)) &&
        (!filters.to || (isDateKey(t.date) && t.date <= filters.to)),
    )
    .sort((a, b) => {
      if (filters.sort.startsWith('amount'))
        return (a.amount - b.amount) * (filters.sort === 'amount-asc' ? 1 : -1)
      const aDate = isDateKey(a.date) ? a.date : ''
      const bDate = isDateKey(b.date) ? b.date : ''
      return aDate.localeCompare(bDate) * (filters.sort === 'date-asc' ? 1 : -1)
    })
}

export function transactionError(t: Omit<Transaction, 'id'>): string {
  if (!t.description.trim() || !t.category.trim()) return 'Description and category are required.'
  if (t.description.length > 200 || t.category.length > 80)
    return 'Description must be at most 200 characters and category at most 80.'
  if (!Number.isFinite(t.amount) || t.amount <= 0 || t.amount > 1e12)
    return 'Amount must be greater than zero and at most one trillion EUR.'
  if (Math.abs(t.amount * 100 - Math.round(t.amount * 100)) > 0.001)
    return 'Use at most two decimal places.'
  if (!isDateKey(t.date)) return 'Choose a valid calendar date.'
  if (t.type !== 'income' && t.type !== 'expense') return 'Choose income or expense.'
  return ''
}

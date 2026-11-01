import type { Transaction } from '@/stores/finance'
import type { Customer } from '@/stores/customers'

export type Period = '7D' | '30D' | '90D'
export const periods: Period[] = ['7D', '30D', '90D']

export const currency = (amount: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Calendar arithmetic preserves local days across daylight saving changes.
export function periodDates(period: Period, now = new Date()): string[] {
  const count = Number.parseInt(period, 10)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - count + 1 + index)
    return dayKey(date)
  })
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && dayKey(date) === value
}

export function customerDay(customer: Pick<Customer, 'createdAt'>): string | undefined {
  if (!customer.createdAt) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(customer.createdAt)) {
    return isDateKey(customer.createdAt) ? customer.createdAt : undefined
  }
  const date = new Date(customer.createdAt)
  return Number.isFinite(date.getTime()) ? dayKey(date) : undefined
}

// Round each stored monetary amount to cents without migrating stored records.
export function financialTotals(transactions: readonly Transaction[]) {
  let incomeCents = 0
  let expenseCents = 0
  for (const transaction of transactions) {
    const cents = Math.round((transaction.amount + Number.EPSILON) * 100)
    if (transaction.type === 'income') incomeCents += cents
    else expenseCents += cents
  }
  return {
    totalIncome: incomeCents / 100,
    totalExpenses: expenseCents / 100,
    netProfit: (incomeCents - expenseCents) / 100,
  }
}

export function periodMetrics(
  transactions: readonly Transaction[],
  customers: readonly Customer[],
  days: readonly string[],
) {
  const includedDays = new Set(days)
  const selectedTransactions = transactions.filter(
    (t) => isDateKey(t.date) && includedDays.has(t.date),
  )
  const selectedCustomers = customers.filter((c) => includedDays.has(customerDay(c) ?? ''))
  return {
    ...financialTotals(selectedTransactions),
    transactionCount: selectedTransactions.length,
    newCustomers: selectedCustomers.length,
    revenueSeries: days.map(
      (day) => financialTotals(selectedTransactions.filter((t) => t.date === day)).totalIncome,
    ),
    customerSeries: days.map(
      (day) => selectedCustomers.filter((c) => customerDay(c) === day).length,
    ),
  }
}

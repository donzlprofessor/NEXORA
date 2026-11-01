import { expect, it } from 'vitest'
import { filterTransactions, transactionError, type TransactionFilters } from '@/utils/transactions'
import type { Transaction } from '@/stores/finance'

const records: Transaction[] = [
  {
    id: 1,
    description: 'Consulting',
    category: 'Services',
    type: 'income',
    amount: 25.1,
    date: '2026-10-01',
  },
  {
    id: 2,
    description: 'Editor',
    category: 'Software',
    type: 'expense',
    amount: 10,
    date: '2026-11-01',
  },
  {
    id: 3,
    description: 'Design',
    category: 'Services',
    type: 'income',
    amount: 90,
    date: '2026-10-20',
  },
]
const filters: TransactionFilters = {
  search: '',
  type: '',
  category: '',
  from: '',
  to: '',
  sort: 'date-desc',
}

it('sorts recent records by date without mutating the source', () => {
  expect(filterTransactions(records, filters).map((t) => t.id)).toEqual([2, 3, 1])
  expect(records.map((t) => t.id)).toEqual([1, 2, 3])
  expect(filterTransactions(records, { ...filters, sort: 'amount-desc' }).map((t) => t.id)).toEqual(
    [3, 1, 2],
  )
})

it('combines search, type, category and inclusive calendar date filters', () => {
  expect(
    filterTransactions(records, {
      ...filters,
      search: ' SERVICES ',
      type: 'income',
      category: 'Services',
      from: '2026-10-20',
      to: '2026-10-20',
    }).map((t) => t.id),
  ).toEqual([3])
  expect(filterTransactions(records, { ...filters, from: '2026-11-02', to: '2026-10-01' })).toEqual(
    [],
  )
})

it('rejects invalid dates, blank descriptions, fractional cents and non-finite amounts', () => {
  const base = records[0]!
  expect(transactionError(base)).toBe('')
  for (const changes of [
    { amount: 0 },
    { amount: Infinity },
    { amount: 1.001 },
    { date: '2026-02-30' },
    { description: ' ' },
  ]) {
    expect(transactionError({ ...base, ...changes })).not.toBe('')
  }
})

import { describe, expect, it } from 'vitest'
import {
  customerDay,
  financialTotals,
  isDateKey,
  periodDates,
  periodMetrics,
} from '@/utils/metrics'
import type { Transaction } from '@/stores/finance'
import type { Customer } from '@/stores/customers'

const transaction = (
  date: string,
  amount: number,
  type: Transaction['type'] = 'income',
): Transaction => ({ id: 1, description: 'Test', category: 'Services', date, amount, type })
const customer = (createdAt?: string): Customer => ({
  id: 1,
  name: 'Test',
  email: 'test@example.com',
  company: 'Test',
  status: 'Active',
  totalSpent: 9999,
  createdAt,
})

describe('financial totals', () => {
  it('handles empty records and an expense-only loss', () => {
    expect(financialTotals([])).toEqual({ totalIncome: 0, totalExpenses: 0, netProfit: 0 })
    expect(financialTotals([transaction('2026-11-01', 20, 'expense')])).toEqual({
      totalIncome: 0,
      totalExpenses: 20,
      netProfit: -20,
    })
  })

  it('sums income and expenses in cents without floating point drift', () => {
    expect(
      financialTotals([
        transaction('2026-11-01', 0.1),
        transaction('2026-11-01', 0.2),
        transaction('2026-11-01', 0.1, 'expense'),
      ]),
    ).toEqual({ totalIncome: 0.3, totalExpenses: 0.1, netProfit: 0.2 })
  })
})

describe('local calendar date filtering', () => {
  it.each([
    ['7D', 7, '2026-10-26'],
    ['30D', 30, '2026-10-03'],
    ['90D', 90, '2026-08-04'],
  ] as const)(
    'generates %s days including today across month boundaries',
    (period, count, first) => {
      const days = periodDates(period, new Date(2026, 10, 1, 23, 59))
      expect(days).toHaveLength(count)
      expect(new Set(days).size).toBe(count)
      expect(days[0]).toBe(first)
      expect(days[days.length - 1]).toBe('2026-11-01')
    },
  )

  it('handles leap days and rejects impossible or malformed transaction dates', () => {
    expect(periodDates('7D', new Date(2024, 2, 1))).toContain('2024-02-29')
    expect(isDateKey('2024-02-29')).toBe(true)
    for (const value of [
      '2026-02-29',
      '2026-11-31',
      'invalid',
      '2026-1-01',
      '2026-11-01T00:00:00Z',
    ]) {
      expect(isDateKey(value)).toBe(false)
    }
  })

  it.each(['7D', '30D', '90D'] as const)(
    'keeps %s totals, daily series and customer counts consistent',
    (period) => {
      const days = periodDates(period, new Date(2026, 10, 1))
      const first = days[0]!
      const result = periodMetrics(
        [
          transaction(first, 100),
          transaction('2026-11-01', 25.5),
          transaction(first, 10, 'expense'),
          transaction('2026-08-03', 999),
          transaction('2026-11-02', 999),
          transaction('invalid', 999),
        ],
        [
          customer(first),
          customer('2026-11-01'),
          customer(),
          customer('invalid'),
          customer('2026-08-03'),
          customer('2026-11-02'),
        ],
        days,
      )
      expect(result.totalIncome).toBe(125.5)
      expect(result.totalExpenses).toBe(10)
      expect(result.netProfit).toBe(115.5)
      expect(result.newCustomers).toBe(2)
      expect(result.revenueSeries.reduce((a, b) => a + b, 0)).toBe(result.totalIncome)
      expect(result.customerSeries.reduce((a, b) => a + b, 0)).toBe(result.newCustomers)
      expect(result.revenueSeries[0]).toBe(100)
      expect(result.revenueSeries[result.revenueSeries.length - 1]).toBe(25.5)
    },
  )

  it('assigns timestamp registrations to their local calendar day', () => {
    const localTimestamp = new Date(2026, 10, 1, 0, 15).toISOString()
    expect(customerDay(customer(localTimestamp))).toBe('2026-11-01')
    expect(customerDay(customer())).toBeUndefined()
  })
})

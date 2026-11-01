import type { Customer } from '@/stores/customers'
import type { Transaction } from '@/stores/finance'

function daysAgo(days: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
// Dates are relative only on first load. Saved records keep their actual dates.
export function portfolioData(): { customers: Customer[]; transactions: Transaction[] } {
  const customers: Customer[] = [
    {
      id: 1,
      name: 'Alex Morgan',
      email: 'alex@example.com',
      company: 'Aurora Studio',
      status: 'Active',
      totalSpent: 7200,
      createdAt: daysAgo(60),
    },
    {
      id: 2,
      name: 'Maya Nowak',
      email: 'maya@example.com',
      company: 'Willow Design',
      status: 'Active',
      totalSpent: 4800,
      createdAt: daysAgo(25),
    },
    {
      id: 3,
      name: 'Leo Chen',
      email: 'leo@example.com',
      company: 'Orbit Workshop',
      status: 'Active',
      totalSpent: 3200,
      createdAt: daysAgo(12),
    },
    {
      id: 4,
      name: 'Sofia Reed',
      email: 'sofia@example.com',
      company: 'Cedar Collective',
      status: 'Inactive',
      totalSpent: 1500,
      createdAt: daysAgo(75),
    },
    {
      id: 5,
      name: 'Noah Ellis',
      email: 'noah@example.com',
      company: 'Meadow Lab',
      status: 'Lead',
      totalSpent: 0,
      createdAt: daysAgo(3),
    },
  ]
  const transactions: Transaction[] = [
    {
      id: 1,
      description: 'Aurora brand platform',
      category: 'Services',
      amount: 4200,
      type: 'income',
      date: daysAgo(45),
      customerId: 1,
    },
    {
      id: 2,
      description: 'Aurora product launch',
      category: 'Services',
      amount: 3000,
      type: 'income',
      date: daysAgo(5),
      customerId: 1,
    },
    {
      id: 3,
      description: 'Willow website design',
      category: 'Design',
      amount: 4800,
      type: 'income',
      date: daysAgo(18),
      customerId: 2,
    },
    {
      id: 4,
      description: 'Orbit consulting',
      category: 'Consulting',
      amount: 3200,
      type: 'income',
      date: daysAgo(2),
      customerId: 3,
    },
    {
      id: 5,
      description: 'Cedar discovery sprint',
      category: 'Consulting',
      amount: 1500,
      type: 'income',
      date: daysAgo(65),
      customerId: 4,
    },
    {
      id: 6,
      description: 'Design tools',
      category: 'Software',
      amount: 180,
      type: 'expense',
      date: daysAgo(35),
    },
    {
      id: 7,
      description: 'Workspace rental',
      category: 'Office',
      amount: 650,
      type: 'expense',
      date: daysAgo(28),
    },
    {
      id: 8,
      description: 'Design tools',
      category: 'Software',
      amount: 180,
      type: 'expense',
      date: daysAgo(7),
    },
    {
      id: 9,
      description: 'Campaign assets',
      category: 'Marketing',
      amount: 420,
      type: 'expense',
      date: daysAgo(4),
    },
  ]
  return { customers, transactions }
}

import type { Customer } from '@/stores/customers'

export function customerError(
  customer: Pick<Customer, 'name' | 'email' | 'company' | 'totalSpent' | 'status'>,
  existing: readonly Customer[],
  editingId: number | null,
): string {
  if (!customer.name.trim() || !customer.company.trim()) return 'Name and company are required.'
  if (customer.name.length > 100 || customer.company.length > 100)
    return 'Name and company must be at most 100 characters.'
  const email = customer.email.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Enter a valid email address.'
  if (existing.some((c) => c.id !== editingId && c.email.trim().toLowerCase() === email))
    return 'This email already belongs to another customer. Use a different email or edit that customer.'
  if (!['Active', 'Inactive', 'Lead'].includes(customer.status))
    return 'Choose a valid customer status.'
  if (
    !Number.isFinite(customer.totalSpent) ||
    customer.totalSpent < 0 ||
    customer.totalSpent > 1e12
  )
    return 'Lifetime spending must be a non-negative amount, at most one trillion EUR.'
  if (Math.abs(customer.totalSpent * 100 - Math.round(customer.totalSpent * 100)) > 0.001)
    return 'Use at most two decimal places for spending.'
  return ''
}

export type CustomerSort =
  'name-asc' | 'name-desc' | 'status-asc' | 'status-desc' | 'spent-desc' | 'spent-asc'
export function sortCustomers(customers: readonly Customer[], sort: CustomerSort): Customer[] {
  return [...customers].sort((a, b) => {
    const comparison = sort.startsWith('spent')
      ? a.totalSpent - b.totalSpent
      : sort.startsWith('status')
        ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    return comparison * (sort.endsWith('desc') ? -1 : 1)
  })
}

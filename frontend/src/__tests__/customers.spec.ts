import { expect, it } from 'vitest'
import type { Customer } from '@/stores/customers'
import { customerError, sortCustomers } from '@/utils/customers'

const alice: Customer = {
  id: 1,
  name: 'Alice',
  email: ' Alice@Example.com ',
  company: 'A',
  status: 'Active',
  totalSpent: 10,
}
const bob: Customer = {
  id: 2,
  name: 'Bob',
  email: 'bob@example.com',
  company: 'B',
  status: 'Lead',
  totalSpent: 20,
}

it('normalizes email comparison while allowing the current customer to retain their address', () => {
  expect(customerError({ ...bob, email: 'alice@example.COM' }, [alice, bob], 2)).toContain(
    'already belongs',
  )
  expect(customerError({ ...alice, email: 'alice@example.com' }, [alice, bob], 1)).toBe('')
  expect(customerError({ ...alice, email: 'invalid' }, [], null)).toContain('valid email')
})

it('sorts customers without reordering saved records', () => {
  const records = [bob, alice]
  expect(sortCustomers(records, 'name-asc').map((c) => c.id)).toEqual([1, 2])
  expect(sortCustomers(records, 'spent-desc').map((c) => c.id)).toEqual([2, 1])
  expect(sortCustomers(records, 'status-desc').map((c) => c.id)).toEqual([2, 1])
  expect(records).toEqual([bob, alice])
})

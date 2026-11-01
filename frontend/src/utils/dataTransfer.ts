import { storageKey } from '@/demo/config'
import type { Customer } from '@/stores/customers'
import type { Transaction } from '@/stores/finance'
import { customerError } from './customers'

export interface DataBundle {
  version: 1
  currency: 'EUR'
  customers: Customer[]
  transactions: Transaction[]
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateBundle(value: unknown): DataBundle {
  if (
    !object(value) ||
    value.version !== 1 ||
    value.currency !== 'EUR' ||
    !Array.isArray(value.customers) ||
    !Array.isArray(value.transactions)
  )
    throw new Error('Expected a NEXORA version 1 EUR export containing customers and transactions.')
  if (value.customers.length + value.transactions.length > 50000)
    throw new Error('Import is limited to 50,000 total records.')
  const ids = new Set<number>()
  const emails = new Set<string>()
  for (const c of value.customers) {
    if (
      !object(c) ||
      !Number.isSafeInteger(c.id) ||
      typeof c.name !== 'string' ||
      typeof c.email !== 'string' ||
      typeof c.company !== 'string' ||
      typeof c.totalSpent !== 'number' ||
      typeof c.status !== 'string'
    )
      throw new Error('Invalid customer record.')
    const message = customerError(c as unknown as Customer, [], null)
    if (message) throw new Error(`Invalid customer: ${message}`)
    if (
      c.createdAt !== undefined &&
      (typeof c.createdAt !== 'string' || !Number.isFinite(Date.parse(c.createdAt)))
    )
      throw new Error('Invalid customer registration date.')
    const email = c.email.trim().toLowerCase()
    if (ids.has(c.id as number) || emails.has(email))
      throw new Error('Duplicate customer ID or email in import.')
    ids.add(c.id as number)
    emails.add(email)
  }
  ids.clear()
  for (const t of value.transactions) {
    if (
      !object(t) ||
      !Number.isSafeInteger(t.id) ||
      typeof t.description !== 'string' ||
      typeof t.category !== 'string' ||
      typeof t.amount !== 'number' ||
      !Number.isFinite(t.amount) ||
      t.amount < 0 ||
      t.amount > 1e12 ||
      !['income', 'expense'].includes(String(t.type)) ||
      typeof t.date !== 'string' ||
      t.date.length > 40 ||
      t.description.length > 200 ||
      t.category.length > 200
    )
      throw new Error('Invalid transaction record.')
    // Legacy dates/zero amounts remain importable, matching the existing storage schema.
    if (ids.has(t.id as number)) throw new Error('Duplicate transaction ID in import.')
    ids.add(t.id as number)
  }
  return value as unknown as DataBundle
}

function same(a: object, b: object): boolean {
  return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
}

export function mergeBundle(existing: DataBundle, incoming: DataBundle): DataBundle {
  const customers = [...existing.customers]
  const transactions = [...existing.transactions]
  for (const c of incoming.customers) {
    const found = customers.find((item) => item.id === c.id)
    if (found) {
      if (!same(found, c))
        throw new Error(`Customer ID ${c.id} conflicts. Existing records will not be overwritten.`)
      continue
    }
    if (customers.some((item) => item.email.trim().toLowerCase() === c.email.trim().toLowerCase()))
      throw new Error('An imported email already belongs to an existing customer.')
    customers.push(c)
  }
  for (const t of incoming.transactions) {
    const found = transactions.find((item) => item.id === t.id)
    if (found) {
      if (!same(found, t))
        throw new Error(
          `Transaction ID ${t.id} conflicts. Existing records will not be overwritten.`,
        )
      continue
    }
    transactions.push(t)
  }
  return { version: 1, currency: 'EUR', customers, transactions }
}

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Save a full raw backup first. If any write fails, restore both original values.
export function persistBundle(bundle: DataBundle, storage: Storage = localStorage): string {
  const oldCustomers = storage.getItem(storageKey('nexora_customers'))
  const oldTransactions = storage.getItem(storageKey('nexora-transactions'))
  const backupKey = storageKey(`nexora_backup_${Date.now()}_${crypto.randomUUID()}`)
  storage.setItem(
    backupKey,
    JSON.stringify({ customers: oldCustomers, transactions: oldTransactions }),
  )
  try {
    storage.setItem(storageKey('nexora_customers'), JSON.stringify(bundle.customers))
    storage.setItem(storageKey('nexora-transactions'), JSON.stringify(bundle.transactions))
  } catch (error) {
    if (oldCustomers === null) storage.removeItem(storageKey('nexora_customers'))
    else storage.setItem(storageKey('nexora_customers'), oldCustomers)
    if (oldTransactions === null) storage.removeItem(storageKey('nexora-transactions'))
    else storage.setItem(storageKey('nexora-transactions'), oldTransactions)
    throw error
  }
  return backupKey
}

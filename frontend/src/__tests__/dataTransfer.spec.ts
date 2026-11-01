import { expect, it } from 'vitest'
import { mergeBundle, persistBundle, validateBundle, type DataBundle } from '@/utils/dataTransfer'

const empty = (): DataBundle => ({ version: 1, currency: 'EUR', customers: [], transactions: [] })
const sample = (): DataBundle => ({
  ...empty(),
  transactions: [
    {
      id: 7,
      description: 'Consulting',
      category: 'Services',
      date: '2026-11-01',
      amount: 12.25,
      type: 'income',
    },
  ],
})

it('validates exports and rejects malformed records and duplicate IDs', () => {
  expect(validateBundle(sample())).toEqual(sample())
  expect(() => validateBundle({ ...sample(), currency: 'USD' })).toThrow('Expected a NEXORA')
  expect(() =>
    validateBundle({ ...empty(), transactions: [{ ...sample().transactions[0], amount: -1 }] }),
  ).toThrow('Invalid transaction')
  expect(() =>
    validateBundle({
      ...sample(),
      transactions: [...sample().transactions, ...sample().transactions],
    }),
  ).toThrow('Duplicate')
})

it('merges without changing IDs, skips identical records and rejects overwrites', () => {
  const original = sample()
  expect(mergeBundle(original, sample()).transactions).toHaveLength(1)
  const additional = sample()
  additional.transactions[0]!.id = 8
  expect(mergeBundle(original, additional).transactions.map((t) => t.id)).toEqual([7, 8])
  additional.transactions[0]!.id = 7
  additional.transactions[0]!.amount = 999
  expect(() => mergeBundle(original, additional)).toThrow('will not be overwritten')
  expect(original.transactions[0]!.amount).toBe(12.25)
})

function memoryStorage(failOn?: string): Storage {
  const map = new Map<string, string>([
    ['nexora_customers', '[{"id":42}]'],
    ['nexora-transactions', '[{"id":43}]'],
  ])
  let failed = false
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    clear: () => map.clear(),
    removeItem: (key) => {
      map.delete(key)
    },
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (
        !failed &&
        (key === failOn || (failOn === 'backup' && key.startsWith('nexora_backup_')))
      ) {
        failed = true
        throw new Error('quota')
      }
      map.set(key, value)
    },
  }
}

it('archives original raw values before changing active lists', () => {
  const storage = memoryStorage()
  const key = persistBundle(sample(), storage)
  expect(JSON.parse(storage.getItem(key)!)).toEqual({
    customers: '[{"id":42}]',
    transactions: '[{"id":43}]',
  })
  expect(JSON.parse(storage.getItem('nexora-transactions')!)[0].id).toBe(7)
})

it.each(['backup', 'nexora_customers', 'nexora-transactions'])(
  'preserves originals if writing %s fails',
  (failOn) => {
    const storage = memoryStorage(failOn)
    expect(() => persistBundle(sample(), storage)).toThrow('quota')
    expect(storage.getItem('nexora_customers')).toBe('[{"id":42}]')
    expect(storage.getItem('nexora-transactions')).toBe('[{"id":43}]')
  },
)

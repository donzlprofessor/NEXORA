import { afterEach, expect, it, vi } from 'vitest'
import { boundedHistory, businessContext, connectionStatus, requestAnswer } from '@/services/ai'

afterEach(() => vi.unstubAllGlobals())

it('bounds inference history while retaining the newest user question', () => {
  const messages = [
    { role: 'user' as const, content: 'x'.repeat(4000) },
    { role: 'assistant' as const, content: 'y'.repeat(3000) },
    { role: 'user' as const, content: 'Latest question' },
  ]
  expect(boundedHistory(messages)).toEqual(messages.slice(1))
  expect(messages).toHaveLength(3)
})

it('only supplies aggregate business context without customer personal data', () => {
  const context = businessContext(
    [],
    [
      {
        id: 1,
        name: 'Private Name',
        email: 'private@example.com',
        company: 'Private Co',
        totalSpent: 999,
        status: 'Active',
      },
    ],
    '7D',
  )
  expect(context.allTime.totalIncome).toBe(0)
  expect(context.activeCustomers).toBe(1)
  expect(context.undatedCustomers).toBe(1)
  expect(JSON.stringify(context)).not.toContain('Private')
  expect(JSON.stringify(context)).not.toContain('999')
})

it('distinguishes backend unavailability from an offline Ollama response', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ollama_offline', model: 'qwen3:4b' })),
      ),
  )
  expect((await connectionStatus()).status).toBe('backend_unavailable')
  expect((await connectionStatus()).status).toBe('ollama_offline')
})

it('surfaces backend timeout errors and passes cancellation to fetch', async () => {
  const mock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Local model timed out' }), { status: 504 }),
    )
  vi.stubGlobal('fetch', mock)
  const signal = new AbortController().signal
  await expect(
    requestAnswer(
      [{ role: 'user', content: 'Summary?' }],
      businessContext([], [], '7D'),
      'ru',
      signal,
    ),
  ).rejects.toThrow('Local model timed out')
  expect(mock.mock.calls[0]![1]!.signal).toBe(signal)
})

it.each([
  ['', 'empty answer'],
  ['   ', 'empty answer'],
  ['<think>private reasoning</think>', 'Internal reasoning is hidden'],
  ['<THINK>private reasoning', 'Internal reasoning is hidden'],
])('rejects empty or reasoning-only final content: %s', async (content, error) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ content, thinking: 'private' }))),
  )
  await expect(
    requestAnswer(
      [{ role: 'user', content: 'Hello' }],
      businessContext([], [], '7D'),
      'en',
      new AbortController().signal,
    ),
  ).rejects.toThrow(error)
})

it('only displays final content and ignores separate reasoning fields', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: '  Review the verified snapshot.  ',
          thinking: 'private trace',
        }),
      ),
    ),
  )
  expect(
    await requestAnswer(
      [{ role: 'user', content: 'Hello' }],
      businessContext([], [], '7D'),
      'en',
      new AbortController().signal,
    ),
  ).toBe('Review the verified snapshot.')
})

it.each([
  [
    502,
    'generation_limit',
    'The local model exhausted its generation budget before completing a final answer.',
  ],
  [502, 'thinking_only', 'The local model returned internal reasoning without a final answer.'],
  [504, 'timeout', 'Local inference timed out before completing a final answer.'],
])('preserves structured backend %s %s errors', async (status, code, message) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ detail: { code, message } }), { status })),
  )
  await expect(
    requestAnswer(
      [{ role: 'user', content: 'Hello' }],
      businessContext([], [], '7D'),
      'en',
      new AbortController().signal,
    ),
  ).rejects.toThrow(message)
})

it('preserves cancellation while reading a response body instead of reporting an empty answer', async () => {
  const controller = new AbortController()
  const aborted = new DOMException('Aborted', 'AbortError')
  const response = new Response('{}')
  vi.spyOn(response, 'json').mockImplementation(async () => {
    controller.abort()
    throw aborted
  })
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response))
  await expect(
    requestAnswer(
      [{ role: 'user', content: 'Hello' }],
      businessContext([], [], '7D'),
      'en',
      controller.signal,
    ),
  ).rejects.toBe(aborted)
})

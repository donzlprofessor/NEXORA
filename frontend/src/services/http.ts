let csrf = ''
export function setCsrf(value: string) {
  csrf = value
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (import.meta.env.VITE_PUBLIC_DEMO === 'true')
    throw new ApiError(
      'Account access is disabled in the static public demo. Run the full stack locally.',
      0,
    )
  const requestCsrf = csrf
  const requestSignal = signal ?? AbortSignal.timeout(15000)
  const base = import.meta.env.VITE_API_BASE_URL || ''
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      credentials: 'include',
      signal: requestSignal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' && requestCsrf ? { 'X-CSRF-Token': requestCsrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (requestSignal.aborted)
      throw new ApiError(
        'Backend request timed out. Please retry; browser records are unchanged.',
        0,
      )
    throw new ApiError('Backend unavailable. Your browser data has not been changed.', 0)
  }
  if (response.status === 204) return undefined as T
  let result
  try {
    result = await response.json()
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new ApiError(
      requestSignal.aborted
        ? 'Backend request timed out. Please retry.'
        : 'The backend returned an invalid response. Please retry.',
      0,
    )
  }
  if (!response.ok) {
    if (response.status === 401 && requestCsrf === csrf && !path.startsWith('/api/auth/'))
      window.dispatchEvent(new Event('nexora-session-expired'))
    const detail = result?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail?.message === 'string'
          ? detail.message
          : Array.isArray(detail)
            ? 'Invalid input. Check the highlighted fields.'
            : 'The request could not be completed.'
    throw new ApiError(message, response.status)
  }
  return result as T
}

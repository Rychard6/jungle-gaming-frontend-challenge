import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { MockScenarioId } from './types'

const STORAGE_KEYS = {
  authToken: 'kurio_auth_token',
  userId: 'kurio_user_id',
  guestSessionId: 'kurio_guest_session_id',
  mockScenario: 'kurio_mock_scenario',
} as const

const MOCK_SCENARIOS: readonly MockScenarioId[] = [
  'default',
  'slow-network',
  'out-of-order',
  'network-error',
  'server-error-500',
  'session-expired',
  'price-change-on-checkout',
  'edition-sold-out',
  'order-timeout-recovery',
  'payment-declined',
]

type ApiErrorPayload = {
  message?: string
  code?: string
  fieldErrors?: Record<string, string>
  details?: unknown
}

export class ApiClientError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string>
  details?: unknown

  constructor(
    message: string,
    status: number,
    code: string,
    options: {
      fieldErrors?: Record<string, string>
      details?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.fieldErrors = options.fieldErrors
    this.details = options.details
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined

  const entries = Object.entries(value)
  if (!entries.every(([, entryValue]) => typeof entryValue === 'string')) {
    return undefined
  }

  return Object.fromEntries(entries) as Record<string, string>
}

function isMockScenarioId(value: string): value is MockScenarioId {
  return MOCK_SCENARIOS.some((scenario) => scenario === value)
}

function createGuestSessionId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  const randomBytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function getLocalStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function getGuestSessionId(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null

  const existingId = storage.getItem(STORAGE_KEYS.guestSessionId)
  if (existingId) return existingId

  const guestSessionId = createGuestSessionId()
  storage.setItem(STORAGE_KEYS.guestSessionId, guestSessionId)
  return guestSessionId
}

export function resetGuestSessionId(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  storage.removeItem(STORAGE_KEYS.guestSessionId)
  return getGuestSessionId()
}

export function getSessionCacheKey(): string | null {
  const storage = getLocalStorage()
  const userId = storage?.getItem(STORAGE_KEYS.userId)
  if (userId) return `user:${userId}`
  const guestSessionId = getGuestSessionId()
  return guestSessionId ? `guest:${guestSessionId}` : null
}

export function getAuthToken(): string | null {
  return getLocalStorage()?.getItem(STORAGE_KEYS.authToken) ?? null
}

export function setAuthSession(
  token: string | null,
  userId: string | null,
): void {
  const storage = getLocalStorage()
  if (!storage) return
  if (token === null || userId === null) {
    storage.removeItem(STORAGE_KEYS.authToken)
    storage.removeItem(STORAGE_KEYS.userId)
    return
  }
  storage.setItem(STORAGE_KEYS.authToken, token)
  storage.setItem(STORAGE_KEYS.userId, userId)
}

export function setAuthToken(token: string | null): void {
  const storage = getLocalStorage()
  if (!storage) return

  if (token === null) {
    storage.removeItem(STORAGE_KEYS.authToken)
    storage.removeItem(STORAGE_KEYS.userId)
    return
  }
  storage.setItem(STORAGE_KEYS.authToken, token)
}

export function setMockScenario(scenario: MockScenarioId): void {
  const storage = getLocalStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEYS.mockScenario, scenario)
}

function getMockScenario(): MockScenarioId {
  const storedScenario = getLocalStorage()?.getItem(STORAGE_KEYS.mockScenario)
  if (storedScenario === null || storedScenario === undefined) return 'default'
  if (!isMockScenarioId(storedScenario)) {
    throw new TypeError(`Cenário de mock inválido no armazenamento: ${storedScenario}`)
  }
  return storedScenario
}

function createApiClientError(error: AxiosError<unknown>): ApiClientError {
  const responseData = error.response?.data
  const payload: ApiErrorPayload = isRecord(responseData)
    ? {
        message:
          typeof responseData.message === 'string'
            ? responseData.message
            : undefined,
        code:
          typeof responseData.code === 'string'
            ? responseData.code
            : undefined,
        fieldErrors: getStringRecord(responseData.fieldErrors),
        details: responseData.details,
      }
    : {}

  return new ApiClientError(
    payload.message ?? error.message,
    error.response?.status ?? 0,
    payload.code ?? error.code ?? 'NETWORK_ERROR',
    {
      fieldErrors: payload.fieldErrors,
      details: payload.details,
    },
  )
}

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

let onUnauthorizedCallback: ((error: ApiClientError) => void) | undefined

export function setOnUnauthorizedCallback(
  callback: ((error: ApiClientError) => void) | undefined,
): void {
  onUnauthorizedCallback = callback
}

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const storage = getLocalStorage()
  const token = storage?.getItem(STORAGE_KEYS.authToken)
  const guestSessionId = token ? null : getGuestSessionId()

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  if (guestSessionId) {
    config.headers.set('x-guest-session-id', guestSessionId)
  } else {
    config.headers.delete('x-guest-session-id')
  }
  config.headers.set('x-mock-scenario', getMockScenario())

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError<unknown>(error)) {
      return Promise.reject(error)
    }

    const apiError = createApiClientError(error)
    const requestUrl = error.config?.url ?? ''
    if (
      apiError.status === 401 &&
      !requestUrl.includes('/auth/login') &&
      !requestUrl.includes('/auth/register') &&
      !requestUrl.includes('/auth/logout')
    ) {
      onUnauthorizedCallback?.(apiError)
    }

    return Promise.reject(apiError)
  },
)

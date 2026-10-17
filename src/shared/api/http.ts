import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { isMockScenarioId, type MockScenarioId } from './types'

const STORAGE_KEYS = {
  authToken: 'kurio_auth_token',
  userId: 'kurio_user_id',
  guestSessionId: 'kurio_guest_session_id',
  mockScenario: 'kurio_mock_scenario',
} as const

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

const sessionListeners = new Set<() => void>()

function notifySessionChange(): void {
  for (const listener of sessionListeners) listener()
}

function isSessionStorageKey(key: string | null): boolean {
  return (
    key === null ||
    key === STORAGE_KEYS.authToken ||
    key === STORAGE_KEYS.userId ||
    key === STORAGE_KEYS.guestSessionId
  )
}

/**
 * Mudanças de identidade feitas por OUTRA aba (evento `storage`): logout ou troca de
 * usuário lá devem limpar os dados privados exibidos aqui.
 */
export function subscribeForeignSessionChange(
  listener: () => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (isSessionStorageKey(event.key)) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

/**
 * Assina mudanças de identidade (login, logout, expiração e outras abas).
 * Alimenta `useSessionKey`, que mantém as query keys privadas reativas.
 */
export function subscribeSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener)
  const unsubscribeForeign = subscribeForeignSessionChange(listener)
  return () => {
    sessionListeners.delete(listener)
    unsubscribeForeign()
  }
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
  const guestSessionId = getGuestSessionId()
  notifySessionChange()
  return guestSessionId
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

export function getAuthUserId(): string | null {
  return getLocalStorage()?.getItem(STORAGE_KEYS.userId) ?? null
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
  } else {
    storage.setItem(STORAGE_KEYS.authToken, token)
    storage.setItem(STORAGE_KEYS.userId, userId)
  }
  notifySessionChange()
}

export function setMockScenario(scenario: MockScenarioId): void {
  const storage = getLocalStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEYS.mockScenario, scenario)
}

/** Cenário MSW persistido; valores desconhecidos degradam para `default`. */
export function getStoredMockScenario(): MockScenarioId {
  const storedScenario = getLocalStorage()?.getItem(STORAGE_KEYS.mockScenario)
  return isMockScenarioId(storedScenario) ? storedScenario : 'default'
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
  config.headers.set('x-mock-scenario', getStoredMockScenario())

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
    // Só a sessão ATUAL pode "expirar": visitantes não têm sessão, e uma resposta 401 atrasada
    // de um token antigo (já trocado por login/logout) não pode derrubar o usuário novo.
    const sentAuthorization = error.config?.headers.get('Authorization')
    const isCurrentSession =
      typeof sentAuthorization === 'string' &&
      sentAuthorization === `Bearer ${getAuthToken() ?? ''}`
    if (
      apiError.status === 401 &&
      isCurrentSession &&
      !requestUrl.includes('/auth/login') &&
      !requestUrl.includes('/auth/register') &&
      !requestUrl.includes('/auth/logout')
    ) {
      onUnauthorizedCallback?.(apiError)
    }

    return Promise.reject(apiError)
  },
)

import { useSyncExternalStore } from 'react'
import { getSessionCacheKey, subscribeSessionChange } from './http'

const FALLBACK_SESSION_KEY = 'anonymous'

function getSnapshot(): string {
  return getSessionCacheKey() ?? FALLBACK_SESSION_KEY
}

/**
 * Escopo reativo (`user:<id>` ou `guest:<id>`) usado nas query keys privadas.
 * Qualquer componente que a consome re-renderiza no login, logout, expiração
 * ou troca de usuário, e nunca continua exibindo dados da sessão anterior.
 */
export function useSessionKey(): string {
  return useSyncExternalStore(
    subscribeSessionChange,
    getSnapshot,
    () => FALLBACK_SESSION_KEY,
  )
}

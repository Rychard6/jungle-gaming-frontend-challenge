import { QueryClient } from '@tanstack/react-query'
import { ApiClientError } from '../shared/api/http'

const MAX_QUERY_RETRIES = 1

/**
 * Política de novas tentativas das consultas:
 * - 4xx (404, 401, 403, 409, 422...) é resposta definitiva; repetir só atrasa o feedback e,
 *   no 401, poderia mascarar a expiração da sessão;
 * - falhas de rede e 5xx recebem uma nova tentativa com backoff exponencial do TanStack Query.
 * Mutações nunca são repetidas automaticamente (evita operações duplicadas); pedidos usam
 * `Idempotency-Key` e uma nova tentativa explícita do usuário.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiClientError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false
  }
  return failureCount < MAX_QUERY_RETRIES
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
})
